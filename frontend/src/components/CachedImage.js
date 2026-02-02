import { useState, useEffect } from 'react';
import { getCachedImage, cacheImage } from '@/utils/db'; // Make sure db.js path is correct

export default function CachedImage({ src, alt, className, id, onClick }) {
    const [imageSrc, setImageSrc] = useState(null); // Initially null to prevent flash
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadImage = async () => {
            try {
                // 1. Check Cache
                const cached = await getCachedImage(id);

                if (cached && cached.blob) {
                    console.log(`%c ⚡ Loaded from Cache: ${id}`, 'color: #10b981; font-weight: bold');
                    const objectUrl = URL.createObjectURL(cached.blob);
                    if (isMounted) {
                        setImageSrc(objectUrl);
                        setLoading(false);
                    }
                    return; // Done
                }

                // 2. Fetch from Network if not cached
                const response = await fetch(src);
                const blob = await response.blob();

                if (isMounted) {
                    const objectUrl = URL.createObjectURL(blob);
                    setImageSrc(objectUrl);
                    setLoading(false);
                }

                // 3. Save to Cache in background
                cacheImage(id, src, blob);
                console.log(`%c ⬇️ Downloaded & Saved: ${id}`, 'color: #3b82f6; font-weight: bold');

            } catch (error) {
                console.error("Image load fail:", error);
                // Fallback to original src if everything fails
                if (isMounted) {
                    setImageSrc(src);
                    setLoading(false);
                }
            }
        };

        if (id && src) {
            loadImage();
        } else {
            setImageSrc(src); // No caching logic if no ID
            setLoading(false);
        }

        return () => isMounted = false;
    }, [id, src]);

    if (!imageSrc && loading) {
        // Simple skeleton or placeholder while checking DB/Network
        return <div className={`bg-zinc-800 animate-pulse ${className}`} />;
    }

    return (
        <img
            src={imageSrc || src}
            alt={alt}
            className={`${className} transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
            onClick={onClick}
            draggable={false}
        />
    );
}
