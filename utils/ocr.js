const express = require("express");
const { createWorker } = require("tesseract.js");
const upload = require("./upload");
const path = require("path");
const fs = require("fs");
const Poppler = require("pdf-poppler");
const ExcelJS = require("exceljs");
const sharp = require("sharp");
const DataRecord = require("../model/ocrschema");

const router = express.Router();

async function pdfToImages(pdfPath) {
  const outputDir = path.dirname(pdfPath);
  const prefix = path.basename(pdfPath, path.extname(pdfPath));

  await Poppler.convert(pdfPath, {
    format: "png",
    out_dir: outputDir,
    out_prefix: prefix,
    page: null,
  });

  return fs
    .readdirSync(outputDir)
    .filter(f => f.startsWith(prefix) && f.endsWith(".png"))
    .map(f => path.join(outputDir, f));
}


async function preprocessImage(imgPath) {
  const processedPath = imgPath.replace(
    path.extname(imgPath),
    "-processed.png"
  );

  await sharp(imgPath)
    .grayscale()
    .normalize()
    .resize({ width: 2000 })
    .toFile(processedPath);

  return processedPath;
}


async function doOCR(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const images = ext === ".pdf" ? await pdfToImages(filePath) : [filePath];

  const worker = await createWorker("eng+hin");
  let fullText = "";
  let confidenceSum = 0;

  try {
    for (const img of images) {
      const processedImg = await preprocessImage(img);
      const { data } = await worker.recognize(processedImg);

      fullText += data.text + "\n";
      confidenceSum += data.confidence || 0;

      // cleanup
      fs.existsSync(processedImg) && fs.unlinkSync(processedImg);
      if (ext === ".pdf") fs.existsSync(img) && fs.unlinkSync(img);
    }
  } finally {
    await worker.terminate();
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
  }

  return {
    text: fullText.trim(),
    confidence: images.length
      ? (confidenceSum / images.length).toFixed(2)
      : 0,
  };
}


router.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "File required" });

    const result = await doOCR(req.file.path);

    res.json({
      success: true,
      fullText: result.text,
      confidence: result.confidence,
    });
  } catch (err) {
    console.error("OCR ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message || "OCR failed",
    });
  }
});


router.post("/ocr/save", async (req, res) => {
  try {
    const { sourceName, selectedData } = req.body;

    if (!selectedData)
      return res.status(400).json({ message: "No data provided" });

    const record = await DataRecord.create({
      sourceFile: sourceName || "OCR Upload",
      data: selectedData,
    });

    res.json({
      success: true,
      recordId: record._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Save failed" });
  }
});

router.get("/ocr/excel/:id", async (req, res) => {
  try {
    const record = await DataRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Not found" });

    const rows = Array.isArray(record.data)
      ? record.data
      : [record.data];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("OCR Data");

    const headers = Object.keys(rows[0] || {});
    sheet.columns = headers.map(h => ({
      header: h,
      key: h,
      width: 25,
    }));

    rows.forEach(r => sheet.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=ocr-data.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Excel export failed" });
  }
});

module.exports = router;
