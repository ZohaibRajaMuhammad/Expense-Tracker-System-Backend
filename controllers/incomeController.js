const Income = require('../models/Income');
const fs = require('fs');
const path = require('path');


exports.getIncomes = async (req, res) => {
  try {
    const incomes = await Income.find({ user: req.user._id }).sort({ date: -1 });
    res.json(incomes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addIncome = async (req, res) => {
  try {
    const { title, amount, category, description, date } = req.body;

    const income = await Income.create({
      user: req.user._id,
      title,
      amount,
      category,
      description,
      date: date || Date.now()
    });

    res.status(201).json(income);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


exports.deleteIncome = async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);

    if (!income) {
      return res.status(404).json({ message: 'Income not found' });
    }

    if (income.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Income.findByIdAndDelete(req.params.id);
    res.json({ message: 'Income removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.downloadIncomes = async (req, res) => {
  try {
    const incomes = await Income.find({ user: req.user._id }).sort({ date: -1 });
    
    let textContent = 'INCOME TRACKER REPORT\n';
    textContent += '=====================\n\n';
    
    incomes.forEach((income, index) => {
      textContent += `${index + 1}. ${income.title}\n`;
      textContent += `   Amount: $${income.amount}\n`;
      textContent += `   Category: ${income.category}\n`;
      textContent += `   Date: ${new Date(income.date).toLocaleDateString()}\n`;
      if (income.description) {
        textContent += `   Description: ${income.description}\n`;
      }
      textContent += '\n';
    });

    const totalAmount = incomes.reduce((sum, income) => sum + income.amount, 0);
    textContent += `TOTAL INCOME: $${totalAmount}\n`;
    textContent += `TOTAL RECORDS: ${incomes.length}\n`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=incomes-report.txt');
    res.send(textContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// @desc    Update income
// @route   PUT /api/incomes/:id
// @access  Private
exports.updateIncome = async (req, res) => {
  try {
    const { title, amount, category, description, date } = req.body;
    
    const income = await Income.findById(req.params.id);

    if (!income) {
      return res.status(404).json({ message: 'Income not found' });
    }

    // Check if income belongs to user
    if (income.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Update fields
    income.title = title || income.title;
    income.amount = amount || income.amount;
    income.category = category || income.category;
    income.description = description !== undefined ? description : income.description;
    income.date = date || income.date;

    const updatedIncome = await income.save();

    res.json({
      _id: updatedIncome._id,
      title: updatedIncome.title,
      amount: updatedIncome.amount,
      category: updatedIncome.category,
      description: updatedIncome.description,
      date: updatedIncome.date,
      createdAt: updatedIncome.createdAt,
      user: updatedIncome.user
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get single income
// @route   GET /api/incomes/:id
// @access  Private
exports.getIncome = async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);

    if (!income) {
      return res.status(404).json({ message: 'Income not found' });
    }

    // Check if income belongs to user
    if (income.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(income);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};