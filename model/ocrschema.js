const mongoose = require("mongoose");

const DataRecordSchema = new mongoose.Schema({
  sourceFile: String,

  data: {
    type: mongoose.Schema.Types.Mixed, // 🔥 ANY DATA
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("DataRecord", DataRecordSchema);
