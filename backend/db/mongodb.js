const { MongoClient } = require('mongodb');

let client = null;
let db = null;

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

        db = client.db('sliderapp');
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
    closeDatabase
};
