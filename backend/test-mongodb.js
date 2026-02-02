const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testConnection() {
    console.log('Testing MongoDB connection...');
    console.log('URI:', process.env.MONGODB_URI ? 'Found in .env' : 'NOT FOUND');

    try {
        const client = new MongoClient(process.env.MONGODB_URI);
        console.log('Attempting to connect...');
        await client.connect();
        console.log('✅ SUCCESS! Connected to MongoDB');

        const db = client.db('sliderapp');
        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        await client.close();
        console.log('Connection closed successfully');
    } catch (error) {
        console.error('❌ FAILED to connect to MongoDB');
        console.error('Error:', error.message);
        console.error('\nPossible solutions:');
        console.error('1. Check if MongoDB Atlas cluster is paused');
        console.error('2. Verify network access in Atlas (add your IP)');
        console.error('3. Check if credentials are correct');
    }
}

testConnection();
