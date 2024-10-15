const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser'); 
const authMiddleware = require('../middlewares/authMiddleware'); // Middleware to check authentication
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(cookieParser());
app.use(bodyParser.json()); // Correctly parse incoming JSON requests
require('dotenv').config();
const url = process.env.MONGO_URL
const client = new MongoClient(url);
const dbName = 'HTM';

// Add a new review for a product
router.post('/add-review', authMiddleware, async (req, res) => {
    const { productId, comment, rating } = req.body;

    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'User is not authenticated' });
        }
        await client.connect();
        const db = client.db(dbName);
        const reviewsCollection = db.collection('reviews');

        // Create a new review object
        const newReview = {
            productId: new ObjectId (`${productId}`),
            userId: new ObjectId (`${user.id}`), // Assuming user.id is available from authMiddleware
            comment,
            rating: parseFloat(rating),
            createdAt: new Date()
        };

        // Insert the review into the reviews collection
        const result = await reviewsCollection.insertOne(newReview);
        res.status(201).json({ message: 'Review added successfully', result });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error adding review', error: e.message });
    } finally {
        await client.close();
    }
});

// Fetch all reviews for a product
router.get('/reviews/:productId', async (req, res) => {
    const { productId } = req.params;
    console.log(productId)

    try {
        await client.connect();
        const db = client.db(dbName);
        const reviewsCollection = db.collection('reviews');

        // Find all reviews for the given product ID
        const reviews = await reviewsCollection.find({productId: productId }).toArray();

        res.status(200).json({ reviews });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error fetching reviews', error: e.message });
    } finally {
        await client.close();
    }
});

// Fetch average rating for a product
router.get('/average-rating/:productId', async (req, res) => {
    const { productId } = req.params;

    try {
        await client.connect();
        const db = client.db(dbName);
        const reviewsCollection = db.collection('reviews');
        
        // Aggregate to calculate the average rating
        const result = await reviewsCollection.aggregate([
            { $match: { productId: new ObjectId(productId) } },
            { $group: { _id: "$productId", averageRating: { $avg: "$rating" } } }
        ]).toArray();

        const averageRating = result.length ? result[0].averageRating : 0;

        res.status(200).json({ averageRating });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error calculating average rating', error: e.message });
    } finally {
        await client.close();
    }
});

module.exports = router;
