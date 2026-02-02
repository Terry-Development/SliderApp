import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';
import AuthWrapper from '@/components/AuthWrapper';
import Navbar from '@/components/Navbar';
import NoteCard from '@/components/NoteCard';
import { API_URL, getAuthHeaders } from '@/utils/api';

export default function NotesPage() {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            const res = await fetch(`${API_URL}/notes`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setNotes(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createNote = async () => {
        try {
            const res = await fetch(`${API_URL}/notes`, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: '', content: '' })
            });

            if (res.ok) {
                const newNote = await res.json();
                router.push(`/notes/${newNote.id}`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const deleteNote = async (noteId, e) => {
        e.preventDefault(); // Prevent navigation to note detail
        e.stopPropagation();

        const result = await Swal.fire({
            title: 'Delete note?',
            text: "This action cannot be undone",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#374151',
            confirmButtonText: 'Delete',
            background: '#18181b',
            color: '#fff'
        });

        if (result.isConfirmed) {
            try {
                const res = await fetch(`${API_URL}/notes/${noteId}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });

                if (res.ok) {
                    await fetchNotes(); // Refresh the list
                    Swal.fire({
                        title: 'Deleted!',
                        text: 'Note has been deleted',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false,
                        background: '#18181b',
                        color: '#fff'
                    });
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    return (
        <AuthWrapper>
            <Head>
                <title>Notes - SliderApp</title>
            </Head>

            <Navbar />

            <main className="min-h-screen pt-24 px-4 pb-24 max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-bold text-white">Notes</h1>
                </div>

                {loading ? (
                    <div className="flex justify-center mt-20">
                        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {notes.length > 0 ? (
                            notes.map(note => <NoteCard key={note.id} note={note} onDelete={deleteNote} />)
                        ) : (
                            <div className="col-span-full text-center py-20 text-gray-500">
                                No notes yet
                            </div>
                        )}
                    </div>
                )}

                {/* FAB */}
                <button
                    onClick={createNote}
                    className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-black rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>

            </main>
        </AuthWrapper>
    );
}
