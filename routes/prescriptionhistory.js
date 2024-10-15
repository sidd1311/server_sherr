const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cookieParser());

require('dotenv').config();
const url = process.env.MONGO_URL; // Initializing Mongo Client
const client = new MongoClient(url);
const dbName = 'HTM';

// 1. Add Prescription (Doctor Side)
router.post('/add-prescription', authMiddleware, async (req, res) => {
    const { userId, prescription } = req.body;
    const doctorId = req.user.id;

    if (req.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied. You are not a doctor.' });
    }

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('prescriptions');
        const newPrescription = {
            userId : new ObjectId (`${userId}`),
            prescription,
            doctorId : new ObjectId (`${doctorId}`),
            docName: req.user.name,
            createdAt: new Date()
        };
        const result = await collection.insertOne(newPrescription);
        res.status(201).json({ message: 'Prescription Added Successfully', result });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(400).json({ message: 'Error adding prescription', error: e.message });
    } finally {
        await client.close();
    }
});

// 2. Get Prescriptions (User Side)
router.get('/prescription', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('prescriptions');

        const prescriptions = await collection.find({ userId: userId }).sort({ createdAt: -1 }).toArray();

        res.status(200).json({ prescriptions });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(400).json({ message: 'Error fetching prescriptions', error: e.message });
    } finally {
        await client.close();
    }
});

module.exports = router;
