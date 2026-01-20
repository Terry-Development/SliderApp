const cloudinary = require('cloudinary').v2;
const https = require('https');

// Helper to download JSON via HTTPS
// Returns empty array [] if 404 or error, to behave like "empty file"
const download = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 404) {
                // File doesn't exist yet
                return resolve([]);
            }
            if (res.statusCode !== 200) {
                // Some other error
                return reject(new Error(`Cloudinary returned HTTP ${res.statusCode}`));
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    // Try to parse the content
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.warn('[CloudinaryStorage] JSON parse error, returning empty array.', e);
                    resolve([]);
                }
            });
        }).on('error', (err) => {
            console.error('[CloudinaryStorage] Network error:', err);
            resolve([]); // Fallback to safe empty
        });
    });
};

/**
 * Reads a JSON file from Cloudinary "Raw" storage.
 * @param {string} filename - The public_id (e.g., 'reminders.json')
 */
async function readJson(filename) {
    // Generate URL. We pass secure:true.
    // We do NOT use versioning in the URL usage here usually, but caching can be an issue.
    // Cloudinary raw files are cached heavily. We append a timestamp '?t=...' to bypass CDN.
    const url = cloudinary.url(filename, { resource_type: 'raw', secure: true });
    const cacheBustedUrl = `${url}?t=${Date.now()}`;

    // console.log(`[CloudinaryStorage] Reading ${filename} from ${cacheBustedUrl}`);
    return await download(cacheBustedUrl);
}

/**
 * Writes (Uploads) a JSON object to Cloudinary "Raw" storage.
 * @param {string} filename - The public_id
 * @param {object} data - The data to jsonify and save
 */
async function writeJson(filename, data) {
    return new Promise((resolve, reject) => {
        const jsonString = JSON.stringify(data, null, 2);

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                public_id: filename,
                resource_type: 'raw',
                overwrite: true,
                invalidate: true // Tell CDN to flush cache
            },
            (error, result) => {
                if (error) {
                    console.error(`[CloudinaryStorage] Upload failed for ${filename}:`, error);
                    reject(error);
                } else {
                    // console.log(`[CloudinaryStorage] Saved ${filename} v${result.version}`);
                    resolve(result);
                }
            }
        );

        // Write content to stream
        uploadStream.end(Buffer.from(jsonString));
    });
}

module.exports = { readJson, writeJson };
