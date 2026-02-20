'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatApi } from '@/lib/api';

interface DoctorChatModalProps {
  isOpen: boolean;
  consultationId?: string;
  onClose: () => void;
}

interface ChatMessage {
  _id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

/** Render simple markdown (bold, italic, bullet points) as React elements */
function renderMarkdown(text: string) {
  // Split into lines to handle bullet points
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();

    // Bullet point lines (•, -, *)
    const bulletMatch = trimmed.match(/^[•\-\*]\s+(.*)/);
    const content = bulletMatch ? bulletMatch[1] : line;

    // Process inline formatting: **bold** and *italic*
    const parts: React.ReactNode[] = [];
    let remaining = content;
    let key = 0;

    while (remaining.length > 0) {
      // Bold: **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={key++} className="font-semibold text-white">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // No more formatting — push the rest
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (bulletMatch) {
      return (
        <div key={lineIdx} className="flex gap-2 pl-1">
          <span className="text-blue-300 shrink-0">•</span>
          <span>{parts}</span>
        </div>
      );
    }

    // Regular line
    return (
      <div key={lineIdx}>
        {parts}
        {lineIdx < lines.length - 1 && !trimmed ? <br /> : null}
      </div>
    );
  });
}

export default function DoctorChatModal({
  isOpen,
  consultationId,
  onClose,
}: DoctorChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role !== 'system'),
    [messages]
  );

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingHistory(true);
    setError(null);
    chatApi
      .getHistory(consultationId, 50)
      .then((res) => {
        setMessages(res.data?.messages || []);
      })
      .catch((err) => {
        console.error('Failed to load doctor chat history:', err);
        setError('Could not load chat history.');
      })
      .finally(() => setIsLoadingHistory(false));
  }, [isOpen, consultationId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleMessages, isSending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    setError(null);
    setInput('');

    const optimistic: ChatMessage = {
      _id: `tmp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setIsSending(true);

    try {
      const res = await chatApi.sendMessage(text, consultationId);
      const assistantMsg = res.data?.message as ChatMessage;
      setMessages((prev) => {
        const withoutTmp = prev.filter((m) => m._id !== optimistic._id);
        return [...withoutTmp, optimistic, assistantMsg];
      });
    } catch (err) {
      console.error('Failed to send message to doctor chat:', err);
      setError('Message failed. Please try again.');
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      setInput(text);
    } finally {
      setIsSending(false);
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          className="game-card w-full max-w-xl h-[75vh] sm:h-[680px] flex flex-col"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="text-2xl">👨‍⚕️</div>
              <div>
                <h3 className="text-base font-bold text-white">Doctor Assistant</h3>
                <p className="text-xs text-gray-400">
                  Personalized guidance from your consultation and checklist
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Close doctor chat"
            >
              <svg
                className="w-5 h-5 text-gray-300"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 space-y-3">
            {isLoadingHistory && (
              <div className="text-center text-sm text-gray-400 py-6">Loading conversation...</div>
            )}
            {!isLoadingHistory && visibleMessages.length === 0 && (
              <div className="text-center text-sm text-gray-400 py-8">
                Ask anything about your treatment, medications, or next checklist steps.
              </div>
            )}

            {visibleMessages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m._id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                      isUser
                        ? 'bg-blue-500/25 text-blue-100 border border-blue-400/30 whitespace-pre-wrap'
                        : 'bg-white/10 text-gray-100 border border-white/10 space-y-1'
                    }`}
                  >
                    {isUser ? m.content : renderMarkdown(m.content)}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex justify-start">
                <div className="max-w-[70%] px-3 py-2 rounded-xl text-sm bg-white/10 border border-white/10 text-gray-300">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/10">
            {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask your doctor assistant..."
                className="flex-1 rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !input.trim()}
                className="btn-game px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

