const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/authMiddleware')
const cookieParser = require('cookie-parser');
const { MongoClient} = require('mongodb');
require('dotenv').config();
const app = express()
app.use(cookieParser()); 

const url = process.env.MONGO_URL; //Initializaing Mongo Client
const client = new MongoClient(url);
const dbName = 'HTM';

router.post('/add-product', authMiddleware, async (req, res) => {
    const { title, price, description, tags, skintypefor } = req.body
    const trimmedTags = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : [];
    const trimmedType = typeof skintypefor === 'string' ? skintypefor.split(',').map(type => type.trim()) : []; try {

        const admin = req.admin
        if(!admin){
        return res.json({message: "Unauthorized to add new products"})            
        }

        await client.connect()
        const db = client.db(dbName);
        const collection = db.collection('products');
        const newProduct = {
            title,
            price,
            description,
            tags: trimmedTags,
            skintypefor: trimmedType,
            createdAt: new Date()
        };
        const result = await collection.insertOne(newProduct);
        res.status(201).json({ message: 'Product added successfully', result });

    }catch (e) {
        console.log(`Error: ${e}`);
        res.status(400).json({ message: 'Error downvoting message' });
    }

})

router.get('/products', async (req, res) => {
    try {
    
        const { tags, skintypefor } = req.query;
        let filter = {};
        if (tags) {        
            const tagsArray = tags.split(',').map(tag => tag.trim());         
            filter.tags = { $in: tagsArray };
        }

        if (skintypefor) {
            const skintypeArray = skintypefor.split(',').map(type => type.trim());    
            filter.skintypefor = { $in: skintypeArray };
        }

   
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('products');

       
        const products = await collection.find(filter).toArray();

       
        res.status(200).json({ products });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(400).json({ message: 'Error fetching products', error: e.message });
    } finally {
        
        await client.close();
    }
});


module.exports = router