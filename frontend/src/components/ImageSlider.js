import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination } from 'swiper/modules';
import { API_URL, getAuthHeaders } from '@/utils/api';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';

export default function ImageSlider({ images }) {
    if (!images || images.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500">
                No images available. Go to Gallery to upload.
            </div>
        );
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="w-full h-full flex items-center justify-center bg-black relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-black z-0" />

            {/* Styles for Hide Arrows & Pagination */}
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
                    overflow: visible !important;
                    padding-bottom: 40px !important;
                }
            `}</style>

            <Swiper
                effect={'coverflow'}
                grabCursor={true}
                centeredSlides={true}
                slidesPerView={'auto'}
                // "Fan" Effect Config matching the requested style:
                coverflowEffect={{
                    rotate: 40,
                    stretch: 0,
                    depth: 100,
                    modifier: 1,
                    slideShadows: true,
                }}
                pagination={{ clickable: true }}
                modules={[EffectCoverflow, Pagination]}
                className="w-full py-10 z-10 !overflow-visible" // Overflow visible for shadows
                style={{
                    '--swiper-pagination-color': '#fff',
                    '--swiper-pagination-bullet-inactive-color': '#999',
                    '--swiper-pagination-bottom': '20px'
                }}
            >
                {images.map((img) => (
                    <SwiperSlide
                        key={img.id}
                        // Auto width to fit image aspect ratio
                        // Fixed height (60vh mobile, 70vh desktop)
                        className="!w-auto !h-[55vh] md:!h-[65vh] transition-all"
                    >
                        {({ isActive }) => (
                            <div
                                className={`
                                    h-full w-auto
                                    relative flex flex-col select-none
                                    /* Removed card background/border to behave like a raw image stack */
                                `}
                            >
                                {/* Main Image - Fit Content */}
                                <div className="relative h-full w-auto">
                                    <img
                                        src={img.url}
                                        alt={img.title}
                                        loading="lazy"
                                        className="h-full w-auto object-contain max-w-[90vw] rounded-[1.5rem] shadow-2xl bg-black"
                                    />
                                    {/* Gradient Overlay for Text Readability - Matches Image Radius */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none rounded-[1.5rem]" />

                                    {/* Bottom Content Overlay */}
                                    <div className="absolute bottom-0 left-0 right-0 p-6 z-10 text-left pointer-events-none">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-gray-800">
                                                <div className="w-full h-full flex items-center justify-center text-xs text-white">USR</div>
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold text-sm tracking-wide shadow-black drop-shadow-md">
                                                    {img.title || 'Untitled'}
                                                </h3>
                                                <p className="text-white/70 text-xs shadow-black drop-shadow-md">
                                                    {formatDate(img.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
}
