const express = require('express');
const { 
  getExpenses, 
  addExpense, 
  deleteExpense, 
  downloadExpenses,
  updateExpense,
  getExpense
} = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.route('/')
  .get(protect, getExpenses)
  .post(protect, addExpense);

router.route('/:id')
  .get(protect, getExpense)
  .put(protect, updateExpense)
  .delete(protect, deleteExpense);

router.get('/download/report', protect, downloadExpenses);

module.exports = router;