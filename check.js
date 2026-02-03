//  config/firebaseAdmin.js (PURE JS)
// import admin from "firebase-admin";
// import fs from "fs";
// import path from "path";

// const serviceAccountPath = path.join(
//   process.cwd(),
//   "firebase-admin.json"
// );

// if (!admin.apps.length) {
//   const serviceAccount = JSON.parse(
//     fs.readFileSync(serviceAccountPath, "utf8")
//   );

//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });
// }

// export default admin;



// 2️⃣ services/notificationService.js (PURE JS)



// import admin from "../config/firebaseAdmin.js";

// export async function sendPush(tokens, title, body, data = {}) {
//   if (!tokens || !tokens.length) return;

//   const message = {
//     tokens,

//     notification: {
//       title,
//       body,
//     },

//     android: {
//       priority: "high",
//       notification: {
//         channelId: "default",
//         sound: "default",
//         color: "#1E88E5",
//       },
//     },

//     apns: {
//       payload: {
//         aps: {
//           sound: "default",
//         },
//       },
//     },

//     data,
//   };

//   try {
//     const response = await admin
//       .messaging()
//       .sendEachForMulticast(message);

//     console.log(
//       "Push success:",
//       response.successCount,
//       "failed:",
//       response.failureCount
//     );

//     response.responses.forEach((res, index) => {
//       if (!res.success) {
//         console.log(
//           "Failed token:",
//           tokens[index],
//           res.error?.message
//         );
//       }
//     });

//   } catch (error) {
//     console.error("FCM error:", error);
//   }
// }




// import { Router } from "express";
// import User from "../models/user.js";
// import ConnectionRequest from "../models/connectionrequest.js";
// import Notification from "../models/Notification.js";
// import { verifyUser } from "../middlewares/authMiddleware.js";
// import { sendPush } from "../services/notificationService.js";

// const router = Router();

// router.post("/request-parent", verifyUser, async (req, res) => {
//   try {
//     const child = req.user;
//     const { inviteCode } = req.body;

//     if (child?.role !== "child") {
//       return res.status(403).json({ message: "Only child can request" });
//     }

//     if (!inviteCode) {
//       return res.status(400).json({ message: "Invite code required" });
//     }

//     const parent = await User.findOne({
//       inviteCode,
//       role: "parent",
//     });

//     if (!parent) {
//       return res.status(404).json({ message: "Invalid invite code" });
//     }

//     const existing = await ConnectionRequest.findOne({
//       parentId: parent._id,
//       childId: child._id,
//       status: "pending",
//     });

//     const notifyParent = async () => {
//       try {
//         await Notification.create({
//           userId: parent._id,
//           title: "You have a new connection",
//           body: `${child.name} wants to stay connected with you`,
//           data: {
//             type: "CONNECTION_REQUEST",
//             childId: child._id,
//           },
//         });

//         await sendPush(
//           parent.fcmTokens || [],
//           "You have a new connection",
//           `${child.name} wants to stay connected with you on SafeTracker`,
//           {
//             type: "CONNECTION_REQUEST",
//             childId: child._id.toString(),
//           }
//         );
//       } catch (err) {
//         console.log("Notify error (ignored):", err);
//       }
//     };

//     if (existing) {
//       await notifyParent();
//       return res.json({ message: "Connection request already sent" });
//     }

//     await ConnectionRequest.create({
//       parentId: parent._id,
//       childId: child._id,
//       expiresAt: new Date(Date.now() + 10 * 60 * 1000),
//     });

//     // 🔔 fire & forget
//     notifyParent();

//     return res.json({
//       message: "Connection request sent to parent",
//     });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: "Server error" });
//   }
// });

// export default router;






