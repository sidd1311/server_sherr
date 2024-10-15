const express = require('express'); // Import express module
const validator = require('validator'); // Import validator module for email and password validation
const bcrypt = require('bcrypt'); // Import bcrypt for hashing passwords
const { MongoClient } = require('mongodb'); 
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const router = express.Router(); // Create a new router instance
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

router.post('/register', async(req, res)=>{
   const {email, name, username, phone, password, cnfrm_password} = req.body


   //All types of Validators
   if(password !== cnfrm_password){
    return res.status(202).json({message: 'Passwords Do Not Match'})
   }

  if (!validator.isEmail(email)) {
    return res.json( { message: 'Invalid email format' });
  }
  if(!validator.isLength(phone, {min: 10, max: 10})){
    return res.json({message: 'Phone Number must be of 10 Digits'})
  }

  if (!validator.isLength(password, { min: 8 })) {
    return res.json( { message: 'Password must be at least 8 characters long' });
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/g.test(password)) {
    return res.json( { message: 'Password must contain at least one special character' });
  }
  if (!/[A-Z]/g.test(password)) {
    return res.json( { message: 'Password must contain at least one Uppercase Letter' });
  }
  if (!/[a-z]/g.test(password)) {
    return res.json( { message: 'Password must contain at least one Lowercase Letter' });
  }
  if (!/[0-9]/g.test(password)) {
    return res.json( { message: 'Password must contain at least one Number' });
  }

  try{
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('users');
    const existUsermail  = await collection.findOne({ email });

    if(existUsermail){
        return res.status(400).json({message : 'User Already Exist'})
    }
    const existUserphone  = await collection.findOne({ Mobile: phone });
    
    if(existUserphone){
        return res.status(400).json({message : 'Mobile Number Already Registered'})
    }
    const existUsername  = await collection.findOne({ username: username });
    
    if(existUsername){
        return res.status(400).json({message : 'Username Already Taken'})
    }

        const confirmationToken = crypto.randomBytes(32).toString('hex');
        

    const hashedPswrd = await bcrypt.hash(password, saltRounds)

    //Schema for the registering of New User
    await collection.insertOne({
        email : email, 
        name : name, 
        username : username, 
        Mobile: phone, 
        password: hashedPswrd,
        confirmationToken: confirmationToken,
        isActive: false,
        isAdmin: false,
        role : "user",
    })

    // Sending Mails
    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Account Confirmation',
        html: `<h3>Dear ${name},</h3>
               <p>Please confirm your account by clicking the link below:</p>
               <a href="${process.env.Hosted_URL}/register/confirm/${confirmationToken}">Confirm Account</a>`
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ message: 'Error sending email', messageType: 'danger' });
        }
        res.status(200).json({ message: 'Signup successful! Please check your email for confirmation.', messageType: 'success' });
      });


  }catch(e){
    console.log(`Error: ${e}`)
    res.status(500).json({ message: 'Internal server error'});
  }
  finally {
    await client.close();
  }


})


// Confirmation by Mail 
router.get('/register/confirm/:token', async(req, res) => {
    const {token} = req.params;
    try{
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users')
        const user =  await collection.findOne({ confirmationToken: token });

    if (!user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

        await collection.updateOne({ confirmationToken: token }, { $set: { isActive: true }, $unset: { confirmationToken: "" } });
        res.status(200).json({ message: 'Account confirmed successfully! You can now log in.' });
    }
    catch(e){
        console.log(`Error : ${e}`)
        res.status(500)/json({message : 'Server Error'})
    }
    finally {
        await client.close();
      } 
})

module.exports = router
