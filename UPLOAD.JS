const fs = require("fs");
const path = require("path");
const { uploadToCloudinary } = require("./utils/cloudinaryUpload");
 // your helper

const localFolder = path.join(__dirname, "assets"); // folder with local images
const cloudFolder = "fast_response_asstes"; // Cloudinary folder
const saveFilePath = path.join(__dirname, "savedImages_assets.json"); // JSON output

async function uploadAll() {
  try {
    // Read image files from local folder
    const files = fs.readdirSync(localFolder).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return [".png", ".jpg", ".jpeg", ".gif"].includes(ext);
    });

    if (files.length === 0) {
      console.log("No images found in uploads folder.");
      return;
    }

    // Read existing JSON if it exists
    const existingData = fs.existsSync(saveFilePath)
      ? JSON.parse(fs.readFileSync(saveFilePath, "utf8"))
      : [];

    // Upload images in parallel
    const uploadPromises = files.map(async file => {
      const filePath = path.join(localFolder, file);
      const fileName = path.parse(file).name;

      const result = await uploadToCloudinary(filePath, cloudFolder);
      console.log(`✅ Uploaded: ${fileName}`);

      return {
        imageName: file,
        imageUrl: result.secure_url,
        publicId: result.public_id,
        uploadedAt: new Date(),
      };
    });

    const uploadedData = await Promise.all(uploadPromises);

    // Merge with existing JSON and save
    const finalData = [...existingData, ...uploadedData];
    fs.writeFileSync(saveFilePath, JSON.stringify(finalData, null, 2));

    console.log(`🎉 All images uploaded! JSON saved at ${saveFilePath}`);
  } catch (err) {
    console.error("❌ Error uploading images:", err.message);
  }
}

uploadAll();
