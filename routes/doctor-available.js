const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');

const app = express();
app.use(cookieParser());

require('dotenv').config();
const url = process.env.MONGO_URL; // MongoDB URL
const client = new MongoClient(url);
const dbName = 'HTM';

// Email configuration using Nodemailer
const transporter = nodemailer.createTransport({
    service: 'Gmail', // You can use any email service
    auth: {
        user: process.env.GMAIL_USER, // Your email
        pass: process.env.GMAIL_PASS   // Your email password
    }
});

// 1. View Availability Schedule (Doctor Side)
router.get('/availability', authMiddleware, async (req, res) => {
    const doctorId = req.user.id;
    
    if (req.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied. You are not a doctor.' });
    }
    
    try {
        await client.connect();
        const db = client.db(dbName);
        const doctorsCollection = db.collection('users');

        const doctor = await doctorsCollection.findOne({ _id: new ObjectId(`${doctorId}`) });

        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        res.status(200).json({ availability: doctor.availability });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error fetching availability' });
    } finally {
        await client.close();
    }
});

// 2. Add Availability Slots (Doctor Side)
router.post('/availability/add', authMiddleware, async (req, res) => {
    const { date, time } = req.body;
    const doctorId = req.user.id;
    const timeSlots = time.split(',').map(slot => slot.trim());

    if (req.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied. You are not a doctor.' });
    }

    try {
        await client.connect();
        const db = client.db(dbName);
        const doctorsCollection = db.collection('doctors');

        await doctorsCollection.updateOne(
            { _id: new ObjectId(`${doctorId}`) },
            { $push: { availability: { date, time: timeSlots } } },
            { upsert: true }
        );

        res.status(200).json({ message: 'Availability slots added successfully' });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error adding availability slots' });
    } finally {
        await client.close();
    }
});

// 3. Book an Appointment (User Side)
router.post('/book-appointment', authMiddleware, async (req, res) => {
    const { doctorId, date, time } = req.body;
    const userId = req.user.id;

    try {
        await client.connect();
        const db = client.db(dbName);
        const appointmentsCollection = db.collection('appointments');
        const doctorsCollection = db.collection('doctors');

        // Check if the slot is already booked
        const existingAppointment = await appointmentsCollection.findOne({ doctorId, date, time });

        if (existingAppointment) {
            return res.status(400).json({ message: 'This time slot is already booked. Please choose another slot.' });
        }

        // Create a new appointment
        const newAppointment = {
            userId,
            doctorId,
            date,
            time,
            status: 'Pending',
            createdAt: new Date()
        };

        // Insert the appointment
        const result = await appointmentsCollection.insertOne(newAppointment);

        // Remove the booked slot from the doctor's availability
        await doctorsCollection.updateOne(
            { _id: new ObjectId(`${doctorId}`), 'availability.date': date },
            { $pull: { 'availability.$.time': time } }
        );

        res.status(201).json({ message: 'Appointment booked successfully', appointmentId: result.insertedId });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error booking appointment' });
    } finally {
        await client.close();
    }
});

// 4. Confirm Appointment (Doctor Side)
router.post('/confirm-appointment', authMiddleware, async (req, res) => {
    const { appointmentId } = req.body;
    const doctorId = req.user.id;

    if (req.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied. You are not a doctor.' });
    }

    try {
        await client.connect();
        const db = client.db(dbName);
        const appointmentsCollection = db.collection('appointments');

        // Find the appointment
        const appointment = await appointmentsCollection.findOne({ _id: ObjectId(appointmentId), doctorId });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Update appointment status to confirmed
        await appointmentsCollection.updateOne(
            { _id: ObjectId(appointmentId) },
            { $set: { status: 'Confirmed' } }
        );

        // Fetch user email
        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ _id: ObjectId(appointment.userId) });

        // Send email notification
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: user.email,
            subject: 'Appointment Confirmation',
            text: `Your appointment with Doctor ${doctorId} has been confirmed for ${appointment.date} at ${appointment.time}.`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(`Error sending email: ${error}`);
            } else {
                console.log(`Email sent: ${info.response}`);
            }
        });

        res.status(200).json({ message: 'Appointment confirmed and email sent to user' });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error confirming appointment' });
    } finally {
        await client.close();
    }
});

// 5. Withdraw Appointment (User Side)
router.post('/withdraw-appointment', authMiddleware, async (req, res) => {
    const { appointmentId } = req.body;
    const userId = req.user.id;

    try {
        await client.connect();
        const db = client.db(dbName);
        const appointmentsCollection = db.collection('appointments');

        // Find the appointment and check if it belongs to the user
        const appointment = await appointmentsCollection.findOne({ _id: ObjectId(appointmentId), userId });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found or unauthorized' });
        }

        // Update appointment status to withdrawn
        await appointmentsCollection.updateOne(
            { _id: ObjectId(appointmentId) },
            { $set: { status: 'Withdrawn' } }
        );

        res.status(200).json({ message: 'Appointment withdrawn successfully' });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error withdrawing appointment' });
    } finally {
        await client.close();
    }
});

// 6. Close Appointment (Doctor Side)
router.post('/appointments/close', authMiddleware, async (req, res) => {
    const { appointmentId } = req.body;
    const doctorId = req.user.id;

    if (req.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied. You are not a doctor.' });
    }

    try {
        await client.connect();
        const db = client.db(dbName);
        const appointmentsCollection = db.collection('appointments');

        const result = await appointmentsCollection.updateOne(
            { _id: ObjectId(appointmentId), doctorId: ObjectId(doctorId) },
            { $set: { status: 'Closed' } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Appointment not found or not authorized' });
        }

        res.status(200).json({ message: 'Appointment closed successfully' });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error closing appointment' });
    } finally {
        await client.close();
    }
});

// 7. Doctor Update Availability
router.post('/availability/update', authMiddleware, async (req, res) => {
    const { day, oldSlots, newSlots } = req.body;
    const doctorId = req.user.id;

    if (req.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied. You are not a doctor.' });
    }

    try {
        await client.connect();
        const db = client.db(dbName);
        const doctorsCollection = db.collection('doctors');

        const result = await doctorsCollection.updateOne(
            { _id: ObjectId(doctorId), 'availability.day': day },
            { $set: { 'availability.$.slots': newSlots } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: 'Availability not found for the specified day' });
        }

        res.status(200).json({ message: 'Availability updated successfully' });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error updating availability' });
    } finally {
        await client.close();
    }
});

module.exports = router;
