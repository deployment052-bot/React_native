const express = require("express");
const router = express.Router();

const {
  forgotPassword,
  verifyOTP,
  resetPassword,
} = require("../controllers/forgetpassword");


router.post("/forgot-password", forgotPassword);


router.post("/verify-otp", verifyOTP);


router.post("/reset-password", resetPassword);

module.exports = router;
