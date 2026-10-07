import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import AuthWrapper from '@/components/AuthWrapper';
import PersonPicker from '@/components/PersonPicker';
import { FEATURE_API_URL } from '@/utils/api';
import { PEOPLE, getStoredIdentity, personHeaders } from '@/utils/identity';

function formatMessageTime(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function dayKey(value) {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ChatPage() {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [identity, setIdentity] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const bottomRef = useRef(null);
    const textareaRef = useRef(null);
    const initialLoadRef = useRef(true);

    useEffect(() => setIdentity(getStoredIdentity()), []);

    const fetchMessages = useCallback(async (silent = false) => {
        try {
            const res = await fetch(`${FEATURE_API_URL}/chat/messages?limit=300`, {
                headers: personHeaders(identity),
                cache: 'no-store'
            });
            if (!res.ok) throw new Error('Could not load messages');
            const data = await res.json();
            setMessages(Array.isArray(data) ? data : []);
            setError('');
        } catch (err) {
            if (!silent) setError(err.message || 'Could not load chat');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [identity]);

    useEffect(() => {
        fetchMessages();
        const timer = setInterval(() => fetchMessages(true), 2000);
        return () => clearInterval(timer);
    }, [fetchMessages]);

    useEffect(() => {
        if (!loading && initialLoadRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'auto' });
            initialLoadRef.current = false;
        }
    }, [loading]);

    useEffect(() => {
        if (!initialLoadRef.current && messages.length) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const grouped = useMemo(() => {
        const result = [];
        let lastDay = null;
        messages.forEach((message) => {
            const key = dayKey(message.createdAt);
            if (key !== lastDay) {
                result.push({ type: 'day', key: `day-${key}`, label: key });
                lastDay = key;
            }
            result.push({ type: 'message', key: message.id, message });
        });
        return result;
    }, [messages]);

    const sendMessage = async () => {
        const cleanText = text.trim();
        if (!cleanText || !identity || sending) return;
        setSending(true);
        setText('');
        try {
            const res = await fetch(`${FEATURE_API_URL}/chat/messages`, {
                method: 'POST',
                headers: personHeaders(identity, true),
                body: JSON.stringify({ text: cleanText })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Message failed to send');
            setMessages((current) => current.some((m) => m.id === data.id) ? current : [...current, data]);
            setError('');
            requestAnimationFrame(() => textareaRef.current?.focus());
        } catch (err) {
            setText(cleanText);
            setError(err.message || 'Message failed to send');
        } finally {
            setSending(false);
        }
    };

    const deleteMessage = async (id) => {
        try {
            const res = await fetch(`${FEATURE_API_URL}/chat/messages/${id}`, {
                method: 'DELETE',
                headers: personHeaders(identity)
            });
            if (!res.ok) throw new Error();
            setMessages((current) => current.filter((m) => m.id !== id));
        } catch {
            setError('Could not delete that message');
        }
    };

    return (
        <AuthWrapper>
            <Head><title>Chat | SliderApp</title></Head>
            <Navbar />
            <PersonPicker value={identity} onChange={setIdentity} />
            <main className="min-h-screen pt-20 md:pt-24 pb-4 px-3 md:px-4 bg-dark-bg">
                <div className="max-w-4xl mx-auto h-[calc(100dvh-6rem)] md:h-[calc(100dvh-7rem)] card-dark overflow-hidden flex flex-col shadow-2xl">
                    <header className="px-4 md:px-6 py-4 border-b border-dark-border flex items-center justify-between gap-4 bg-dark-card/95">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center font-bold">S</div>
                                <span className="absolute right-0 bottom-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-dark-card" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="font-semibold leading-tight">SliderApp Chat</h1>
                                <p className="text-xs text-slate-500">Terence + Partner · MongoDB synced</p>
                            </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                            {identity && <span className="hidden sm:inline text-xs text-slate-500">You are {PEOPLE[identity]?.name}</span>}
                            <PersonPicker value={identity} onChange={setIdentity} compact />
                        </div>
                    </header>

                    {error && <div className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-2 text-sm">{error}</div>}

                    <section className="flex-1 overflow-y-auto px-3 md:px-6 py-5 bg-gradient-to-b from-dark-bg/70 to-dark-bg">
                        {loading ? (
                            <div className="h-full grid place-items-center text-slate-500">Loading chat…</div>
                        ) : messages.length === 0 ? (
                            <div className="h-full grid place-items-center text-center px-6">
                                <div>
                                    <div className="w-16 h-16 mx-auto rounded-2xl bg-dark-card border border-dark-border grid place-items-center text-primary-light mb-4">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 10h8M8 14h5m7-2a8 8 0 11-3-6.2A8 8 0 0120 12zm0 0v7l-4-2" /></svg>
                                    </div>
                                    <h2 className="font-semibold text-lg">No messages yet</h2>
                                    <p className="text-slate-500 text-sm mt-1">Send the first message.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {grouped.map((item) => {
                                    if (item.type === 'day') return (
                                        <div key={item.key} className="flex items-center gap-3 py-3">
                                            <div className="h-px bg-dark-border flex-1" />
                                            <span className="text-[11px] uppercase tracking-wider text-slate-500">{item.label}</span>
                                            <div className="h-px bg-dark-border flex-1" />
                                        </div>
                                    );
                                    const message = item.message;
                                    const ownerId = message.ownerId || message.senderId || '';
                                    const mine = ownerId === identity;
                                    const senderName = message.sender || PEOPLE[ownerId]?.name || 'Earlier message';
                                    return (
                                        <div key={message.id} className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[84%] md:max-w-[70%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                                                {!mine && <span className="text-xs text-primary-light px-1 mb-1">{senderName}</span>}
                                                <div className={`relative rounded-2xl px-4 py-2.5 shadow-sm ${mine ? 'bg-gradient-to-br from-primary to-indigo-500 rounded-br-md' : 'bg-dark-card border border-dark-border rounded-bl-md'}`}>
                                                    <p className="text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
                                                    <div className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${mine ? 'text-indigo-100/70' : 'text-slate-500'}`}>
                                                        <span>{formatMessageTime(message.createdAt)}</span>
                                                        {mine && <span>✓</span>}
                                                    </div>
                                                    {mine && (
                                                        <button onClick={() => deleteMessage(message.id)} className="absolute -left-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-400 transition-all" aria-label="Delete message">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12m-9 0V5h6v2m-8 0l1 13h8l1-13" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>
                        )}
                    </section>

                    <footer className="border-t border-dark-border bg-dark-card p-3 md:p-4">
                        <div className="flex items-end gap-2 md:gap-3">
                            <textarea
                                ref={textareaRef}
                                value={text}
                                onChange={(e) => setText(e.target.value.slice(0, 4000))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                rows={1}
                                placeholder={identity ? `Message as ${PEOPLE[identity]?.name}…` : 'Choose who you are first…'}
                                disabled={!identity}
                                className="flex-1 min-h-12 max-h-32 resize-none bg-dark-bg border border-dark-border rounded-2xl px-4 py-3 text-sm placeholder-slate-500 focus:outline-none focus:border-primary disabled:opacity-50"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!identity || !text.trim() || sending}
                                className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent-purple grid place-items-center shadow-lg shadow-primary/20 disabled:opacity-40 disabled:shadow-none transition-all hover:scale-105 active:scale-95"
                                aria-label="Send message"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l14-7-4 14-3-5-7-2zm7 2l3-3" /></svg>
                            </button>
                        </div>
                        <div className="text-[10px] text-slate-600 mt-2 px-2">Enter to send · Shift + Enter for a new line</div>
                    </footer>
                </div>
            </main>
        </AuthWrapper>
    );
}
