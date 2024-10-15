const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { MongoClient, ObjectId } = require('mongodb');

require('dotenv').config();
const url = process.env.MONGO_URL;
const client = new MongoClient(url);
const dbName = 'HTM';

// Health Form Submission Route
router.post('/api/health', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const skinType = req.user.skinType; // Assuming skinType is available in the user's info
    const formData = req.body;

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('healthData');

        const healthRecord = {
            userId: new ObjectId(userId),
            skinType,

            ...formData,
            createdAt: new Date()
        };

        const result = await collection.insertOne(healthRecord);
        res.status(201).json({ message: 'Health data stored successfully', result });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(400).json({ message: 'Error storing health data', error: e.message });
    } finally {
        await client.close();
    }
});



module.exports = router;
