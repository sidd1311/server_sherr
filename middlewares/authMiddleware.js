const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    
    const token = req.cookies.token;
    // console.log(token)

    if (!token) {
        // req.isAuthenticated = false
        return res.status(401).json({ message: 'Not logged in' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, 'secret-key');    
        req.user = decoded;
        // console.log(req.user)
        const email = decoded.email
        req.admin = decoded.admin
        req.role = decoded.role
        // req.isAuthenticated = true
        next(); // Proceed to the next middleware or route handler
    } catch (err) {
        // req.isAuthenticated = false
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = authMiddleware;
