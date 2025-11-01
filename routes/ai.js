const express = require('express');
const { 
  getFinancialInsights,
  getPersonalizedTips,
  getSpendingAnalysis,
  getInvestmentSuggestions
} = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const router = express.Router();

// AI Financial Insights
router.post('/insights', protect, getFinancialInsights);
router.post('/tips', protect, getPersonalizedTips);
router.post('/analysis', protect, getSpendingAnalysis);
router.post('/investment-suggestions', protect, getInvestmentSuggestions);

module.exports = router;