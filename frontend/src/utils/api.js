// Known preview hosts are a fallback for older static builds or deployment
// aliases. Build-time preview detection also covers new deployment hostnames.
const KNOWN_PREVIEW_BACKENDS = {
    'slider-app-git-feature-discre-f0ff94-terences-projects-72226b28.vercel.app': 'https://sliderapp-pr-2.onrender.com',
    'slider-app-git-feature-chat-s-c912ca-terences-projects-72226b28.vercel.app': 'https://sliderapp-pr-4.onrender.com',
    'slider-8j33d56sr-terences-projects-72226b28.vercel.app': 'https://sliderapp-pr-4.onrender.com'
};

const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
const knownPreviewBackend = KNOWN_PREVIEW_BACKENDS[currentHost];
const previewBuild = process.env.NEXT_PUBLIC_SLIDERAPP_PREVIEW_MODE === 'true';

export const API_URL = (previewBuild || knownPreviewBackend)
    ? (knownPreviewBackend || process.env.NEXT_PUBLIC_SLIDERAPP_PREVIEW_API_URL || '/preview-backend-not-configured')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

export const getAuthHeaders = () => {
    const password = typeof window !== 'undefined' ? localStorage.getItem('admin_password') : '';
    return {
        'Content-Type': 'application/json',
        'x-admin-password': password
    };
};

export const getOptimizedImageUrl = (url, width = 600) => {
    if (!url || !url.includes('cloudinary.com')) return url;

    // Find the 'upload/' segment and insert transformation params after it
    // Transformations: 
    // w_<width>: Resize width
    // q_auto: Automatic quality (usually highly compressed but good visual quality)
    // f_auto: Automatic format (WebP/AVIF if supported)
    // c_limit: Resize method (scale down only)
    const splitter = '/upload/';
    const parts = url.split(splitter);

    if (parts.length !== 2) return url;

    return `${parts[0]}${splitter}w_${width},q_auto,f_auto,c_limit/${parts[1]}`;
};
