import Dexie from 'dexie';

export const db = new Dexie('SliderAppDB');

db.version(1).stores({
    images: 'id, url, blob, timestamp' // Primary key and indexed props
});

// Helper to save image blob
export const cacheImage = async (id, url, blob) => {
    try {
        await db.images.put({
            id,
            url,
            blob,
            timestamp: Date.now()
        });
    } catch (error) {
        console.warn('Failed to cache image:', error);
    }
};

// Helper to get image blob
export const getCachedImage = async (id) => {
    try {
        return await db.images.get(id);
    } catch (error) {
        return null;
    }
};
