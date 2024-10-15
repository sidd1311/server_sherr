        const express = require('express');
        const router = express.Router();
        const authMiddleware = require('../middlewares/authMiddleware');
        const { MongoClient, ObjectId } = require('mongodb');
        const axios = require('axios'); // Import axios
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
                const prescriptionsCollection = db.collection('prescriptions');
                const aiAnalysisCollection = db.collection('aihealthanalysis');
                const prescriptions = await prescriptionsCollection.find({ userId: new ObjectId(`${userId}`) }).toArray();
        
                const healthRecord = {
                    userId: new ObjectId(`${userId}`),
                    skinType,
                    ...formData,
                    createdAt: new Date(),
                };
        
                const message = `Analyze the following user data to provide personalized skin health suggestions: 
                Form Data: ${JSON.stringify(formData)}
                Skin Type: ${skinType}
                Prescription History: ${JSON.stringify(prescriptions)}`;
        
                const dataForAI = {
                    message, // The formatted string
                };
        
                const aiResponse = await axios.post('https://admiring-lamarr-charming.lemme.cloud/api/ed30d674-0ae7-4d5f-ad9c-6ce54bf02b8d', dataForAI, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
        
                console.log('AI Response:', aiResponse); 
                const aiResult = aiResponse.data;
                await collection.insertOne({healthRecord})
                // Uncomment the below line when ready to save to the database
                await aiAnalysisCollection.insertOne({ userId: new ObjectId(`${userId}`), date: new Date(), analysis: aiResult });
        
                res.status(201).json({ message: 'Success', analysis: aiResult });
            } catch (e) {
                console.log(`Error: ${e}`);
                res.status(400).json({ message: 'Error storing health data', error: e.message });
            } finally {
                await client.close();
            }
        });

        router.get('/api/health/depthanalysis', authMiddleware, async(req, res) => {
            const userId = req.user.id;   
            try{    
                await client.connect();
                const db = client.db(dbName);
                const collection = db.collection('aihealthanalysis');
                const depthanalysis = await collection.find({ userId: new ObjectId(`${userId}`) }).toArray();
                res.status(200).json({ message: 'Success', analysis: depthanalysis });
             
            }catch(e){
                console.log(e)
                res.status(500).json({message: "Internal Server Error"})
            }
        })
        
        module.exports = router;
