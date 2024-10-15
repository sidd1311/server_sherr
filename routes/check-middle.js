const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/authMiddleware')
const cookieParser = require('cookie-parser');

var app = express()
app.use(cookieParser()); 

router.get('/new', authMiddleware, async(req, res) => {
    try{
        const admin = req.admin
        if(!admin){
        return res.json({message: "tu nhi dekh skta"})            
        }
        res.json({message : `Lund pada hai Yahan, ${JSON.stringify(req.user)}`})
    }catch(e){
        res.json({message: "gadbad hai yaar", e})
    }
})

module.exports = router