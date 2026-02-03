const Notification = require("../model/Notification");
const User = require("../model/user");
const admin = require("firebase-admin");
const { io, userSockets } = require("../server"); 
exports.sendNotification = async (
  userId,
  role,
  title,
  message,
  type = "info",
  link = ""
) => {
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


    const user = await User.findById(userId).select("fcmToken");

  
    if (user?.fcmToken) {
      try {
        await admin.messaging().send({
          token: user.fcmToken,
          notification: {
            title,
            body: message,
          },
          data: {
            type,
            link,
          },
        });
      } catch (err) {
        console.error("FCM Error:", err);
        if (err.code === "messaging/registration-token-not-registered") {
          await User.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });
        }
      }
    }

 
    await User.findByIdAndUpdate(userId, {
      $inc: { notificationCount: 1 },
    });

 
    const sockets = userSockets[userId] || [];
    sockets.forEach((socketId) => {
      io.to(socketId).emit("new-notification", notification);
    });

    return notification;
  } catch (err) {
    console.error("Notification Error:", err);
  }
};

exports.markNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    // Mark all unread notifications as read
    await Notification.updateMany(
      { user: userId, read: false },
      { $set: { read: true } }
    );

    // Reset notification count
    await User.findByIdAndUpdate(userId, { $set: { notificationCount: 0 } });

    res.json({ message: "Notifications marked as read." });
  } catch (err) {
    console.error("Mark Read Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
