const express = require('express');
const bodyParser = require('body-parser');
const { sendOTP, verifyOTP } = require('../controllers/Otpcontroller');
const router = express.Router();
require('dotenv').config();


router.use(bodyParser.json());

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

module.exports = router;
