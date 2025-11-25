const User = require("../model/user");

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updated = await User.findByIdAndUpdate(userId, req.body, { new: true });
    res.json({ message: "Profile updated successfully", user: updated });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
