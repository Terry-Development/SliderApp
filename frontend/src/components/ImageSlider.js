import { useState, useEffect } from 'react';

export default function ImageSlider({ images }) {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        if (images.length === 0) return;
        const timer = setInterval(() => {
            setCurrent(prev => (prev + 1) % images.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [images.length]);

    if (!images || images.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500">
                No images available. Go to Gallery to upload.
            </div>
        );
    }

    const nextSlide = () => setCurrent(current === images.length - 1 ? 0 : current + 1);
    const prevSlide = () => setCurrent(current === 0 ? images.length - 1 : current - 1);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    };

    const currentImg = images[current];
    const hasText = (currentImg.title && currentImg.title.trim() !== '') || (currentImg.description && currentImg.description.trim() !== '');

    return (
        <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">

            {/* 
        LAYER 1: Blurred Background 
        Fills the screen, blurred, darker to act as ambient backdrop.
      */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out blur-3xl opacity-50 scale-110"
                style={{ backgroundImage: `url(${currentImg.url})` }}
            />

            {/* Dark overlay to ensure text readability globally */}
            <div className="absolute inset-0 bg-black/40" />

            {/* 
        LAYER 2: Main Image 
        Centered, contained, shadow. User wants "image above" style.
      */}
            <div className={`relative z-10 w-full h-full p-4 md:p-12 flex items-center justify-center ${hasText ? 'pb-32 md:pb-40' : ''}`}>
                <img
                    src={currentImg.url}
                    alt={currentImg.title}
                    className="max-w-full max-h-full object-contain drop-shadow-2xl shadow-black/80 rounded-lg"
                />
            </div>

            {/* 
        LAYER 3: Text Overlay 
        Only show if text exists.
      */}
            {hasText && (
                <>
                    <div className="absolute inset-x-0 bottom-0 z-20 h-1/2 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />

                    <div className="absolute bottom-8 left-8 md:bottom-16 md:left-16 z-30 max-w-3xl pr-8">
                        <div className="flex items-center gap-3 mb-2 animate-in slide-in-from-bottom-2 duration-500">
                            <span className="px-2.5 py-1 bg-primary text-white text-[10px] md:text-sm font-bold rounded-md uppercase tracking-widest shadow-lg shadow-primary/30">
                                USER
                            </span>
                            <span className="text-slate-300 text-xs md:text-base font-medium tracking-wide">
                                {formatDate(currentImg.createdAt)}
                            </span>
                        </div>

                        {currentImg.title && (
                            <h1 className="text-3xl md:text-6xl font-bold text-white mb-3 uppercase tracking-tight leading-tight drop-shadow-lg animate-in slide-in-from-bottom-4 duration-500 delay-100">
                                {currentImg.title}
                            </h1>
                        )}

                        {currentImg.description && (
                            <p className="text-slate-300 text-sm md:text-xl font-light leading-relaxed max-w-2xl animate-in slide-in-from-bottom-4 duration-500 delay-200">
                                {currentImg.description}
                            </p>
                        )}
                    </div>
                </>
            )}

            {/* Navigation - Minimalist */}
            <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-4 text-white/50 hover:text-white transition-colors hover:bg-white/10 rounded-full"
            >
                <svg className="w-8 h-8 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
            </button>

            <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-4 text-white/50 hover:text-white transition-colors hover:bg-white/10 rounded-full"
            >
                <svg className="w-8 h-8 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
            </button>

            {/* Indicators */}
            <div className="absolute bottom-8 right-8 z-40 flex gap-2">
                {images.map((_, idx) => (
                    <div
                        key={idx}
                        className={`transition-all duration-300 rounded-full shadow-lg ${idx === current ? 'w-3 h-3 bg-white' : 'w-2 h-2 bg-white/30'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
