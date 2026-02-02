
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AuthWrapper from '@/components/AuthWrapper';
import { API_URL, getAuthHeaders } from '@/utils/api';
// Use lodash debounce if available, or simple custom one. Using simplified custom effect for auto-save.

export default function NoteEditor() {
    const router = useRouter();
    const { id } = router.query;
    const [note, setNote] = useState({ title: '', content: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);

    useEffect(() => {
        if (id) {
            fetchNote();
        }
    }, [id]);

    const fetchNote = async () => {
        try {
            // Since we don't have a single GET endpoint for one note in my plan (oops), I can fetch all and find, or just use what I have.
            // Actually, normally you'd implement GET /notes/:id. 
            // Let's just find it from the list for now to save backend restarts, or I can quickly check if I need to add it.
            // Wait, I didn't add GET /notes/:id in server.js!
            // I will use GET /notes and find client side for now, or just add the endpoint rapidly.
            // Actually, fetching all is fine for a small app.
            const res = await fetch(`${API_URL}/notes`, { headers: getAuthHeaders() });
            const data = await res.json();
            const found = data.find(n => n.id === id);
            if (found) {
                setNote(found);
            } else {
                // Note not found
                router.push('/notes');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Auto-save logic
    useEffect(() => {
        if (loading || !id) return;

        const timer = setTimeout(async () => {
            await saveNote();
        }, 1000); // Auto-save after 1s of no typing

        return () => clearTimeout(timer);
    }, [note.title, note.content]);

    const saveNote = async () => {
        if (!id) return;
        setSaving(true);
        try {
            await fetch(`${API_URL}/notes/${id}`, {
                method: 'PATCH',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: note.title,
                    content: note.content
                })
            });
            setLastSaved(new Date());
        } catch (err) {
            console.error("Failed to save", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Delete this note?")) return;
        try {
            await fetch(`${API_URL}/notes/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            router.push('/notes');
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

    return (
        <AuthWrapper>
            <Head>
                <title>Edit Note - SliderApp</title>
            </Head>

            <div className="min-h-screen bg-black flex flex-col">
                {/* Toolbar */}
                <div className="h-16 border-b border-white/10 flex items-center justify-between px-4 sticky top-0 bg-black/80 backdrop-blur-md z-50">
                    <button onClick={() => router.push('/notes')} className="text-gray-400 hover:text-white p-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>

                    <div className="text-xs text-gray-500 font-medium">
                        {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
                    </div>

                    <button onClick={handleDelete} className="text-red-500 hover:text-red-400 p-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>

                {/* Editor */}
                <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col p-6">
                    <input
                        type="text"
                        value={note.title}
                        onChange={(e) => setNote(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Title"
                        className="bg-transparent text-4xl font-bold text-white placeholder-gray-600 outline-none mb-6 w-full"
                    />
                    <textarea
                        value={note.content}
                        onChange={(e) => setNote(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Type something..."
                        className="flex-1 bg-transparent text-lg text-gray-300 placeholder-gray-700 outline-none resize-none leading-relaxed"
                    />
                </div>
            </div>
        </AuthWrapper>
    );
}
