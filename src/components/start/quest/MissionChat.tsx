import { useState, useRef, useEffect, useCallback } from "react";
import { m } from "@/paraglide/messages";
import {
  MessageCircle,
  Send,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Camera,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  Mic,
  MicOff,
  Star,
} from "lucide-react";
import {
  getMentorSessionFn,
  sendMentorMessageFn,
  adjustMentorFn,
  getMentorAudioFn,
  signalOriginalIdeaFn,
} from "@/lib/server/mentor";
import { getPresignedUploadUrlFn, completeUploadFn } from "@/lib/server/storage";
import { transcribeAudioFn } from "@/lib/server/discovery";
import type { BehavioralSignals } from "@/lib/ai/mentor-schemas";

interface MissionChatProps {
  questId: string;
  missionId: string;
  missionDay: number;
  missionTitle: string;
  defaultExpanded?: boolean;
}

interface ChatMessage {
  id: string;
  role: "child" | "mentor";
  content: string;
  suggestions?: string[];
  offerAdjustment?: boolean;
  imageUrl?: string;
}

export function MissionChat({ questId, missionId, defaultExpanded = false }: MissionChatProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [adjustmentMessageId, setAdjustmentMessageId] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [inventorClaimed, setInventorClaimed] = useState(false);
  const [inventorClaiming, setInventorClaiming] = useState(false);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);

  // Voices load asynchronously — populate once ready (used as fallback)
  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (threadRef.current) {
        threadRef.current.scrollTop = threadRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, adjustmentMessageId, scrollToBottom]);

  useEffect(() => {
    if (!isRecording) { setRecordingSeconds(0); return; }
    const interval = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const speakFallback = useCallback((messageId: string, text: string) => {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;
    utter.pitch = 1.1;
    const voices = voicesRef.current;
    const voice =
      voices.find((v) => v.name === "Microsoft Zira - English (United States)") ??
      voices.find((v) => v.lang.startsWith("en") && !v.name.includes("Online")) ??
      voices.find((v) => v.lang.startsWith("en")) ??
      null;
    if (voice) utter.voice = voice;
    let keepAlive: ReturnType<typeof setInterval> | null = null;
    utter.onstart = () => {
      setPlayingId(messageId);
      keepAlive = setInterval(() => {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      }, 150);
    };
    utter.onend = () => { if (keepAlive) clearInterval(keepAlive); setPlayingId(null); };
    utter.onerror = () => { if (keepAlive) clearInterval(keepAlive); setPlayingId(null); };
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      setTimeout(() => window.speechSynthesis.speak(utter), 100);
    } else {
      window.speechSynthesis.speak(utter);
    }
  }, []);

  const playAudio = useCallback(async (messageId: string, text: string) => {
    // Toggle off
    if (playingId === messageId) {
      audioRef.current?.pause();
      audioRef.current = null;
      window.speechSynthesis?.cancel();
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setPlayingId(null);
    setLoadingAudioId(messageId);

    try {
      // Try ElevenLabs first
      let dataUrl = audioCacheRef.current.get(messageId);
      if (!dataUrl) {
        const res = await getMentorAudioFn({ data: { text } });
        if (res.ok) {
          dataUrl = res.audioDataUrl;
          audioCacheRef.current.set(messageId, dataUrl);
        }
      }

      if (dataUrl) {
        const audio = new Audio(dataUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlayingId(null); audioRef.current = null; };
        audio.onerror = () => { setPlayingId(null); audioRef.current = null; };
        setPlayingId(messageId);
        setHasPlayedAudio(true);
        await audio.play();
      } else {
        // Fallback to Web Speech API if TTS key not configured
        setHasPlayedAudio(true);
        speakFallback(messageId, text);
      }
    } catch {
      setHasPlayedAudio(true);
      speakFallback(messageId, text);
    } finally {
      setLoadingAudioId(null);
    }
  }, [playingId, speakFallback]);

  const fetchSession = useCallback(async () => {
    const res = await getMentorSessionFn({ data: { missionId } });
    if (!res.ok) throw new Error("Failed to fetch session");
    return res;
  }, [missionId]);

  const sendMessage = useCallback(
    async (content: string, imgUrl?: string, behavioralSignals?: BehavioralSignals) => {
      if (!sessionId) return;
      setLoading(true);
      try {
        const res = await sendMentorMessageFn({
          data: { sessionId, content, imageUrl: imgUrl, behavioralSignals },
        });
        if (res.ok) {
          setChatError(false);
          setMessages((prev) => [...prev, res.message]);
        } else {
          setChatError(true);
        }
      } catch {
        setChatError(true);
      } finally {
        setLoading(false);
      }
    },
    [sessionId],
  );

  const handleRetry = useCallback(() => {
    setChatError(false);
    initialized.current = false;
    setSessionId(null);
    setMessages([]);
    setRetryKey((k) => k + 1);
  }, []);

  // Initialize session on first expand or after retry
  useEffect(() => {
    if (!expanded || initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const session = await fetchSession();
        setSessionId(session.sessionId);
        setMessages(
          session.messages.map((msg) => ({
            id: msg.id,
            role: msg.role as "child" | "mentor",
            content: msg.content,
            suggestions: (msg.meta as { suggestions?: string[] } | null)?.suggestions,
            offerAdjustment: (msg.meta as { offerAdjustment?: boolean } | null)?.offerAdjustment,
            imageUrl: (msg.meta as { imageUrl?: string } | null)?.imageUrl,
          })),
        );

        if (session.messages.length === 0) {
          setLoading(true);
          try {
            const res = await sendMentorMessageFn({
              data: { sessionId: session.sessionId, content: "" },
            });
            if (res.ok) {
              setMessages([res.message]);
            } else {
              setChatError(true);
            }
          } catch {
            setChatError(true);
          } finally {
            setLoading(false);
          }
        }
      } catch {
        setChatError(true);
      }
    })();
  }, [expanded, retryKey, fetchSession, sendMessage]);

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset input so the same file can be re-selected
      e.target.value = "";

      setImageUploading(true);
      try {
        const presignedRes = await getPresignedUploadUrlFn({
          data: { filename: file.name, contentType: file.type },
        });
        if (!presignedRes.ok) throw new Error("Presign failed");

        const { url: uploadUrl, key, category } = presignedRes;
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!putRes.ok) throw new Error("Upload failed");

        const completeRes = await completeUploadFn({ data: { key, category } });
        if (!completeRes.ok) throw new Error("Complete failed");

        setPendingImageUrl(completeRes.url);
      } catch {
        // Upload failed silently — child can try again
      } finally {
        setImageUploading(false);
      }
    },
    [],
  );

  const handleVoiceToggle = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }

    const mimeType = (
      MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" :
      MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" :
      "audio/ogg"
    );
    const recorder = new MediaRecorder(stream, { mimeType });
    audioChunksRef.current = [];
    recordingStartRef.current = Date.now();
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
      setVoiceUploading(true);

      const durationSeconds = (Date.now() - recordingStartRef.current) / 1000;
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const ext = mimeType === "audio/webm" ? "webm" : "mp4";

      try {
        const presignedRes = await getPresignedUploadUrlFn({
          data: { filename: `voice-${Date.now()}.${ext}`, contentType: mimeType },
        });
        if (!presignedRes.ok) throw new Error("Presign failed");

        const putRes = await fetch(presignedRes.url, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": mimeType },
        });
        if (!putRes.ok) throw new Error("Upload failed");

        const completeRes = await completeUploadFn({
          data: { key: presignedRes.key, category: presignedRes.category },
        });
        if (!completeRes.ok) throw new Error("Complete failed");

        const transcribeRes = await transcribeAudioFn({
          data: { audioUrl: completeRes.url },
        });
        if (!transcribeRes.ok) throw new Error("Transcription failed");

        const transcript = transcribeRes.transcript;
        if (!transcript?.trim()) throw new Error("Empty transcript");

        const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
        const speechRateWpm = durationSeconds > 2
          ? Math.round((wordCount / durationSeconds) * 60)
          : undefined;

        const childMessage: ChatMessage = {
          id: `child-${Date.now()}`,
          role: "child",
          content: transcript,
        };
        setMessages((prev) => [...prev, childMessage]);

        const signals: BehavioralSignals | undefined = speechRateWpm !== undefined
          ? { voiceProsody: { speechRateWpm } }
          : undefined;
        await sendMessage(transcript, undefined, signals);
      } catch {
        // Voice send failed — child can type instead
      } finally {
        setVoiceUploading(false);
      }
    };

    recorder.start();
    setIsRecording(true);
  }, [isRecording, sendMessage]);

  const handleOriginalIdea = useCallback(async () => {
    if (inventorClaiming || inventorClaimed) return;
    setInventorClaiming(true);
    try {
      const res = await signalOriginalIdeaFn({ data: { questId } });
      if (res.ok) {
        setInventorClaimed(true);
        const successMsg: ChatMessage = {
          id: `inventor-${Date.now()}`,
          role: "mentor",
          content: m.mentor_myOwnIdea_success(),
        };
        setMessages((prev) => [...prev, successMsg]);
      }
    } catch {
      // Failed silently
    } finally {
      setInventorClaiming(false);
    }
  }, [inventorClaiming, inventorClaimed, questId]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if ((!trimmed && !pendingImageUrl) || loading) return;
    setInputValue("");
    const imgUrl = pendingImageUrl ?? undefined;
    setPendingImageUrl(null);

    const content = trimmed || "📷";
    const childMessage: ChatMessage = {
      id: `child-${Date.now()}`,
      role: "child",
      content,
      imageUrl: imgUrl,
    };
    setMessages((prev) => [...prev, childMessage]);
    sendMessage(content, imgUrl);
  }, [inputValue, loading, pendingImageUrl, sendMessage]);

  const handleQuickReply = useCallback(
    (suggestion: string) => {
      if (loading) return;
      const childMessage: ChatMessage = {
        id: `child-${Date.now()}`,
        role: "child",
        content: suggestion,
      };
      setMessages((prev) => [...prev, childMessage]);
      sendMessage(suggestion);
    },
    [loading, sendMessage],
  );

  // Detect adjustment offer from latest mentor message
  const latestMentorMsg = [...messages]
    .reverse()
    .find((msg) => msg.role === "mentor");

  const adjustmentPending =
    latestMentorMsg?.offerAdjustment === true &&
    latestMentorMsg.id !== adjustmentMessageId;

  const handleAcceptAdjustment = useCallback(async () => {
    if (!sessionId || !latestMentorMsg) return;
    const acceptedId = latestMentorMsg.id;
    setLoading(true);
    try {
      const res = await adjustMentorFn({
        data: { sessionId, reason: "child_requested" },
      });
      if (!res.ok) throw new Error("Adjustment failed");

      setAdjustmentMessageId(acceptedId);

      const session = await fetchSession();
      setMessages(
        session.messages.map((msg) => ({
          id: msg.id,
          role: msg.role as "child" | "mentor",
          content: msg.content,
          suggestions: (msg.meta as { suggestions?: string[] } | null)?.suggestions,
          offerAdjustment: (msg.meta as { offerAdjustment?: boolean } | null)?.offerAdjustment,
          imageUrl: (msg.meta as { imageUrl?: string } | null)?.imageUrl,
        })),
      );

      const confirmMsg: ChatMessage = {
        id: `adjust-${Date.now()}`,
        role: "mentor",
        content: m.mentor_adjustment_applied(),
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch {
      // Adjustment failed
    } finally {
      setLoading(false);
    }
  }, [sessionId, latestMentorMsg, fetchSession]);

  const handleDeclineAdjustment = useCallback(() => {
    if (latestMentorMsg) {
      setAdjustmentMessageId(latestMentorMsg.id);
    }
  }, [latestMentorMsg]);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
    if (expanded) {
      audioRef.current?.pause();
      audioRef.current = null;
      window.speechSynthesis?.cancel();
      setPlayingId(null);
    } else {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [expanded]);

  // Collapsed state — toggle button
  if (!expanded) {
    return (
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
        aria-label={m.mentor_chatTitle()}
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        {m.mentor_chatTitle()}
        <ChevronUp className="size-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-blue-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-blue-600" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-blue-800">
              {m.mentor_chatTitle()}
            </h3>
            <p className="text-xs text-blue-600">{m.mentor_chatSubtitle()}</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-100"
          aria-label="Close chat"
        >
          <ChevronDown className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Message thread */}
      <div
        ref={threadRef}
        className="flex max-h-[480px] flex-col gap-3 overflow-y-auto p-4"
        role="log"
        aria-label="Chat messages"
      >
        {messages.map((message) => {
          const showAudioHint = message.role === "mentor" && !hasPlayedAudio;

          return (
          <div key={message.id}>
            <div className={`flex items-end gap-1.5 ${message.role === "child" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl border px-3 py-2 text-sm leading-relaxed ${
                  message.role === "child"
                    ? "bg-blue-50 text-blue-900 border-blue-200"
                    : "bg-gray-50 text-gray-900 border-gray-200"
                }`}
              >
                {message.imageUrl && (
                  <img
                    src={message.imageUrl}
                    alt="Shared progress photo"
                    className="mb-1.5 max-h-40 w-full rounded-lg object-cover"
                  />
                )}
                {message.content !== "📷" && message.content}
              </div>

              {message.role === "mentor" && message.content !== "" && (
                <div className="relative mb-0.5 flex shrink-0 flex-col items-center">
                  <button
                    onClick={() => { void playAudio(message.id, message.content); }}
                    disabled={loadingAudioId === message.id}
                    aria-label={playingId === message.id ? "Stop audio" : "Play audio"}
                    className={`flex size-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-colors hover:bg-blue-200 disabled:opacity-50 ${showAudioHint ? "ring-2 ring-blue-400 ring-offset-1 animate-pulse" : ""}`}
                  >
                    {loadingAudioId === message.id ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : playingId === message.id ? (
                      <VolumeX className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Volume2 className="size-3.5" aria-hidden="true" />
                    )}
                  </button>
                  {showAudioHint && (
                    <span className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm animate-bounce">
                      Tap! 🔊
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick reply suggestions below mentor messages */}
            {message.role === "mentor" &&
              message.suggestions &&
              message.suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {message.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleQuickReply(suggestion)}
                      disabled={loading}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
          </div>
          );
        })}

        {/* Thinking indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {m.mentor_thinking()}
          </div>
        )}

        {/* Error state */}
        {chatError && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            <p className="mb-2">{m.mentor_errorUnavailable()}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1 font-medium text-red-700 underline hover:text-red-800"
            >
              <RefreshCw className="size-3" aria-hidden="true" />
              {m.mentor_errorRetry()}
            </button>
          </div>
        )}

        {/* Adjustment card */}
        {adjustmentPending && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-600" aria-hidden="true" />
              <h4 className="text-sm font-semibold text-amber-800">
                {m.mentor_adjustment_title()}
              </h4>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              {m.mentor_adjustment_description()}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleAcceptAdjustment}
                disabled={loading}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                {m.mentor_adjustment_accept()}
              </button>
              <button
                onClick={handleDeclineAdjustment}
                disabled={loading}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
              >
                {m.mentor_adjustment_decline()}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending image preview */}
      {pendingImageUrl && (
        <div className="relative mx-3 mb-1 w-fit">
          <img
            src={pendingImageUrl}
            alt="Photo to send"
            className="h-16 w-16 rounded-lg border border-blue-200 object-cover"
          />
          <button
            onClick={() => setPendingImageUrl(null)}
            aria-label={m.mentor_removePhoto()}
            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-gray-700 text-white hover:bg-gray-900"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Inventor badge prompt — shows after a few exchanges */}
      {messages.length >= 4 && !inventorClaimed && (
        <div className="mx-3 mb-1 flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2">
          <Star className="size-4 shrink-0 text-yellow-500" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs text-yellow-800">
            {m.mentor_myOwnIdea_description()}
          </p>
          <button
            onClick={() => { void handleOriginalIdea(); }}
            disabled={inventorClaiming}
            className="shrink-0 rounded-lg bg-yellow-400 px-2.5 py-1 text-xs font-medium text-yellow-900 transition-colors hover:bg-yellow-500 disabled:opacity-50"
          >
            {inventorClaiming ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              m.mentor_myOwnIdea_button()
            )}
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-center gap-2 border-t border-blue-100 bg-gray-50 px-3 py-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || imageUploading || isRecording}
          aria-label={m.mentor_uploadPhoto()}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          {imageUploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="size-4" aria-hidden="true" />
          )}
        </button>

        <button
          onClick={() => { void handleVoiceToggle(); }}
          disabled={loading || voiceUploading || imageUploading}
          aria-label={isRecording ? m.mentor_voice_stop() : m.mentor_voice_record()}
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
            isRecording
              ? "border-red-300 bg-red-100 text-red-600 hover:bg-red-200 animate-pulse"
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
          }`}
        >
          {voiceUploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : isRecording ? (
            <MicOff className="size-4" aria-hidden="true" />
          ) : (
            <Mic className="size-4" aria-hidden="true" />
          )}
        </button>

        <input
          ref={inputRef}
          type="text"
          value={isRecording
            ? `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`
            : voiceUploading ? m.mentor_voice_sending() : inputValue
          }
          onChange={(e) => { if (!isRecording && !voiceUploading) setInputValue(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={m.mentor_placeholder()}
          disabled={loading || isRecording || voiceUploading}
          readOnly={isRecording || voiceUploading}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || isRecording || voiceUploading || (!inputValue.trim() && !pendingImageUrl)}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          aria-label={m.mentor_send()}
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
