const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const path = require('path');

// Create the Express app
const app = express();
app.use(cookieParser());

// Import your routes
const registerRoute = require('./routes/register');
const loginRoute = require('./routes/login');
const checkRoute = require('./routes/check-middle');
const fpswrd = require('./routes/forgot-password');
const discussionRoute = require('./routes/discussion');
const productRoute = require('./routes/addproducts');
const prescRoute = require('./routes/prescriptionhistory');
const reviewRoute = require('./routes/review-product');
const cartRoute = require('./routes/cart');
const appointmentRoute = require('./routes/doctor-available');
const face_model = require('./routes/face-detection-model')
const orderRoute = require('./routes/orders')
const healthRoute = require('./routes/health')
const analyticRoute = require('./routes/analytics')
// Import chatRouter and server
const { router: chatRouter, server: chatServer } = require('./routes/chatting');

// Middleware to parse JSON and form-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Use the defined routes
app.use('/', registerRoute, loginRoute, orderRoute, cartRoute, appointmentRoute, checkRoute, fpswrd,  productRoute, prescRoute, reviewRoute);
app.use('/discuss', discussionRoute)
app.use('/aiface', face_model)

// Use the chatRouter for chat-related routes
app.use('/chat', chatRouter);
app.use('/ht', healthRoute, analyticRoute)
// Create the HTTP server with Socket.io (pass the app here)
const httpServer = http.createServer(app);

// Listen on a port
httpServer.listen(5000, () => {
  console.log('Server running on port 5000');
});
