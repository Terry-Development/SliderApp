export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
