const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create uploads folder if not exist
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(
      null,
      uniqueSuffix + path.extname(file.originalname).toLowerCase()
    );
  },
});

// ✅ UPDATED FILE FILTER
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "image/jfif",
    "application/pdf",
  ];

  const allowedExt = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".jfif",
    ".pdf",
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExt.includes(ext)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only image (jpg, jpeg, png, webp, jfif) and PDF files are allowed"
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
});

module.exports = upload;
