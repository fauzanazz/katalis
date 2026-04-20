"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  MessageCircle,
  Send,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface MissionChatProps {
  questId: string;
  missionId: string;
  missionDay: number;
  missionTitle: string;
}

interface ChatMessage {
  id: string;
  role: "child" | "mentor";
  content: string;
  suggestions?: string[];
  offerAdjustment?: boolean;
}

interface SessionResponse {
  sessionId: string;
  messages: ChatMessage[];
}

interface MessageResponse {
  message: ChatMessage;
}

export function MissionChat({
  missionId,
}: MissionChatProps) {
  const t = useTranslations("mentor");

  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [adjustmentMessageId, setAdjustmentMessageId] = useState<
    string | null
  >(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const fetchSession = useCallback(async (): Promise<SessionResponse> => {
    const res = await fetch(
      `/api/mentor/session?missionId=${missionId}`,
    );
    if (!res.ok) throw new Error("Failed to fetch session");
    return res.json();
  }, [missionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId) return;
      setLoading(true);
      try {
        const res = await fetch("/api/mentor/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, content }),
        });
        if (!res.ok) throw new Error("Failed to send message");
        const data: MessageResponse = await res.json();
        setMessages((prev) => [...prev, data.message]);
      } catch {
        // Silently fail — mentor unavailable
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
        setMessages(session.messages);

        if (session.messages.length === 0) {
          // Send empty greeting to get initial mentor message
          setLoading(true);
          const res = await fetch("/api/mentor/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: session.sessionId,
              content: "",
            }),
          });
          if (res.ok) {
            const data: MessageResponse = await res.json();
            setMessages([data.message]);
          }
          setLoading(false);
        }
      } catch {
        // Session init failed — chat unavailable
      }
    })();
  }, [expanded, fetchSession, sendMessage]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || loading) return;
    setInputValue("");

    const childMessage: ChatMessage = {
      id: `child-${Date.now()}`,
      role: "child",
      content: trimmed,
    };
    setMessages((prev) => [...prev, childMessage]);
    sendMessage(trimmed);
  }, [inputValue, loading, sendMessage]);

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
    .find((m) => m.role === "mentor");

  const adjustmentPending =
    latestMentorMsg?.offerAdjustment === true &&
    latestMentorMsg.id !== adjustmentMessageId;

  const handleAcceptAdjustment = useCallback(async () => {
    if (!sessionId || !latestMentorMsg) return;
    const acceptedId = latestMentorMsg.id;
    setLoading(true);
    try {
      const res = await fetch("/api/mentor/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          reason: "child_requested",
        }),
      });
      if (!res.ok) throw new Error("Adjustment failed");

      setAdjustmentMessageId(acceptedId);

      // Refetch session to get updated instructions
      const session = await fetchSession();
      setMessages(session.messages);

      const confirmMsg: ChatMessage = {
        id: `adjust-${Date.now()}`,
        role: "mentor",
        content: t("adjustment.applied"),
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch {
      // Adjustment failed
    } finally {
      setLoading(false);
    }
  }, [sessionId, latestMentorMsg, fetchSession, t]);

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
        aria-label={t("chatTitle")}
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        {t("chatTitle")}
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
              {t("chatTitle")}
            </h3>
            <p className="text-xs text-blue-600">{t("chatSubtitle")}</p>
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
        className="flex max-h-80 flex-col gap-3 overflow-y-auto p-4"
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
              {message.content}
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
            {t("thinking")}
          </div>
        )}

        {/* Adjustment card */}
        {adjustmentPending && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2">
              <Sparkles
                className="size-4 text-amber-600"
                aria-hidden="true"
              />
              <h4 className="text-sm font-semibold text-amber-800">
                {t("adjustment.title")}
              </h4>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              {t("adjustment.description")}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleAcceptAdjustment}
                disabled={loading}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                {t("adjustment.accept")}
              </button>
              <button
                onClick={handleDeclineAdjustment}
                disabled={loading}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
              >
                {t("adjustment.decline")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex items-center gap-2 border-t border-blue-100 bg-gray-50 px-3 py-2">
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
          placeholder={t("placeholder")}
          disabled={loading}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !inputValue.trim()}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          aria-label={t("send")}
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
