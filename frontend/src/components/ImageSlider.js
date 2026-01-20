import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination, Keyboard } from 'swiper/modules';
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
                loop={true}
                // "Fan" Effect Config:
                coverflowEffect={{
                    rotate: 30,
                    stretch: 0,
                    depth: 100,
                    modifier: 1,
                    slideShadows: true,
                }}
                pagination={{ clickable: true }}
                keyboard={{ enabled: true }}
                modules={[EffectCoverflow, Pagination, Keyboard]}
                className="w-full py-10 z-10 !overflow-visible"
                style={{
                    '--swiper-pagination-color': '#fff',
                    '--swiper-pagination-bullet-inactive-color': '#999',
                    '--swiper-pagination-bottom': '20px'
                }}
            >
                {images.map((img) => (
                    <SwiperSlide
                        key={img.id}
                        // Height: 55vh (Balanced mobile height)
                        // Auto width with Max Width constraint
                        className="!w-auto !h-[55vh] md:!h-[600px] transition-all"
                    >
                        {({ isActive }) => (
                            <div
                                className="h-full w-auto relative flex flex-col select-none"
                            >
                                {/* Main Image */}
                                <img
                                    src={img.url}
                                    alt={img.title}
                                    loading="lazy"
                                    className="h-full w-auto max-w-[85vw] object-contain rounded-[2rem] shadow-2xl bg-black"
                                />

                                {/* Gradient Overlay - Lighter and shorter */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none rounded-[2rem]" />

                                {/* Bottom Content Overlay - Compact */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 z-10 text-left pointer-events-none">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-8 h-8 rounded-full border border-white/50 overflow-hidden bg-gray-800 backdrop-blur-md">
                                            <div className="w-full h-full flex items-center justify-center text-[10px] text-white">USR</div>
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-sm leading-tight shadow-black drop-shadow-md">
                                                {img.title || 'Untitled'}
                                            </h3>
                                            <p className="text-white/80 text-[10px] shadow-black drop-shadow-md">
                                                {formatDate(img.createdAt)}
                                            </p>
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
