require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('Testing Cloudinary Connection...');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);

cloudinary.api.ping((error, result) => {
    if (error) {
        console.error('❌ Connection Failed:', error.message);
        if (error.http_code === 401) {
            console.error('>> Your API Key or Secret is wrong.');
        } else if (error.http_code === 404) {
            console.error('>> Your Cloud Name "Root" seems wrong (it usually looks like "dxyjv..." or "demo").');
        }
    } else {
        console.log('✅ Connection Successful!', result);
    }
});
