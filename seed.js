const mongoose = require("mongoose");
const Service = require("./model/servicecard");
const services = require("./serviceCardData");


mongoose.connect("mongodb+srv://enterpricesssa:SAA2025@ssadatabase.mqs6quf.mongodb.net/?retryWrites=true&w=majority&appName=SSADATABASE", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected!"))
.catch(err => console.error("MongoDB connection error:", err));

const seedServices = async () => {
  try {
    await Service.insertMany(services);
    console.log("All 40 services inserted successfully!");
    mongoose.disconnect(); 
  } catch (err) {
    console.error(err);
  }
};

seedServices();
