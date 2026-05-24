import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChildSession } from "@/lib/auth";
import { isAllowedStorageUrl } from "@/lib/url-allowlist";
import { checkRateLimit } from "@/lib/rate-limit";

const GUEST_TRANSCRIBE_LIMIT = 2;
const GUEST_TRANSCRIBE_WINDOW_MS = 24 * 60 * 60 * 1000;

const TranscribeInputSchema = z.object({
  audioUrl: z.string().min(1, "Audio URL is required"),
});

function getClientIp(request: NextRequest): string {
  return (
    (request.headers.get("x-forwarded-for") ?? "")
      .split(",")[0]
      ?.trim() || "unknown"
  );
}

/**
 * POST /api/discovery/transcribe
 *
 * Transcribes an audio file stored in R2 using OpenAI Whisper.
 * Used to convert artwork story audio into text for combined multimodal analysis.
 *
 * Request body: { audioUrl: string }
 * Response:     { transcript: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getChildSession();

    // Rate-limit guests (shared window with analyze endpoint)
    if (!session?.childId) {
      const ip = getClientIp(request);
      const rl = await checkRateLimit(`analyze:${ip}`, "guest-analyze", {
        maxAttempts: GUEST_TRANSCRIBE_LIMIT,
        windowMs: GUEST_TRANSCRIBE_WINDOW_MS,
      });
      if (rl.limited) {
        return NextResponse.json(
          { error: "guest_limit_reached", message: "Guest limit reached." },
          { status: 429 },
        );
      }
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "invalid", message: "Invalid request body" }, { status: 400 });
    }

    const parsed = TranscribeInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { audioUrl } = parsed.data;

    // Validate URL against storage allowlist
    if (!isAllowedStorageUrl(audioUrl)) {
      return NextResponse.json({ error: "invalid", message: "Invalid audio URL" }, { status: 400 });
    }

    // Fetch audio from storage
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return NextResponse.json({ error: "fetch_failed", message: "Could not fetch audio file" }, { status: 502 });
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const contentType = audioRes.headers.get("content-type") ?? "audio/webm";
    const audioFile = new File([arrayBuffer], "story.webm", { type: contentType });

    // Transcribe with Whisper — always use OpenAI regardless of AI_PROVIDER
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
    });

    return NextResponse.json({ transcript: transcription.text }, { status: 200 });
  } catch (error) {
    console.error("[Transcribe] Error:", error);
    return NextResponse.json(
      { error: "internal", message: "Transcription failed" },
      { status: 500 },
    );
  }
}
