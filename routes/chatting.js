const express = require('express');
const { MongoClient } = require('mongodb');
const socketIo = require('socket.io');
const http = require('http');
const authMiddleware = require('../middlewares/authMiddleware'); // Import JWT auth middleware
const { ObjectId } = require('mongodb');
const router = express.Router();

// MongoDB connection
require('dotenv').config();
const url = process.env.MONGO_URL
const client = new MongoClient(url);
const dbName = 'HTM';
client.connect();
const db = client.db(dbName);
const chatRoomsCollection = db.collection('chatRooms');

// Create server and Socket.io instance
const server = http.createServer();
const io = socketIo(server, {
    cors: {
        origin: '*',
    },
});

// Book a time slot for a chat session (Authenticated Route)
        router.post('/bookTimeSlot', authMiddleware, async (req, res) => {
            console.log(req.user)
            const { startTime, endTime, doctorId } = req.body; // No need for userId and doctorId from body
            const userId = req.user.id; // Extract from decoded JWT

            // Create new chat room with the booked time slot
            const newChatRoom = {
                userId,
                doctorId,
                messages: [],
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                status: 'booked',
            };

            await chatRoomsCollection.insertOne(newChatRoom);
            res.status(200).json({ message: 'Time slot booked successfully', newChatRoom });
        });

router.get('/getRoom', authMiddleware, async (req, res) => {
    const id = req.user.id;

    try {
        // Find rooms where either doctorId or userId matches the ID
        const rooms = await chatRoomsCollection.find({
            $or: [
                { doctorId: id },
                { userId: id }
            ]
        }).toArray();

        // Check if the array is empty
        if (rooms.length === 0) {
            return res.status(404).json({ message: "No Room Found" });
        }

        // Send the found rooms as the response
        res.json(rooms);
    } catch (error) {
        console.error(error); // Log error for debugging
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Join the chat room based on the time slot (Authenticated Route)
router.post('/joinRoom', authMiddleware, async (req, res) => {
    const { roomId } = req.body; // Room ID to join
    const { id: userId, role } = req.user; // Extract userId and role from JWT

    try {
        // Convert roomId to ObjectId for MongoDB query
        const roomObjectId = new ObjectId(`${roomId}`);

        // Fetch the room based on the room ID
        const currentRoom = await chatRoomsCollection.findOne({ _id: roomObjectId });

        if (!currentRoom) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const { userId: roomUserId, doctorId: roomDoctorId, startTime, endTime } = currentRoom;

        // Check if the user is authorized to access this room
        const isAuthorized = (role === 'user' && roomUserId === userId) ||
            (role === 'doctor' && roomDoctorId === userId);

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized to join this room' });
        }

        // Check if the current time is within the booked time slot
        const currentTime = new Date();
        if (currentTime >= new Date(startTime) && currentTime <= new Date(endTime)) {
            res.json({ messages: currentRoom.messages });
        } else if (currentTime > new Date(endTime)) {
            res.json({ error: 'Session expired' });
        } else if (currentTime < new Date(startTime)) {
            res.json({ error: 'Session not started yet' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Har Message ke sath Room Id Jaegi
// Send message during the chat session (Authenticated Route)
router.post('/sendMessage', authMiddleware, async (req, res) => {
    const { message, roomId } = req.body; // Added `sentBy` to identify the sender
    const { id: userId, role } = req.user; // Extract userId and role from JWT
    // Convert roomId to ObjectId for MongoDB query
    const roomObjectId = new ObjectId(`${roomId}`);

    // Fetch the room based on the room ID
    const currentRoom = await chatRoomsCollection.findOne({ _id: roomObjectId });

    if (!currentRoom) {
        return res.status(404).json({ error: 'Room not found' });
    }

    const { userId: roomUserId, doctorId: roomDoctorId, startTime, endTime } = currentRoom;

    // Check if the user is authorized to access this room
    const isAuthorized = (role === 'user' && roomUserId === userId) ||
        (role === 'doctor' && roomDoctorId === userId);

    if (!isAuthorized) {
        return res.status(403).json({ error: 'Unauthorized to join this room' });
    }


    try {
        // Check if session is active
        const currentTime = new Date();
        if (currentTime >= new Date(startTime) && currentTime <= new Date(endTime)) {
            const newMessage = { message, timestamp: new Date(), sentBy: role };

            // Update the room with the new message
            await chatRoomsCollection.updateOne(
                { _id: roomObjectId },
                { $push: { messages: newMessage } }
            );

            // Emit the new message to the room via Socket.io
            io.to(`${roomUserId}-${roomDoctorId}`).emit('newMessage', newMessage);
            res.json({ message: 'Message sent successfully' });
        } else {
            res.status(403).json({ error: 'Session is not active' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});// Socket.io connection for real-time messaging (Authenticated based on the room)
io.on('connection', (socket) => {
    socket.on('joinRoom', async ({ userId, doctorId }) => {
        const room = `${userId}-${doctorId}`;
        socket.join(room);

        const currentRoom = await chatRoomsCollection.findOne({ userId, doctorId });

        // Check if the time slot is valid for joining
        const currentTime = new Date();
        if (currentRoom && currentTime >= new Date(currentRoom.startTime) && currentTime <= new Date(currentRoom.endTime)) {
            socket.emit('chatHistory', currentRoom.messages);
        } else {
            socket.emit('sessionExpired');
        }
    });

    socket.on('sendMessage', async ({ userId, doctorId, message, sentBy }) => {
        const room = `${userId}-${doctorId}`;
        const currentRoom = await chatRoomsCollection.findOne({ userId, doctorId });

        if (new Date() >= new Date(currentRoom.startTime) && new Date() <= new Date(currentRoom.endTime)) {
            const newMessage = { message, timestamp: new Date(), sentBy };
            await chatRoomsCollection.updateOne(
                { userId, doctorId },
                { $push: { messages: newMessage } }
            );
            io.to(room).emit('newMessage', newMessage);
        } else {
            socket.emit('sessionExpired');
        }
    });
});

// Export the router and server
module.exports = { router, server };
