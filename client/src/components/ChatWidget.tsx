/**
 * ChatWidget.tsx — WebSocket chat component using socket.io-client.
 * Room: chat:{studentId}
 * Shows message history, typing indicator, read receipts.
 */
import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';

interface ChatMessage {
    id: string;
    fromId: string;
    fromName: string;
    message: string;
    createdAt: string;
}

interface ChatWidgetProps {
    studentId: string;
    currentUserId: string;
    currentUserName: string;
    toId?: string;
}

export function ChatWidget({ studentId, currentUserId, currentUserName }: ChatWidgetProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const typingTimer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (!socket.connected) socket.connect();
        socket.emit('chat:join', { studentId, userId: currentUserId });
        setConnected(true);

        socket.on('chat:history', ({ messages: history }: { messages: ChatMessage[] }) => {
            setMessages(history);
        });
        socket.on('chat:message', (msg: ChatMessage) => {
            setMessages(prev => [...prev, msg]);
        });
        socket.on('chat:typing', ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
            if (userId !== currentUserId) {
                setTyping(isTyping ? 'typing…' : null);
            }
        });

        return () => {
            socket.off('chat:history');
            socket.off('chat:message');
            socket.off('chat:typing');
        };
    }, [studentId, currentUserId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setInput(e.target.value);
        socket.emit('chat:typing', { studentId, userId: currentUserId, isTyping: true });
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => {
            socket.emit('chat:typing', { studentId, userId: currentUserId, isTyping: false });
        }, 1500);
    }

    function handleSend(e: React.FormEvent) {
        e.preventDefault();
        if (!input.trim()) return;
        socket.emit('chat:message', {
            studentId,
            fromId: currentUserId,
            toId: studentId,
            message: input.trim(),
        });
        setMessages(prev => [...prev, {
            id: `local-${Date.now()}`,
            fromId: currentUserId,
            fromName: currentUserName,
            message: input.trim(),
            createdAt: new Date().toISOString(),
        }]);
        setInput('');
        socket.emit('chat:typing', { studentId, userId: currentUserId, isTyping: false });
    }

    return (
        <div className="flex flex-col rounded-2xl overflow-hidden shadow-lg border border-slate-100" style={{ minHeight: 420 }}>
            {/* ── Header ─────────────────────────────────────────── */}
            <div
                className="flex items-center gap-3 px-5 py-3.5"
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
            >
                <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm select-none">
                        {currentUserName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-indigo-600 ${connected ? 'bg-green-400' : 'bg-slate-400'}`} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-white leading-none">Advisor Chat</p>
                    <p className="text-xs text-indigo-200 mt-0.5">{connected ? '● Online' : '○ Connecting…'}</p>
                </div>
            </div>

            {/* ── Messages ───────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50" style={{ maxHeight: 380 }}>
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 gap-2">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-indigo-300">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                            </svg>
                        </div>
                        <p className="text-sm text-slate-400 font-medium">No messages yet</p>
                        <p className="text-xs text-slate-300">Start a conversation with your advisor</p>
                    </div>
                )}

                {messages.map((msg) => {
                    const isMe = msg.fromId === currentUserId;
                    const initials = msg.fromName?.charAt(0).toUpperCase() || '?';
                    return (
                        <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {/* Recipient avatar */}
                            {!isMe && (
                                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0 mt-0.5 select-none">
                                    {initials}
                                </div>
                            )}

                            <div className={`max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                {!isMe && <p className="text-[10px] text-slate-400 mb-1 ml-1">{msg.fromName}</p>}
                                <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isMe
                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                        : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                                    }`}>
                                    <p className="break-words leading-relaxed">{msg.message}</p>
                                </div>
                                <p className={`text-[10px] mt-1 text-slate-400 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>

                            {/* Sender avatar */}
                            {isMe && (
                                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 select-none">
                                    {currentUserName?.charAt(0).toUpperCase() || 'M'}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Typing indicator */}
                {typing && (
                    <div className="flex gap-2.5 items-center">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0 select-none">?</div>
                        <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none px-4 py-2.5 shadow-sm">
                            <div className="flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* ── Input bar ──────────────────────────────────────── */}
            <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 bg-white border-t border-slate-100">
                <input
                    id="chat-input"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Type a message…"
                    autoComplete="off"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
                <button
                    id="btn-chat-send"
                    type="submit"
                    disabled={!input.trim()}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40"
                    style={{ background: input.trim() ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : '#e2e8f0' }}
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${input.trim() ? 'text-white' : 'text-slate-400'}`}>
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                </button>
            </form>
        </div>
    );
}
