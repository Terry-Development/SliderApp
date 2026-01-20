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
                className="w-full py-10 z-10"
                style={{
                    '--swiper-pagination-color': '#fff',
                    '--swiper-pagination-bullet-inactive-color': '#999',
                    '--swiper-pagination-bottom': '20px'
                }}
            >
                {images.map((img) => (
                    <SwiperSlide
                        key={img.id}
                        // Mobile: 280px (portrait card)
                        // Desktop: 340px
                        className="!w-[280px] sm:!w-[340px] !h-auto transition-all"
                    >
                        {({ isActive }) => (
                            <div
                                className={`
                                    aspect-[3/5]
                                    bg-dark-card border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative
                                    flex flex-col select-none
                                    /* Glassmorphism */
                                    backdrop-blur-xl bg-opacity-90
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

                                {/* Floating Badges */}
                                <div className="absolute top-4 left-4 z-10 flex gap-2">
                                    <div className="bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 border border-white/20 shadow-lg">
                                        <span className="text-xl">🔥</span>
                                    </div>
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
                            </div>
                        )}
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
}
