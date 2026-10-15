const { MongoClient } = require('mongodb');

let client = null;
let db = null;

// Render's PR service previews inherit environment variables from production.
// They must never select the production MongoDB database, even if that name
// was inherited through MONGODB_DB_NAME.
function resolveDatabaseName() {
    if (process.env.IS_PULL_REQUEST === 'true') {
        const explicitPreviewName = String(process.env.MONGODB_PREVIEW_DB_NAME || '').trim();
        if (explicitPreviewName) {
            if (!/^sliderapp_preview_[a-z0-9_]{1,36}$/.test(explicitPreviewName)) {
                throw new Error('MONGODB_PREVIEW_DB_NAME must start with sliderapp_preview_');
            }
            return explicitPreviewName;
        }
        const service = String(process.env.RENDER_EXTERNAL_HOSTNAME || process.env.RENDER_SERVICE_NAME || 'pr')
            .split('.')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32);
        return `sliderapp_preview_${service}`;
    }
    return process.env.MONGODB_DB_NAME || 'sliderapp';
}

async function connectToDatabase() {
    if (db) {
        return db; // Return existing connection
    }

    try {
        const uri = process.env.MONGODB_URI;

        if (!uri) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        client = new MongoClient(uri);
        await client.connect();

        db = client.db(resolveDatabaseName());
        console.log('✓ Connected to MongoDB Atlas');

        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

async function getDatabase() {
    if (!db) {
        return await connectToDatabase();
    }
    return db;
}

async function closeDatabase() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log('✓ MongoDB connection closed');
    }
}

module.exports = {
    connectToDatabase,
    getDatabase,
    closeDatabase,
    resolveDatabaseName
};
