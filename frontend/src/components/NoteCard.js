
import Link from 'next/link';

export default function NoteCard({ note, onDelete }) {
    // Extract a short preview from content, handling potential newlines
    const getPreview = (text) => {
        if (!text) return 'No text';
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return 'No text';
        return lines.slice(0, 10).join('\n'); // Show more lines for mobile preview
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="group relative block w-full aspect-[4/5] md:aspect-square bg-zinc-900 border border-white/10 rounded-3xl p-6 hover:bg-zinc-800 hover:border-white/20 transition-all shadow-lg shadow-black/20">
            {/* Delete Button */}
            <button
                onClick={(e) => onDelete(note.id, e)}
                className="absolute top-4 right-4 p-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all z-10"
                title="Delete note"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>

            <Link href={`/notes/${note.id}`} className="h-full flex flex-col">
                {/* Title */}
                <h3 className="text-white font-bold text-lg mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                    {note.title || 'Untitled'}
                </h3>

                {/* Content Preview */}
                <div className="flex-1 overflow-hidden">
                    <p className="text-gray-400 text-sm whitespace-pre-line line-clamp-[8] md:line-clamp-5 leading-relaxed">
                        {getPreview(note.content)}
                    </p>
                </div>

                {/* Date Footer */}
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-end">
                    <span className="text-zinc-600 text-xs font-medium">
                        {formatDate(note.createdAt)}
                    </span>
                </div>
            </Link>
        </div>
    );
}
