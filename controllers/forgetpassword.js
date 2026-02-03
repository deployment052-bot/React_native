const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../model/user");
const sendEmail = require("../utils/sendemail");
const client = require("../utils/twillio");

exports.forgotPassword = async (req, res) => {
  try {
    const { email , phone } = req.body;
    if (!email && !phone) return res.status(400).json({ message: "Email is required." });
        
    const query = email ? { email } : { phone };
    const user = await User.findOne(query);
    if (!user)
      return res.status(404).json({ message: "No account found with this email." });

   
    const otp = crypto.randomInt(100000, 999999).toString();
   if(phone){
    user.phoneOTP = await bcrypt.hash(otp, 10);
      user.phoneOTPExpires = Date.now() + 5 * 60 * 1000;
    await user.save();
console.log("OTP:", otp);
      if(process.env.NODE_ENV !=='development'){
    await client.messages.create({
      body: `Your login OTP is ${otp}. Valid for 5 minutes.`,

      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
  }
   }
  user.emailOTP = await bcrypt.hash(otp, 10);
    user.emailOTPExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    
    const html = `
      <div style="font-family:Arial; background:#f9f9f9; padding:20px; border-radius:8px;">
        <h2 style="color:#333;">Password Reset Request</h2>
        <p>Hello <strong>${user.firstName || "User"}</strong>,</p>
        <p>Your One-Time Password (OTP) for resetting your password is:</p>
        <h1 style="background:#007bff; color:#fff; padding:10px 20px; border-radius:6px; display:inline-block;">${otp}</h1>
        <p>This OTP will expire in <b>5 minutes</b>.</p>
        <p>If you did not request this, please ignore this email.</p>
        <hr/>
        <small style="color:#888;">© One Step Solution Team</small>
      </div>
    `;

    
    await sendEmail(user.email, "Password Reset OTP - One Step Solution", html);
    console.log(` Password reset OTP sent to ${user.email}`);

    res.status(200).json({
      success:true,
      message: "OTP sent successfully to your email.",
      otp
    });
  } catch (err) {
    console.error(" Forgot Password Error:", err.message);
    res.status(500).json({
      success:false,
      message: "Server error while sending OTP.",
    });
  }
};


exports.verifyOTP = async (req, res) => {
  try {
    const { email, phone, otp } = req.body;

    if ((!email && !phone) || !otp) {
      return res.status(400).json({
        message: "Email or phone and OTP are required.",
      });
    }

    const user = email
      ? await User.findOne({ email })
      : await User.findOne({ phone });

    if (!user)
      return res.status(404).json({ message: "User not found." });

   
    if (email) {
      if (!user.emailOTP)
        return res.status(400).json({ message: "No OTP found for email." });

      if (Date.now() > user.emailOTPExpires)
        return res.status(400).json({ message: "OTP expired." });

      if (user.emailOTP !== otp)
        return res.status(400).json({ message: "Invalid OTP." });

      user.emailOTP = undefined;
      user.emailOTPExpires = undefined;
      user.isEmailVerified = true;
    }


    if (phone) {
      if (!user.phoneOTP)
        return res.status(400).json({ message: "No OTP found for phone." });

      if (Date.now() > user.phoneOTPExpires)
        return res.status(400).json({ message: "OTP expired." });

      const isMatch = await bcrypt.compare(otp, user.phoneOTP);
      if (!isMatch)
        return res.status(400).json({ message: "Invalid OTP." });

      user.phoneOTP = undefined;
      user.phoneOTPExpires = undefined;
      user.isPhoneVerified = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "OTP verified successfully.",
    });
  } catch (err) {
    console.error("Verify OTP Error:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error during OTP verification.",
    });
  }
};


exports.resetPassword = async (req, res) => {
  const { email, phone, newPassword, confirmPassword } = req.body;

  if ((!email && !phone) || !newPassword || !confirmPassword)
    return res.status(400).json({ message: "Required fields missing" });

  if (newPassword !== confirmPassword)
    return res.status(400).json({ message: "Passwords do not match" });

  const user = email
    ? await User.findOne({ email })
    : await User.findOne({ phone });

  if (!user)
    return res.status(404).json({ message: "User not found" });

  if (email && !user.isEmailVerified)
    return res.status(400).json({ message: "Email OTP not verified" });

  if (phone && !user.isPhoneVerified)
    return res.status(400).json({ message: "Phone OTP not verified" });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password reset successful",
  });
};



exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    await sendVerificationOTP(user, email, user.firstName);
    res.status(200).json({ message: "OTP resent successfully." });
  } catch (err) {
    console.error("Resend OTP Error:", err.message);
    res.status(500).json({ message: "Failed to resend OTP" });
  }
};
