const nodemailer = require("nodemailer");
const crypto = require("crypto");
const User = require("../model/user"); 


exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });


    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    
    const otp = crypto.randomInt(100000, 999999).toString();

    
    user.emailOTP = otp;
    user.emailOTPExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

   
    const transporter = nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      auth: {
        user: "apikey", 
        pass: process.env.SENDGRID_API_KEY, 
      },
    });

    
    const mailOptions = {
      from: `"One Step Solution" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
    };

    
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "OTP sent successfully!" });
  } catch (err) {
    console.error("Send OTP Error:", err);
    res.status(500).json({ message: "Error sending OTP" });
  }
};


exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.emailOTP || user.emailOTP !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (user.emailOTPExpires < Date.now())
      return res.status(400).json({ message: "OTP expired" });

    
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    await user.save();

    res.status(200).json({ message: "OTP verified successfully!" });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
