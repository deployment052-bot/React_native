const jwt = require("jsonwebtoken");
const User = require("../model/user");

// 🔐 Verify JWT
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) return res.status(401).json({ message: "Not authorized, token missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};


exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: `Access denied for role: ${req.user.role}` });
    }
    next();
  };
};
