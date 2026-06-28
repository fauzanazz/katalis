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
} from "lucide-react";
import {
  getMentorSessionFn,
  sendMentorMessageFn,
  adjustMentorFn,
} from "@/lib/server/mentor";
import { getPresignedUploadUrlFn, completeUploadFn } from "@/lib/server/storage";

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

export function MissionChat({ missionId, defaultExpanded = false }: MissionChatProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [adjustmentMessageId, setAdjustmentMessageId] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

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

  const fetchSession = useCallback(async () => {
    const res = await getMentorSessionFn({ data: { missionId } });
    if (!res.ok) throw new Error("Failed to fetch session");
    return res;
  }, [missionId]);

  const sendMessage = useCallback(
    async (content: string, imgUrl?: string) => {
      if (!sessionId) return;
      setLoading(true);
      try {
        const res = await sendMentorMessageFn({
          data: { sessionId, content, imageUrl: imgUrl },
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

  // Initialize session on first expand
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
  }, [expanded, fetchSession, sendMessage]);

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
    if (!expanded) {
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
        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={`max-w-[85%] rounded-xl border px-3 py-2 text-sm leading-relaxed ${
                message.role === "child"
                  ? "ml-auto bg-blue-50 text-blue-900 border-blue-200"
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
        ))}

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
            Quest Buddy sedang tidak tersedia. Coba lagi sebentar ya!
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
          disabled={loading || imageUploading}
          aria-label={m.mentor_uploadPhoto()}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          {imageUploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="size-4" aria-hidden="true" />
          )}
        </button>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={m.mentor_placeholder()}
          disabled={loading}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || (!inputValue.trim() && !pendingImageUrl)}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          aria-label={m.mentor_send()}
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
