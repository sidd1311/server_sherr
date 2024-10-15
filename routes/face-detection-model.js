const express = require("express");
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const TeachableMachine = require("@sashido/teachablemachine-node");
const authMiddleware = require('../middlewares/authMiddleware'); // Authentication middleware
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

require('dotenv').config();

const url = process.env.MONGO_URL; // Initialize Mongo Client
const client = new MongoClient(url);
const dbName = 'HTM';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer to use Cloudinary for storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads', // Folder name in Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png'], // Allowed image formats
    },
});

const upload = multer({ storage: storage });

// Initialize the Teachable Machine model
const model = new TeachableMachine({
    modelUrl: process.env.MODEL_API
});

// Connect to MongoDB
async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    }
}

connectToDatabase();

// Handle image upload and classification
router.post("/image", authMiddleware, upload.single('image'), async (req, res) => {
    const imageUrl = req.file ? req.file.path : null;
    const userId = req.user.id; // Assuming `authMiddleware` adds the authenticated user's ID in `req.user`

    if (!imageUrl) {
        return res.status(400).send("No image uploaded!");
    }

    // Log the URL for debugging
    console.log(imageUrl);

    try {
        // Classify the uploaded image using the Teachable Machine model
        const predictions = await model.classify({ imageUrl: imageUrl });

        // Process the predictions to get percentages
        const processedPredictions = predictions.map(p => {
            return {
                class: p.class,
                percentage: (p.score * 100).toFixed(0) // Convert score to percentage and round
            };
        });

        // Find the major skin type (the one with a percentage > 50%)
        const majorType = processedPredictions.find(p => p.percentage > 50)?.class || null;

        // Prepare data for database
        const skinData = {
            skinTypes: processedPredictions,
            majorType: majorType
        };

        // Update the user's skin type in the database
        const db = client.db(dbName);
        const collection = db.collection('users'); // Assuming user data is stored in the 'users' collection

        const result = await collection.updateOne(
            { _id: new ObjectId(`${userId}`) },
            { $set: { skinType: skinData } }
        );  

        if (result.modifiedCount === 0) {
            return res.status(500).send("Failed to update user data in the database!");
        }

        // Send response with the processed predictions and major type
        res.json({
            skinTypes: processedPredictions,
            majorType: majorType
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Something went wrong during classification!");
    }
});

module.exports = router;
