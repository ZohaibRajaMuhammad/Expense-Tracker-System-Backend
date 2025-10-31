const express = require('express');
const { 
  aiFinancialManagement, 
  getAIRecommendations,
  aiCategorizeExpense 
} = require('../controllers/aiManagementController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.post('/manage', protect, aiFinancialManagement);
router.get('/recommendations', protect, getAIRecommendations);
router.post('/categorize', protect, aiCategorizeExpense);

module.exports = router;