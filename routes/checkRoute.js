const express = require('express');
const { protect } = require('../middelware/authMiddelware');
const router = express.Router();
router.get('/', protect, (req, res) => {
  res.status(200).json({ message: 'Check route is working fine!' });
});
module.exports = router;
