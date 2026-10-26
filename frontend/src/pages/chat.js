/* Chat photos use Cloudinary transformations or local blob previews. */
/* eslint-disable @next/next/no-img-element */
import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import AuthWrapper from '@/components/AuthWrapper';
import PersonPicker from '@/components/PersonPicker';
import ChatMessage from '@/components/ChatMessage';
import { API_URL } from '@/utils/api';
import { PEOPLE, getStoredIdentity, personHeaders } from '@/utils/identity';
import { urlBase64ToUint8Array } from '@/utils/urlBase64ToUint8Array';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function dayKey(value) {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ChatPage() {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [viewingImage, setViewingImage] = useState('');
    const [identity, setIdentity] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const bottomRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const initialLoadRef = useRef(true);
    const [pushBusy, setPushBusy] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushMessage, setPushMessage] = useState('');

    useEffect(() => setIdentity(getStoredIdentity()), []);

    useEffect(() => {
        if (!selectedImage) {
            setImagePreview('');
            return;
        }
        const url = URL.createObjectURL(selectedImage);
        setImagePreview(url);
        return () => URL.revokeObjectURL(url);
    }, [selectedImage]);

    useEffect(() => {
        if (!viewingImage) return;
        const onKeyDown = (event) => { if (event.key === 'Escape') setViewingImage(''); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [viewingImage]);

    const fetchMessages = useCallback(async (silent = false) => {
        try {
            const res = await fetch(`${API_URL}/chat/messages?limit=300`, {
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

    // A receipt is sent only when the actual conversation is visible, not
    // simply because a background tab fetched messages during polling.
    const unseenIds = useMemo(() => messages
        .filter(message => message.id && message.ownerId && message.ownerId !== identity && !message.seenAt)
        .map(message => message.id), [messages, identity]);
    const unseenKey = unseenIds.join(',');

    useEffect(() => {
        if (!identity || !unseenKey) return;
        const ids = unseenKey.split(',');
        const controller = new AbortController();
        let inFlight = false;
        let succeeded = false;

        const markSeen = async () => {
            if (inFlight || succeeded || document.visibilityState !== 'visible') return;
            inFlight = true;
            try {
                const response = await fetch(`${API_URL}/chat/messages/seen`, {
                    method: 'POST',
                    headers: personHeaders(identity, true),
                    body: JSON.stringify({ ids }),
                    signal: controller.signal
                });
                if (!response.ok) throw new Error('Could not save read receipts');
                const data = await response.json();
                succeeded = true;
                const marked = new Set(ids);
                setMessages(current => current.map(message =>
                    marked.has(message.id) && message.ownerId !== identity && !message.seenAt
                        ? { ...message, seenAt: data.seenAt }
                        : message
                ));
            } catch (error) {
                if (error.name !== 'AbortError') console.warn('Read receipt failed:', error);
            } finally {
                inFlight = false;
            }
        };

        markSeen();
        document.addEventListener('visibilitychange', markSeen);
        window.addEventListener('focus', markSeen);
        return () => {
            controller.abort();
            document.removeEventListener('visibilitychange', markSeen);
            window.removeEventListener('focus', markSeen);
        };
    }, [identity, unseenKey]);

    useEffect(() => {
        let cancelled = false;
        if (identity !== 'partner') {
            setPushEnabled(false);
            setPushMessage('');
            return;
        }

        (async () => {
            try {
                if (!('serviceWorker' in navigator)) return;
                const registration = await navigator.serviceWorker.getRegistration();
                const subscription = registration ? await registration.pushManager?.getSubscription() : null;
                if (!subscription) return;
                const response = await fetch(`${API_URL}/chat/notification-status`, {
                    method: 'POST',
                    headers: personHeaders('partner', true),
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                });
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled) setPushEnabled(Boolean(data.enabled));
            } catch (err) {
                console.warn('Unable to check chat alert status:', err);
            }
        })();

        return () => { cancelled = true; };
    }, [identity]);

    const toggleJessyNotifications = async () => {
        if (identity !== 'partner' || pushBusy) return;
        setPushBusy(true);
        setPushMessage('');
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
                throw new Error('This browser does not support web push notifications.');
            }
            if (!VAPID_PUBLIC_KEY) throw new Error('Push notifications are not configured on the frontend.');

            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration && !pushEnabled) {
                // Normally next-pwa registers /sw.js. Fallback to the existing
                // dedicated worker, as the Reminders page already does.
                registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
            }
            if (!registration) throw new Error('No service worker is registered.');

            if (!pushEnabled && Notification.permission !== 'granted') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') throw new Error('Please allow notifications for this site.');
            }

            const readyRegistration = await navigator.serviceWorker.ready;
            const pushManager = readyRegistration.pushManager;
            let subscription = await pushManager.getSubscription();
            if (!subscription && !pushEnabled) {
                subscription = await pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });
            }
            if (!subscription) throw new Error('No push subscription found on this device.');

            const response = await fetch(`${API_URL}/chat/${pushEnabled ? 'unsubscribe' : 'subscribe'}`, {
                method: 'POST',
                headers: personHeaders('partner', true),
                body: JSON.stringify(pushEnabled
                    ? { endpoint: subscription.endpoint }
                    : subscription.toJSON())
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Failed to update chat notifications.');
            setPushEnabled((current) => !current);
            setPushMessage(pushEnabled
                ? 'Chat alerts disabled on this device. Reminder alerts remain enabled.'
                : 'Chat alerts enabled on this device.');
        } catch (err) {
            setPushMessage(err.message || 'Could not change notification settings.');
        } finally {
            setPushBusy(false);
        }
    };

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

    const lastOwnMessageId = useMemo(() => [...messages].reverse()
        .find(message => message.ownerId === identity)?.id, [messages, identity]);

    const chooseImage = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
            setError('Choose a JPEG, PNG, GIF or WebP photo.');
            event.target.value = '';
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('Photos must be 10 MB or smaller.');
            event.target.value = '';
            return;
        }
        setSelectedImage(file);
        setError('');
    };

    const removeImage = () => {
        setSelectedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const sendMessage = async () => {
        const cleanText = text.trim();
        if ((!cleanText && !selectedImage) || !identity || sending) return;
        setSending(true);
        setText('');
        try {
            const body = selectedImage ? new FormData() : JSON.stringify({ text: cleanText });
            const headers = personHeaders(identity, !selectedImage);
            if (selectedImage) {
                body.append('text', cleanText);
                body.append('image', selectedImage);
            }
            const res = await fetch(`${API_URL}/chat/messages`, {
                method: 'POST',
                headers,
                body
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Message failed to send');
            setMessages((current) => current.some((m) => m.id === data.id) ? current : [...current, data]);
            removeImage();
            setError('');
            requestAnimationFrame(() => textareaRef.current?.focus());
        } catch (err) {
            setText(cleanText);
            setError(err.message || 'Message failed to send');
        } finally {
            setSending(false);
        }
    };

    const reactToMessage = async (message, emoji) => {
        if (!identity) return;
        try {
            const res = await fetch(`${API_URL}/chat/messages/${encodeURIComponent(message.id)}/reaction`, {
                method: 'PATCH',
                headers: personHeaders(identity, true),
                body: JSON.stringify({ emoji })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not save reaction');
            setMessages(current => current.map(item =>
                item.id === message.id ? { ...item, reactions: data.reactions } : item
            ));
            setError('');
        } catch (error) {
            setError(error.message || 'Could not update reaction');
        }
    };

    const deleteMessage = async (id) => {
        try {
            const res = await fetch(`${API_URL}/chat/messages/${id}`, {
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
                                <p className="text-xs text-slate-500">Terence + Jessy · MongoDB synced</p>
                            </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                            {identity === 'partner' && (
                                <button
                                    type="button"
                                    disabled={pushBusy}
                                    onClick={toggleJessyNotifications}
                                    className="text-[11px] md:text-xs border border-dark-border rounded-lg px-2.5 py-2 text-slate-200 hover:bg-white/10 disabled:opacity-50"
                                    title="Configure push notifications for Jessy on this device"
                                >
                                    {pushBusy ? 'Saving…' : pushEnabled ? 'Mute alerts' : 'Enable alerts'}
                                </button>
                            )}
                            {identity && <span className="hidden sm:inline text-xs text-slate-500">You are {PEOPLE[identity]?.name}</span>}
                            <PersonPicker value={identity} onChange={setIdentity} compact />
                        </div>
                    </header>

                    {error && <div className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-2 text-sm">{error}</div>}
                    {identity === 'partner' && pushMessage && (
                        <div role="status" className="mx-4 mt-3 rounded-lg border border-primary/30 bg-primary/10 text-slate-200 px-4 py-2 text-xs">{pushMessage}</div>
                    )}

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
                                    return (
                                        <ChatMessage
                                            key={item.message.id}
                                            message={item.message}
                                            identity={identity}
                                            isLastMine={item.message.id === lastOwnMessageId}
                                            onReact={reactToMessage}
                                            onDelete={deleteMessage}
                                            onViewImage={setViewingImage}
                                        />
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>
                        )}
                    </section>

                    <footer className="border-t border-dark-border bg-dark-card p-3 md:p-4">
                        {imagePreview && (
                            <div className="flex items-center gap-3 mb-3 p-2 rounded-xl border border-dark-border bg-dark-bg max-w-xs">
                                <img src={imagePreview} alt="Photo ready to send" className="h-14 w-14 object-cover rounded-lg" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{selectedImage?.name}</p>
                                    <p className="text-[11px] text-slate-500">Photo attached</p>
                                </div>
                                <button type="button" onClick={removeImage} disabled={sending} aria-label="Remove selected photo" className="p-2 text-slate-400 hover:text-white disabled:opacity-50">✕</button>
                            </div>
                        )}
                        <div className="flex items-end gap-2 md:gap-3">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={chooseImage}
                                className="hidden"
                                aria-label="Choose a photo"
                            />
                            <button
                                type="button"
                                disabled={!identity || sending}
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Attach photo"
                                title="Attach photo (up to 10 MB)"
                                className="w-12 h-12 shrink-0 rounded-full border border-dark-border text-slate-300 grid place-items-center hover:bg-white/10 disabled:opacity-40"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7a2 2 0 012-2h3l2-2h4l2 2h1a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm8 10a4 4 0 100-8 4 4 0 000 8z" /></svg>
                            </button>
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
                                disabled={!identity || sending}
                                className="flex-1 min-h-12 max-h-32 resize-none bg-dark-bg border border-dark-border rounded-2xl px-4 py-3 text-sm placeholder-slate-500 focus:outline-none focus:border-primary disabled:opacity-50"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!identity || (!text.trim() && !selectedImage) || sending}
                                className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent-purple grid place-items-center shadow-lg shadow-primary/20 disabled:opacity-40 disabled:shadow-none transition-all hover:scale-105 active:scale-95"
                                aria-label="Send message"
                            >
                                {sending ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l14-7-4 14-3-5-7-2zm7 2l3-3" /></svg>
                                )}
                            </button>
                        </div>
                        <div className="text-[10px] text-slate-600 mt-2 px-2">Enter to send · Shift + Enter for a new line · Photos up to 10 MB</div>
                    </footer>
                </div>
            </main>

            {viewingImage && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Chat photo viewer" onClick={() => setViewingImage('')}>
                    <button type="button" className="absolute top-5 right-5 text-white border border-white/20 rounded-full px-4 py-2 text-sm" onClick={() => setViewingImage('')}>Close ✕</button>
                    <img src={viewingImage} alt="Full-size chat photo" className="max-w-full max-h-[90vh] object-contain" onClick={event => event.stopPropagation()} />
                </div>
            )}
        </AuthWrapper>
    );
}
