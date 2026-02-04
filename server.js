const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const os = require("os");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

/* ============================
   SOCKET.IO SETUP
============================ */

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://honeydew-ibex-486236.hostingersite.com",
      "https://fantastic-pie-84a677.netlify.app",
    ],
    credentials: true,
  },
});

global.io = io;
module.exports.io = io;

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

/* ============================
   PASSPORT CONFIG
============================ */

require("./config/passport");

/* ============================
   MIDDLEWARE
============================ */

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://honeydew-ibex-486236.hostingersite.com",
      "https://fantastic-pie-84a677.netlify.app",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ============================
   SESSION
============================ */

app.use(
  session({
    name: "ims.sid",
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* ============================
   ROUTES
============================ */

app.use("/auth", require("./routes/authRoute"));
app.use("/api", require("./routes/work"));
app.use("/api", require("./routes/admin"));
app.use("/otp", require("./routes/otpRoutes"));
app.use("/forget", require("./routes/forgotpassword"));
app.use("/service", require("./routes/service"));
app.use("/technicaian", require("./routes/technicianRoutes"));
app.use("/ims", require("./routes/ssologin"));
app.use("/profile", require("./routes/profileRoutes"));
app.use("/notification", require("./routes/notificationroute"));
app.use("/serviceCard", require("./routes/serviceroute"));

/* ============================
   WINDOWS ONLY NATIVE ROUTE
============================ */

if (process.platform === "win32") {
  console.log("✅ Windows detected → Native phone module enabled");

  app.use("/phone", require("./native_code/route/authregister"));
} else {
  console.log("⚠️ Linux detected → Native phone disabled");

  app.use("/phone", (req, res) => {
    res.status(503).json({
      success: false,
      message: "Phone service not supported on Linux server",
    });
  });
}

/* ============================
   DATABASE
============================ */

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });

/* ============================
   ROUTES
============================ */

app.get("/", (req, res) => {
  res.send("✅ Server running fine with Socket.IO & Auth");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    pid: process.pid,
    time: new Date(),
  });
});

/* ============================
   ERROR HANDLER
============================ */

app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

/* ============================
   SERVER START
============================ */

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
