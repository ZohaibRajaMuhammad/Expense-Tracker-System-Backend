const express = require('express');
const { getFinancialInsights, getQuickSummary } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.post('/insights', protect, getFinancialInsights);
router.get('/summary', protect, getQuickSummary);

module.exports = router;