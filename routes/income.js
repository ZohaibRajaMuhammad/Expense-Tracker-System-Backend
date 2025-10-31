const express = require('express');
const { 
  getIncomes, 
  addIncome, 
  deleteIncome, 
  updateIncome,
  getIncome
} = require('../controllers/incomeController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.route('/')
  .get(protect, getIncomes)    // GET all incomes for user
  .post(protect, addIncome);   // CREATE new income

router.route('/:id')
  .get(protect, getIncome)        // GET single income
  .put(protect, updateIncome)     // UPDATE income
  .delete(protect, deleteIncome); // DELETE income

module.exports = router;