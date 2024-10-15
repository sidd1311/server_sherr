const express = require('express');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const validator = require('validator');
const router = express.Router();
const saltRounds = 10; // Define salt rounds for bcrypt hashing
require('dotenv').config();
const url = process.env.MONGO_URL //Initializaing Mongo Client
const client = new MongoClient(url);
const dbName = 'HTM';

// Email Transport Initialization
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
      user: process.env.GMAIL_USER, 
      pass: process.env.GMAIL_PASS   
    }
  });

router.post('/forgot-password', async(req, res) =>{
    const { email } = req.body
    if (!validator.isEmail(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');
        const user = await collection.findOne({ email });
    
        if (!user) {
          return res.render('forgot-password', { message: 'Email not found' });
        }
    
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedResetToken = await bcrypt.hash(resetToken, 10);
        const resetTokenExpiry = Date.now() + 3600000;
    
        await collection.updateOne(
          { email },
          { $set: { resetToken: hashedResetToken, resetTokenExpiry } }
        );
    
          // Send reset email
    const resetUrl = `${process.env.Hosted_URL}/reset-password?token=${resetToken}&email=${email}"`;
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Password Reset',
      html: `<p>Click the following link to reset your password:</p><p><a href="${resetUrl}">Click Here</a></p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        return res.status(400).json({ message: 'Error sending email' });
      }
      res.status(200).json({ message: 'Password reset link sent to your email' });
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
     
})


router.post('/reset-password', async(req, res) => {
    const { token, email } = req.query;
    const {password, confrmpass} = req.body
    console.log(`Token: ${token}, Email: ${email}`)

 
    if (password !== confrmpass) {
        return res.status(400).json({ token, email, message: 'Passwords do not match' });
      }
    
      if (!validator.isLength(password, { min: 8 })) {
        return res.statusMessage(400).json({ token, email, message: 'Password must be at least 8 characters long' });
      }
    
      try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');
        const user = await collection.findOne({ email });
        if (!user || !user.resetToken || !user.resetTokenExpiry) {
            return res.status(400).json( { token, email, message: 'Invalid or expired reset token' });
          }
      
          const isTokenValid = await bcrypt.compare(token, user.resetToken);
      
          if (!isTokenValid || Date.now() > user.resetTokenExpiry) {
            return res.status(400).json( { token, email, message: 'Invalid or expired reset token' });
          }
      
          const hashedPassword = await bcrypt.hash(password, 10);
      
      await collection.updateOne(
          { email },
          { $set: { password: hashedPassword }, $unset: { resetToken: "", resetTokenExpiry: "" } }
        );
    
        res.status(200).json({message: "Password Changed"})
      } catch (error) {
        console.error(error);
        res.status(400).json({ token, email, message: 'Internal server error' });
      } finally {
        await client.close();
      }

})

module.exports = router