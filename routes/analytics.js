const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

require('dotenv').config();
const url = process.env.MONGO_URL;
const client = new MongoClient(url);
const dbName = 'HTM';

// Fetch Historical Data
router.get('/api/health/history', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('healthData');

        const healthData = await collection.find({ userId: new ObjectId(`${userId}`) })
                                           .sort({ createdAt: 1 }) // Sort by date
                                           .toArray();

        res.status(200).json(healthData);
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(400).json({ message: 'Error fetching health data', error: e.message });
    } finally {
        await client.close();
    }
});

module.exports = router;
