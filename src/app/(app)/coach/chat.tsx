"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  sendCoachMessageAction,
  loadCoachHistoryAction,
  type CoachMessage,
} from "@/server/actions/coach";

let _msgId = 0;
function tempId() { return `tmp-${++_msgId}`; }

export function CoachChat() {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load message history on mount.
  useEffect(() => {
    loadCoachHistoryAction().then((history) => {
      setMessages(history);
      setIsLoading(false);
    });
  }, []);

  // Scroll to bottom whenever messages change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isPending) return;
    setInput("");
    setError(null);

    // Optimistic user message.
    const userMsg: CoachMessage = {
      id: tempId(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    startTransition(async () => {
      const result = await sendCoachMessageAction(text, messages);
      if (result.ok) {
        const assistantMsg: CoachMessage = {
          id: result.messageId,
          role: "assistant",
          content: result.reply,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setError(result.error);
      }
    });
  }, [input, isPending, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-160px)]">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-4 pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="font-body-md text-body-md text-on-surface-variant">
              Loading conversation…
            </span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <span
              className="material-symbols-outlined text-[48px] text-secondary"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              chat
            </span>
            <div>
              <p className="font-headline-sm text-headline-sm text-on-surface">
                Hi! I&rsquo;m your study coach.
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                Ask me anything — how to revise a tricky topic, how to stay focused, or what to study next.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))
        )}

        {/* Typing indicator while pending */}
        {isPending && (
          <div className="flex justify-start">
            <div className="bg-surface-container border border-outline-variant rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {error && (
        <p className="font-body-sm text-body-sm text-error mb-2">{error}</p>
      )}

      {/* Input */}
      <div className="border-t border-outline-variant pt-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your coach…"
          rows={2}
          disabled={isPending}
          className="flex-1 resize-none border border-outline-variant rounded-xl px-4 py-3 bg-surface text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          aria-label="Message to coach"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isPending || !input.trim()}
          className="bg-primary text-on-primary rounded-xl p-3 hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
          aria-label="Send message"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            send
          </span>
        </button>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant text-center mt-2">
        Press Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}

function ChatBubble({ message }: { message: CoachMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-left ${
          isUser
            ? "bg-primary text-on-primary rounded-tr-sm"
            : "bg-surface-container border border-outline-variant text-on-surface rounded-tl-sm"
        }`}
      >
        {!isUser && (
          <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">
            Pace Coach
          </p>
        )}
        <p className="font-body-md text-body-md whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center py-1" aria-label="Coach is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-on-surface-variant"
          style={{
            animation: "bounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
