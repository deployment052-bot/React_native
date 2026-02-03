const express = require("express");
const { protect } = require("../middelware/authMiddelware");
const {
  markNotificationsAsRead,
  markSingleNotificationRead,
  getNotifications
} = require("../controllers/helpercontroller");
const admin = require("firebase-admin");
const Notification = require("../model/Notification");
const User = require("../model/user"); 
const router = express.Router();


router.get("/", protect, getNotifications);

router.post("/mark-read", protect, markNotificationsAsRead);

router.patch("/:id/read", protect, markSingleNotificationRead);


router.get("/count", protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({
      success: true,
      notifications,
      notificationCount: unreadCount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/save-fcm-token", protect, async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: "FCM token is required"
      });
    }
    console.log(fcmToken)

    await User.findByIdAndUpdate(req.user._id, {
      fcmToken
    });

    res.json({
      success: true,
      message: "FCM token saved successfully"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});
router.post("/test-fcm", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    // console.log(user)
    if (!user || !user.fcmToken) {
      return res.status(400).json({ success: false, message: "FCM token not found for user" });
    }

    const message = {
      token: user.fcmToken,
      notification: {
        title: "Test Notification",
        body: "Ye demo FCM notification hai"
      },
      android: {
        priority: "high",
        notification: {
          channelId: "default",
          sound: "default",
          color: "#1E88E5",
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1
          }
        }
      },
      data: {
        type: "TEST",
      }
    };

    const response = await admin.messaging().send(message);
   console.log(response)
    console.log("FCM Test Response:", response);

    res.json({
      success: true,
      message: "Test notification sent successfully",
      response,
    });
  } catch (error) {
    console.error("FCM Test Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
module.exports = router;
