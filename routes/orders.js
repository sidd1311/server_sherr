const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const url = process.env.MONGO_URL
const client = new MongoClient(url);
const dbName = 'HTM';

// Place an order from the user's cart
router.post('/place-order', authMiddleware, async (req, res) => {
    const userId = req.user.id; // Assuming user ID is set in the middleware

    try {
        await client.connect();
        const db = client.db(dbName);
        const cartCollection = db.collection('carts');
        const orderCollection = db.collection('orders');
        const productCollection = db.collection('products');

        // Fetch the user's cart
        const cart = await cartCollection.findOne({ userId });

        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ message: 'Your cart is empty' });
        }

        // Retrieve product details and calculate total price
        const productIds = cart.products.map(p => new ObjectId(`${p.productId}`));
        const products = await productCollection.find({ _id: { $in: productIds } }).toArray();

        let totalAmount = 0;
        const orderItems = cart.products.map(cartItem => {
            const product = products.find(p => p._id.equals(cartItem.productId));
            if (product) {
                totalAmount += product.price * cartItem.quantity;
                return {
                    productId: product._id,
                    title: product.title,
                    price: product.price,
                    quantity: cartItem.quantity
                };
            }
        });

        // Create a new order
        const newOrder = {
            userId,
            orderItems,
            totalAmount,
            status: 'Pending', // Default order status
            orderedAt: new Date()
        };

        // Insert the order into the orders collection
        const result = await orderCollection.insertOne(newOrder);

        // Clear the user's cart
        await cartCollection.updateOne({ userId }, { $set: { products: [] } });

        res.status(201).json({ message: 'Order placed successfully', orderId: result.insertedId });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error placing order', error: e.message });
    } finally {
        await client.close();
    }
});

// Fetch the user's orders
router.get('/orders', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    try {
        await client.connect();
        const db = client.db(dbName);
        const orderCollection = db.collection('orders');

        // Fetch orders for the user
        const orders = await orderCollection.find({ userId }).toArray();

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: 'No orders found' });
        }

        res.status(200).json(orders);
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error fetching orders' });
    } finally {
        await client.close();
    }
});

// Cancel an order (if required)
router.delete('/cancel-order/:orderId', authMiddleware, async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user.id;

    try {
        await client.connect();
        const db = client.db(dbName);
        const orderCollection = db.collection('orders');

        // Find and cancel the order (you can define cancellation logic, like changing status)
        const order = await orderCollection.findOne({ _id: new ObjectId(orderId), userId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'Pending') {
            return res.status(400).json({ message: 'Only pending orders can be canceled' });
        }

        await orderCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { status: 'Canceled' } }
        );

        res.status(200).json({ message: 'Order canceled successfully' });
    } catch (e) {
        console.log(`Error: ${e}`);
        res.status(500).json({ message: 'Error canceling order', error: e.message });
    } finally {
        await client.close();
    }
});

module.exports = router;
