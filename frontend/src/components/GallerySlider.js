import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination } from 'swiper/modules';
import { API_URL, getAuthHeaders } from '@/utils/api';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/effect-coverflow';
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
        <div className="w-full py-8 text-center relative max-w-full overflow-hidden">
            {/* Styles */}
            <style jsx global>{`
                .swiper-button-next, .swiper-button-prev {
                    display: none !important;
                }
                .swiper-pagination-bullet {
                    background: #666;
                    opacity: 0.5;
                }
                .swiper-pagination-bullet-active {
                    background: #3b82f6; /* Primary color */
                    opacity: 1;
                }
                .swiper {
                    overflow: visible !important; /* Allow shadows/depth to peek */
                    padding-bottom: 40px !important;
                }
            `}</style>

            <Swiper
                effect={'coverflow'}
                grabCursor={true}
                centeredSlides={true}
                slidesPerView={'auto'}
                // "Fan" Effect Config matching the new reference:
                coverflowEffect={{
                    rotate: 40,      // Tilted side cards
                    stretch: 0,
                    depth: 100,      // Set back
                    modifier: 1,
                    slideShadows: true, // Essential for the "behind" look
                }}
                pagination={true}
                modules={[EffectCoverflow, Pagination]}
                className="w-full py-10" // Padding for rotation clearance
                style={{
                    '--swiper-pagination-color': '#fff',
                    '--swiper-pagination-bullet-inactive-color': '#999',
                    '--swiper-pagination-bottom': '0px'
                }}
            >
                {images.map((img) => {
                    const isSelected = selectedIds.has(img.id);
                    return (
                        <SwiperSlide
                            key={img.id}
                            // Fixed widths for reliable "Fan" rendering
                            // Mobile: 260px (portrait card)
                            // Desktop: 320px
                            className="!w-[280px] sm:!w-[340px] !h-auto transition-all"
                        >
                            {({ isActive }) => (
                                <div
                                    onClick={() => selectionMode && onToggleSelect(img.id)}
                                    // Aspect Ratio 3:5 or 9:16 for "Story" look
                                    className={`
                                        aspect-[3/5]
                                        bg-dark-card border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative
                                        flex flex-col select-none
                                        ${isSelected ? 'ring-4 ring-primary' : ''}
                                    `}
                                >
                                    {/* Main Image - Full Cover */}
                                    <div className="absolute inset-0 z-0 bg-black">
                                        <img
                                            src={img.url}
                                            alt={img.title}
                                            loading="lazy"
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Gradient Overlay for Text Readability */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                                    </div>

                                    {/* Floating Badges (Like the reference emojis) */}
                                    <div className="absolute top-4 left-4 z-10 flex gap-2">
                                        <div className="bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 border border-white/20 shadow-lg">
                                            <span className="text-xl">🔥</span>
                                        </div>
                                    </div>

                                    {/* Action Button (Like the reference circle button) */}
                                    <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 z-20">
                                        {/* Decorative element mimicking the UI circle in reference */}
                                    </div>

                                    {/* Bottom Content */}
                                    <div className="absolute bottom-0 left-0 right-0 p-6 z-10 text-left">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-gray-800">
                                                <div className="w-full h-full flex items-center justify-center text-xs text-white">USR</div>
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold text-sm tracking-wide shadow-black drop-shadow-md">
                                                    {img.title || 'Untitled'}
                                                </h3>
                                                <p className="text-white/70 text-xs">
                                                    {formatDate(img.createdAt)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Minimal Bar */}
                                        <div className="w-full h-1 bg-white/30 rounded-full mt-3 overflow-hidden">
                                            <div className="w-1/3 h-full bg-white rounded-full" />
                                        </div>
                                    </div>

                                    {!selectionMode && (
                                        <button
                                            onClick={(e) => handleDelete(e, img.id)}
                                            className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white/80 hover:bg-red-500/80 hover:text-white transition-all shadow-lg"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                            )}
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </div>
    );
}
