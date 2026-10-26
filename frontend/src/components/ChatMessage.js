/* Cloudinary already serves a width-limited image; the original opens on demand. */
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { PEOPLE } from '@/utils/identity';
import { getOptimizedImageUrl } from '@/utils/api';

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

function formatTime(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function ChatMessage({ message, identity, isLastMine, onReact, onDelete, onViewImage }) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const ownerId = message.ownerId || message.senderId || '';
    const mine = ownerId === identity;
    const senderName = PEOPLE[ownerId]?.name || message.sender || 'Earlier message';
    const myReaction = message.reactions?.[identity];
    const reactionCounts = Object.values(message.reactions || {}).reduce((counts, emoji) => {
        if (REACTION_EMOJIS.includes(emoji)) counts[emoji] = (counts[emoji] || 0) + 1;
        return counts;
    }, {});

    const react = (emoji) => {
        onReact(message, myReaction === emoji ? null : emoji);
        setPickerOpen(false);
    };

    return (
        <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] md:max-w-[70%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && <span className="text-xs text-primary-light px-1 mb-1">{senderName}</span>}
                <div className={`rounded-2xl px-3 md:px-4 py-2.5 shadow-sm min-w-20 ${mine ? 'bg-gradient-to-br from-primary to-indigo-500 rounded-br-md' : 'bg-dark-card border border-dark-border rounded-bl-md'}`}>
                    {message.image?.url && (
                        <button
                            type="button"
                            onClick={() => onViewImage(message.image.url)}
                            className="block rounded-xl overflow-hidden mb-1 focus:outline-none focus:ring-2 focus:ring-white/70"
                            aria-label={`View photo sent by ${senderName}`}
                        >
                            <img
                                src={getOptimizedImageUrl(message.image.url, 720)}
                                alt={`Photo from ${senderName}`}
                                loading="lazy"
                                className="block w-auto h-auto max-h-72 max-w-[65vw] md:max-w-[340px] object-contain rounded-xl"
                            />
                        </button>
                    )}
                    {message.text && <p className="text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>}
                    <div className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${mine ? 'text-indigo-100/80' : 'text-slate-500'}`}>
                        <span>{formatTime(message.createdAt)}</span>
                        {mine && <span aria-label={message.seenAt ? 'Seen' : 'Sent'}>{message.seenAt ? '✓✓' : '✓'}</span>}
                    </div>
                </div>

                <div className={`relative mt-1 flex items-center gap-1 flex-wrap ${mine ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <button
                            type="button"
                            key={emoji}
                            onClick={() => react(emoji)}
                            title={`React with ${emoji}`}
                            className={`rounded-full border px-2 py-0.5 text-xs bg-dark-card hover:bg-white/10 ${myReaction === emoji ? 'border-primary text-white' : 'border-dark-border text-slate-300'}`}
                        >
                            {emoji}{count > 1 ? ` ${count}` : ''}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setPickerOpen(open => !open)}
                        aria-label="React to message"
                        aria-expanded={pickerOpen}
                        className="rounded-full border border-dark-border px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:bg-white/10"
                    >
                        {myReaction ? '＋' : '☺ ＋'}
                    </button>
                    {mine && (
                        <button
                            type="button"
                            onClick={() => onDelete(message.id)}
                            aria-label="Delete message"
                            className="rounded-full px-2 py-0.5 text-xs text-slate-500 hover:text-red-400"
                        >
                            Delete
                        </button>
                    )}
                    {pickerOpen && (
                        <div className={`absolute bottom-full mb-2 z-20 flex items-center gap-1 p-2 rounded-full border border-dark-border bg-zinc-900 shadow-2xl ${mine ? 'right-0' : 'left-0'}`} role="group" aria-label="Choose a reaction">
                            {REACTION_EMOJIS.map(emoji => (
                                <button
                                    type="button"
                                    key={emoji}
                                    onClick={() => react(emoji)}
                                    aria-label={`React ${emoji}`}
                                    className="w-8 h-8 flex items-center justify-center text-lg rounded-full hover:bg-white/10 hover:scale-110 transition-transform"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {mine && isLastMine && (
                    <span className="mt-1 mr-1 text-[11px] text-slate-400" role="status">
                        {message.seenAt ? `Seen ${formatTime(message.seenAt)}` : 'Sent'}
                    </span>
                )}
            </div>
        </div>
    );
}
