import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules'; // Navigation imported but not used to be safe, actually removing it from usage
import { API_URL, getAuthHeaders } from '@/utils/api';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

export default function GallerySlider({ images, onDelete, selectionMode, selectedIds = new Set(), onToggleSelect }) {
    const [deletingId, setDeletingId] = useState(null);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this image?')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`${API_URL}/images/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                onDelete(id);
            } else {
                alert('Failed to delete');
            }
        } catch (err) {
            alert('Error deleting image');
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (!images || images.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <p>No images found. Click + to upload!</p>
            </div>
        );
    }

    return (
        <div className="w-full py-6 md:py-10 relative">
            {/* Force Hide Navigation Buttons just in case */}
            <style jsx global>{`
                .swiper-button-next, .swiper-button-prev {
                    display: none !important;
                }
                .swiper-slide {
                    transition: transform 0.3s;
                }
                /* Center the pagination bullets at bottom */
                .swiper-pagination {
                    bottom: 0 !important;
                }
            `}</style>

            <Swiper
                modules={[Pagination]}
                spaceBetween={20}
                slidesPerView={'auto'}
                centeredSlides={true}
                grabCursor={true}
                pagination={{ clickable: true }}
                navigation={false}
                className="w-full h-[600px] md:h-[600px] !pb-10" // Added pb-10 for pagination space
                style={{
                    '--swiper-pagination-color': '#3b82f6',
                    '--swiper-pagination-bullet-inactive-color': '#999999',
                }}
            >
                {images.map((img) => {
                    const isSelected = selectedIds.has(img.id);
                    return (
                        <SwiperSlide
                            key={img.id}
                            // Custom Width Logic: 
                            // Mobile: 75vw (Reduced to ensure edges are clearly visible)
                            // Desktop: 350px fixed
                            className={`
                                !w-[75vw] !h-[500px] md:!w-[350px]
                            `}
                        >
                            {({ isActive }) => (
                                <div
                                    onClick={() => selectionMode && onToggleSelect(img.id)}
                                    className={`
                                        rounded-3xl overflow-hidden shadow-2xl relative
                                        flex flex-col h-full bg-dark-card border border-white/10 select-none
                                        transition-all duration-300
                                        ${isActive ? 'scale-100 opacity-100 ring-2 ring-white/10' : 'scale-90 opacity-40 blur-[1px]'}
                                        ${isSelected ? '!ring-4 !ring-primary' : ''}
                                    `}
                                >
                                    {/* Main Image Layer */}
                                    <div className="absolute inset-0 z-0 bg-black">
                                        <img
                                            src={img.url}
                                            alt={img.title}
                                            loading="lazy"
                                            className="w-full h-full object-cover opacity-80"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90 pointer-events-none" />
                                    </div>

                                    {/* Card Content Overlay */}
                                    <div className="relative z-10 flex flex-col h-full p-6">

                                        {/* Top Bar */}
                                        <div className="flex justify-between items-start">
                                            <div className="bg-black/30 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-2 border border-white/10">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                <span className="text-white/90 text-xs font-bold tracking-wider">LIVE</span>
                                            </div>

                                            {!selectionMode && (
                                                <button
                                                    onClick={(e) => handleDelete(e, img.id)}
                                                    className="text-white/50 hover:text-red-500 transition-colors p-2 bg-black/20 rounded-full"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>

                                        {/* Bottom Info */}
                                        <div className="mt-auto">
                                            <h2 className="text-white font-bold text-2xl leading-tight mb-2 drop-shadow-lg">
                                                {img.title || 'Untitled'}
                                            </h2>

                                            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-blue-400 text-xs font-bold uppercase tracking-wider">Uploaded</span>
                                                    <span className="text-white text-sm font-medium">{formatDate(img.createdAt)}</span>
                                                </div>
                                                <div className="h-8 w-px bg-white/10" />
                                                <div className="flex flex-col items-end">
                                                    <span className="text-blue-400 text-xs font-bold uppercase tracking-wider">Format</span>
                                                    <span className="text-white text-sm font-medium">JPG</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </div>
    );
}
