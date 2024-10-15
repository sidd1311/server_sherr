const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/authMiddleware')
const cookieParser = require('cookie-parser');
const { MongoClient} = require('mongodb');
const { ObjectId } = require('mongodb');
const app = express()
app.use(cookieParser()); 
require('dotenv').config();
const url = process.env.MONGO_URL //Initializaing Mongo Client
const client = new MongoClient(url);
const dbName = 'HTM';

router.get('/get-message', async(req, res) => {
    try{
        await client.connect()
        const db = client.db(dbName);
        const collection = db.collection('discussion-messages');
        const messages = await collection.find({}, { projection: { content: 1, createdAt: 1, upvotes: 1, downvotes: 1 } })
            .sort({ createdAt: -1 })
            .toArray();  
        res.status(200).json({messages})

    }catch(e){
        console.log(`Error: ${e}`)
        res.status(400).json({message: 'Error Fetching Messages'})
    }
})

router.post('/send-message', authMiddleware, async(req, res) => {
    try{
        const { message } = req.body;
        const userId = req.user.id;
        await client.connect()
        const db = client.db(dbName);
        const collection = db.collection('discussion-messages');
        const result = await collection.insertOne({ content: message, userId, upVotes: 0, downVotes: 0,   votes: [],    createdAt: new Date() });
        res.status(200).json({message: 'Message Sent', result})


    }catch(e){
        console.log(`Error : ${e}`)
        res.status(400).json({message: 'Error Sending Message'})
    }
})

// Upvote a message
router.post('/upvote', authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.body; 
        const userId = req.user.id; 
        await client.connect();
        const db = client.db(dbName);   
        const collection = db.collection('discussion-messages');
        console.log(messageId)
        // Check if the user has already voted
        const message = await collection.findOne({ _id: new ObjectId(`${messageId}`) });

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const hasVoted = message.votes.some(vote => vote.userId === userId);
        if (hasVoted) {
            return res.status(403).json({ message: 'User has already voted' });
        }

        // Increment the upvotes count and add the user's vote to the votes array
        const result = await collection.updateOne(
            { _id: new ObjectId(`${messageId}`) },
            {
                $inc: { upVotes: 1 },
                $push: { votes: { userId, type: 'upVote' } } // Add the user's vote to the votes array
            }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ message: 'Message upvoted successfully' });
        } else {
            res.status(404).json({ message: 'Message not found' });
        }
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(400).json({ message: 'Error upvoting message' });
    }
});

// Downvote a message
router.post('/downvote', authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.body; // Message ID to be downvoted
        const userId = req.user.id; // Get the logged-in user's ID

        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('discussion-messages');

        // Check if the user has already voted
        const message = await collection.findOne({ _id: new ObjectId(`${messageId}`) });

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const hasVoted = message.votes.some(vote => vote.userId === userId);
        if (hasVoted) {
            return res.status(403).json({ message: 'User has already voted' });
        }

        // Increment the downvotes count and add the user's vote to the votes array
        const result = await collection.updateOne(
            { _id: new  ObjectId(`${messageId}`)},
            {
                $inc: { downVotes: 1 },
                $push: { votes: { userId, type: 'downVote' } } // Add the user's vote to the votes array
            }
        );

        if (result.modifiedCount === 1) {
            res.status(200).json({ message: 'Message downvoted successfully' });
        } else {
            res.status(404).json({ message: 'Message not found' });
        }
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(400).json({ message: 'Error downvoting message' });
    }
});

module.exports = router
