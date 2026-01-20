import { useState } from 'react';
import Swal from 'sweetalert2';
import { API_URL, getAuthHeaders } from '@/utils/api';

export default function GalleryGrid({ images, onDelete, selectionMode, selectedIds = new Set(), onToggleSelect, onImageClick }) {
    const [deletingId, setDeletingId] = useState(null);

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Image?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            background: '#1e1e1e',
            color: '#fff'
        });

        if (!result.isConfirmed) return;

        setDeletingId(id);
        try {
            const res = await fetch(`${API_URL}/images/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                onDelete(id);
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Your file has been deleted.',
                    icon: 'success',
                    timer: 1000,
                    showConfirmButton: false,
                    background: '#1e1e1e',
                    color: '#fff'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: 'Failed to delete image',
                    background: '#1e1e1e',
                    color: '#fff'
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error deleting image',
                background: '#1e1e1e',
                color: '#fff'
            });
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    };

    if (!images || images.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No images found. Click + to upload!</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
            {images.map((img) => {
                const isSelected = selectedIds.has(img.id);
                return (
                    <div
                        key={img.id}
                        className={`card-dark overflow-hidden group relative transition-all duration-200 ${isSelected ? 'ring-2 ring-primary scale-[0.98]' : ''}`}
                        onClick={() => selectionMode ? onToggleSelect(img.id) : onImageClick(img)}
                    >
                        {/* Image Preview */}
                        <div className={`relative h-48 bg-dark-bg cursor-pointer`}>
                            <img
                                src={img.url}
                                alt={img.title}
                                className={`w-full h-full object-cover transition-opacity ${selectionMode ? 'opacity-80' : ''}`}
                            />

                            {/* Selection Checkbox Overlay */}
                            {selectionMode && (
                                <div className="absolute top-3 left-3 z-30">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'bg-black/40 border-white/60'}`}>
                                        {isSelected && (
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Single Delete Button (Only active when NOT in selection mode) */}
                            {!selectionMode && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent card click
                                        handleDelete(img.id);
                                    }}
                                    disabled={deletingId === img.id}
                                    className="absolute top-3 right-3 z-20 p-2 bg-red-600/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-700 hover:scale-110 cursor-pointer shadow-lg"
                                    title="Delete Image"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-dark-border">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 bg-primary text-white text-xs font-semibold rounded uppercase">
                                    USER
                                </span>
                                <span className="text-slate-500 text-xs">{formatDate(img.createdAt)}</span>
                            </div>

                            {img.title && (
                                <h3 className="font-semibold text-white uppercase text-sm truncate">
                                    {img.title}
                                </h3>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
