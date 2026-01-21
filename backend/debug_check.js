const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Should find .env in current dir (backend)

// Configure Cloudinary explicitly (like server.js)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function debugCloudinary() {
    console.log('--- Cloudinary Debug Tool ---');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? 'OK' : 'MISSING');

    // Config check
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
        console.error('ERROR: Missing CLOUDINARY_ env vars. Cannot connect.');
        return;
    }

    try {
        console.log('\n1. Listing Root Folders...');
        try {
            // Checking root folders
            const rootFolders = await cloudinary.api.root_folders();
            console.log('Root Folders:', rootFolders.folders.map(f => f.name));
        } catch (e) { console.log('Error listing root folders (might be permission):', e.message); }

        console.log('\n2. Listing Resources in "photo-slider-app/"...');
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: 'photo-slider-app/',
            context: true,
            max_results: 5,
            direction: 'desc'
        });

        console.log(`Found ${result.resources.length} images.`);
        if (result.resources.length > 0) {
            console.log('Newest Image:', {
                id: result.resources[0].public_id,
                created: result.resources[0].created_at
            });
        } else {
            console.log('No images found in prefix "photo-slider-app/".');
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
    }
}

debugCloudinary();
