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

    // Styling to match reference:
    // Centered card, with visible edges of previous/next
    // We use "swiper-slide" width to control how much of the side cards are visible.
    // CSS in JS for custom widths on breakpoints.

    return (
        <div className="w-full py-10">
            <Swiper
                effect={'coverflow'}
                grabCursor={true}
                centeredSlides={true}
                slidesPerView={'auto'}
                coverflowEffect={{
                    rotate: 0,
                    stretch: 0,
                    depth: 100,
                    modifier: 1,
                    slideShadows: true,
                }}
                pagination={true}
                modules={[EffectCoverflow, Pagination]}
                className="w-full"
                style={{ padidingBottom: '40px' }}
            >
                {images.map((img) => {
                    const isSelected = selectedIds.has(img.id);
                    return (
                        <SwiperSlide
                            key={img.id}
                            style={{ width: '300px', height: 'auto' }}
                            className="transition-transform"
                        >
                            {/* Card Content */}
                            <div
                                onClick={() => selectionMode && onToggleSelect(img.id)}
                                className={`
                                    bg-[#e0d6c8] text-gray-800 rounded-3xl overflow-hidden shadow-2xl relative
                                    flex flex-col h-[500px] select-none
                                    ${isSelected ? 'ring-4 ring-primary' : ''}
                                `}
                            >
                                {/* Header / User Info */}
                                <div className="p-6 pb-2 text-center">
                                    <div className="h-1 w-12 bg-gray-400/30 mx-auto rounded-full mb-4" /> {/* Handle bar */}
                                    <h3 className="font-bold tracking-widest text-[#f5f5f5] text-sm uppercase drop-shadow-md">SLIDER APP</h3>
                                    <div className="mt-6 mb-2">
                                        <div className="w-20 h-20 bg-white rounded-full mx-auto shadow-inner border-4 border-white flex items-center justify-center">
                                            {/* Abstract Avatar Placeholder */}
                                            <div className="w-16 h-16 bg-gray-200 rounded-full" />
                                        </div>
                                    </div>
                                    <h2 className="text-white font-bold text-xl uppercase drop-shadow-md">USER PROFILE</h2>
                                </div>

                                {/* Main Image (Occupies specific space to mimic the card look) */}
                                <div className="absolute inset-0 z-[-1]">
                                    {/* Background Blur/Gradient */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-[#e0d6c8] z-0" />
                                    {/* Actual Image if we want it as bg, but reference shows it as content?
                                        Actually, let's put the photo AS the card background or main content.
                                        For a PHOTO gallery, the photo should be the star.
                                    */}
                                    <img
                                        src={img.url}
                                        alt={img.title}
                                        className="w-full h-full object-cover absolute inset-0 z-[-2]"
                                    />
                                </div>

                                {/* Bottom Info Card (Overlapping) */}
                                <div className="mt-auto m-4 bg-white/30 backdrop-blur-md border border-white/40 rounded-2xl p-4 shadow-lg">
                                    <div className="flex items-center gap-2 mb-1 text-red-500 font-bold text-xs uppercase tracking-wider">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                                        Cloudinary
                                    </div>
                                    <h3 className="text-3xl font-serif text-white font-bold drop-shadow-sm italic">
                                        {formatDate(img.createdAt)}
                                    </h3>
                                    <p className="text-white/80 text-xs mt-1 truncate">
                                        {img.title || 'Untitled'}
                                    </p>

                                    <div className="flex items-center justify-between mt-3">
                                        {/* Indicator dots simulation */}
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 rounded-full bg-red-500" />
                                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                                        </div>
                                        <span className="text-white font-bold text-xs">01/12</span>
                                    </div>
                                </div>

                                {/* Delete Button */}
                                {!selectionMode && (
                                    <button
                                        onClick={(e) => handleDelete(e, img.id)}
                                        className="absolute top-4 right-4 text-white/70 hover:text-red-500 bg-black/20 rounded-full p-2 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </div>
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </div>
    );
}
