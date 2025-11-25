// models/adminnotification.js
const mongoose = require("mongoose");

const adminNotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["work_issue", "system_alert", "other"],
    required: true
  },
  message: { type: String, required: true },

  work: { type: mongoose.Schema.Types.ObjectId, ref: "Work", required: true },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  issueType: {
    type: String,
    enum: ["need_parts", "need_specialist", "customer_unavailable", "other"],
  },

  remarks: { type: String, trim: true },
  status: {
    type: String,
    enum: ["open", "resolved"],
    default: "open"
  },

  seen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

adminNotificationSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("AdminNotification", adminNotificationSchema);
