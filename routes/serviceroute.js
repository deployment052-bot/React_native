const express = require("express");
const { protect, authorize } = require('../middelware/authMiddelware');
const router = express.Router();

const {
  getServices,getCategoriesWithServices ,smartServiceSearch
} = require("../controllers/servicecard");

router.get("/show",protect,authorize('client'),getServices);
router.get("/categories",protect,authorize('client'), getCategoriesWithServices);
router.get('/get-key',protect,authorize('client'),smartServiceSearch)
module.exports = router;
