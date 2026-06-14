import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WS_BASE_URL } from '../utils/api';
import useSocket from '../hooks/useSocket';

export default function LiveChatWidget({ userId }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const token = localStorage.getItem('token');
  const scrollContainerRef = useRef(null);
  const [messages, setMessages] = useState([
    { id: 1, role: 'bot', text: 'Hi. I am your support bot. Ask me about your risk and I will suggest next steps.' },
  ]);

  const chatUrl = useMemo(() => {
    if (!userId) return '';
    return `${WS_BASE_URL}/ws/chat?user_id=${userId}`;
  }, [userId]);

  const { isConnected, sendMessage } = useSocket(chatUrl, {
    enabled: open && Boolean(userId) && Boolean(token),
    onMessage: (message) => {
      if (message?.type !== 'bot_message') return;
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          role: 'bot',
          text: message.payload?.text || 'I am here to help.',
        },
      ]);
    },
  });

  useEffect(() => {
    if (!open || !scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, open]);

  const submitMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { id: prev.length + 1, role: 'user', text }]);
    if (!token) {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          role: 'bot',
          text: 'Please log in to start AI chat support.',
        },
      ]);
      setInput('');
      return;
    }

    const sent = sendMessage(text);
    if (!sent) {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          role: 'bot',
          text: 'Connecting to AI Support... message will send when connection is restored.',
        },
      ]);
    }
    setInput('');
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed right-3 sm:right-6 bottom-4 sm:bottom-6 z-50 rounded-full p-3 sm:p-4 bg-violet-600 text-white shadow-[0_12px_35px_rgba(76,29,149,0.5)] hover:bg-violet-500 transition-colors"
        aria-label="Toggle support chat"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="fixed right-2 sm:right-6 bottom-20 sm:bottom-24 z-50 w-[min(20rem,calc(100vw-1rem))] sm:w-[22rem] rounded-3xl border border-violet-500/35 bg-[#130b26]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-violet-400/20 flex items-center justify-between bg-violet-950/40">
              <div>
                <p className="text-sm font-bold text-white">AI Support</p>
                <p className="text-[11px] text-slate-400">
                  {isConnected ? 'Connected' : 'Reconnecting...'}
                </p>
              </div>
              <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            </div>

            <div ref={scrollContainerRef} className="h-72 overflow-y-auto px-4 py-3 space-y-2">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                      message.role === 'user'
                        ? 'ml-auto bg-violet-600 text-white'
                        : 'bg-slate-900/80 text-slate-100 border border-violet-900/70'
                    }`}
                  >
                    {message.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <form onSubmit={submitMessage} className="p-3 border-t border-violet-400/20 flex items-center gap-2 bg-violet-950/30">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your risk trend..."
                className="flex-1 rounded-xl bg-slate-900 border border-violet-900 text-sm text-white px-3 py-2 outline-none focus:border-violet-400"
              />
              <button
                type="submit"
                className="rounded-xl p-2.5 bg-violet-600 text-white hover:bg-violet-500 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
