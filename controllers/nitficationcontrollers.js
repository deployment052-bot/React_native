
const mongoose= require('mongoose')
const Notification = require("../model/Notification");


exports.sendNotification = async (userId, role, title, message, type = "info", link = "") => {
  try {
    const notification = new Notification({
      user: userId,
      role,
      title,
      message,
      type,
      link,
    });
    await notification.save();
        await User.findByIdAndUpdate(
      userId,
      { $inc: { notificationCount: 1 } }
    );
    return notification;
  } catch (err) {
    console.error(" Notification Error:", err);
  }
};

exports.markNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

   
    await Notification.updateMany(
      { user: userId, read: false },
      { $set: { read: true } }
    );

    
    await User.findByIdAndUpdate(
      userId,
      { $set: { notificationCount: 0 } }
    );

    res.json({ message: "Notifications marked as read." });
  } catch (err) {
    console.error("Mark Read Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};