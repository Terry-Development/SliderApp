require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('Testing Cloudinary Connection...');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);

console.log('Testing Cloudinary Admin API (Resources) with Server params...');
cloudinary.api.resources({
    type: 'upload',
    prefix: 'photo-slider-app/',
    context: true,
    max_results: 5,
    direction: 'desc'
}, (error, result) => {
    if (error) {
        console.error('❌ Resources Fetch Failed:', error);
        console.error('This usually means the API Key/Secret does not have "Admin API" permissions, or the credentials are for an Environment Variable that is restricted.');
    } else {
        console.log('✅ Resources Fetch Successful!', result);
    }
});
