import { useEffect, useRef, useState } from "react";
import { m } from "@/paraglide/messages";
import { Button } from "@/components/ui/button";
import { useApp } from "../app/context";
import { aiReachable, mentorReply, scriptedReply } from "../data/ai";
import { evaluateAwards } from "../data/awards";
import { t, type MentorMessage } from "../data/types";
import { STR } from "../strings";

export function Mentor() {
  const { profile, locale } = useApp();
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const awardFiredRef = useRef(false);

  // Seed Kit's greeting on mount
  useEffect(() => {
    setMessages([{ role: "assistant", content: m.mentor_greeting() }]);
  }, []);

  // Auto-scroll to bottom whenever messages update or thinking toggles
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  if (!profile) return null;

  async function send() {
    if (!profile || thinking) return;
    const text = input.trim();
    if (!text) return;

    const userMsg: MentorMessage = { role: "user", content: text };
    // Capture history snapshot before state update
    const historyForAI = [...messages, userMsg];

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const reply = await mentorReply(historyForAI, {
        locale,
        childName: profile.name,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: scriptedReply(locale) },
      ]);
    } finally {
      setThinking(false);
    }

    // Fire trailblazer badge on the first completed turn (success or scripted)
    if (!awardFiredRef.current) {
      awardFiredRef.current = true;
      evaluateAwards(profile.id, { mentorUsed: true }).catch(() => {});
    }
  }

  const offline = !aiReachable();

  return (
    <div className="flex flex-col gap-5 p-5">
      <header className="pt-2">
        <h1 className="type-h2 text-ink">{m.mentor_chatTitle()}</h1>
        <p className="text-muted-foreground">{m.mentor_chatSubtitle()}</p>
      </header>

      {offline && (
        <div className="rounded-xl bg-yellow-sun-light px-4 py-2 text-sm text-ink">
          {t(STR.mentorOffline, locale)}
        </div>
      )}

      {/* Message list */}
      <div className="flex flex-col gap-3">
        {messages.map((msg, i) =>
          msg.role === "assistant" ? (
            <div key={i} className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl bg-plain-surface px-4 py-3 text-sm text-ink shadow-sm">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground">
                {msg.content}
              </div>
            </div>
          ),
        )}

        {/* Thinking bubble while awaiting AI reply */}
        {thinking && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl bg-plain-surface px-4 py-3 text-sm text-muted-foreground shadow-sm">
              {m.mentor_thinking()}
            </div>
          </div>
        )}

        {/* Scroll anchor — stays below the thinking bubble */}
        <div ref={bottomRef} />
      </div>

      {/* Input row — sticks above the bottom nav as content grows */}
      <div className="sticky bottom-20 z-10 -mx-5 border-t border-border bg-general-surface px-5 pb-2 pt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t(STR.askKit, locale)}
            disabled={thinking}
            className="min-h-12 flex-1 rounded-2xl border border-border bg-plain-surface px-4 text-sm text-ink placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <Button
            onClick={() => { send(); }}
            disabled={thinking || !input.trim()}
            size="default"
            className="min-h-12 shrink-0 rounded-2xl active:scale-[0.98]"
          >
            {m.mentor_send()}
          </Button>
        </div>
      </div>
    </div>
  );
}
