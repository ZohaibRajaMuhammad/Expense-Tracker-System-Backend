const Expense = require('../models/Expense');

// Valid expense categories from the model
const validExpenseCategories = ['Food', 'Transport', 'Entertainment', 'Healthcare', 'Shopping', 'Bills', 'Education', 'Other'];

exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user._id }).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addExpense = async (req, res) => {
  try {
    const { title, amount, category, description, date, icon } = req.body;

    // Validate required fields
    if (!title || !amount || !category) {
      return res.status(400).json({ 
        message: 'Title, amount, and category are required' 
      });
    }

    // Validate category
    if (!validExpenseCategories.includes(category)) {
      return res.status(400).json({ 
        message: `Invalid category. Must be one of: ${validExpenseCategories.join(', ')}` 
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({ 
        message: 'Amount must be greater than 0' 
      });
    }

    const expense = await Expense.create({
      user: req.user._id,
      title: title.trim(),
      amount: parseFloat(amount),
      category,
      description: description ? description.trim() : '',
      icon: icon || '',
      date: date || new Date()
    });

    res.status(201).json(expense);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors 
      });
    }
    res.status(400).json({ message: error.message });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const { title, amount, category, description, date, icon } = req.body;
    
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Validate category if provided
    if (category && !validExpenseCategories.includes(category)) {
      return res.status(400).json({ 
        message: `Invalid category. Must be one of: ${validExpenseCategories.join(', ')}` 
      });
    }

    // Validate amount if provided
    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ 
        message: 'Amount must be greater than 0' 
      });
    }

    // Update fields
    if (title !== undefined) expense.title = title.trim();
    if (amount !== undefined) expense.amount = parseFloat(amount);
    if (category !== undefined) expense.category = category;
    if (description !== undefined) expense.description = description.trim();
    if (icon !== undefined) expense.icon = icon;
    if (date !== undefined) expense.date = date;

    const updatedExpense = await expense.save();

    res.json(updatedExpense);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors 
      });
    }
    res.status(400).json({ message: error.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.downloadExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user._id }).sort({ date: -1 });
    
    let textContent = 'EXPENSE TRACKER REPORT\n';
    textContent += '======================\n\n';
    
    expenses.forEach((expense, index) => {
      textContent += `${index + 1}. ${expense.title}\n`;
      textContent += `   Amount: $${expense.amount.toFixed(2)}\n`;
      textContent += `   Category: ${expense.category}\n`;
      textContent += `   Date: ${new Date(expense.date).toLocaleDateString()}\n`;
      if (expense.description) {
        textContent += `   Description: ${expense.description}\n`;
      }
      if (expense.icon) {
        textContent += `   Icon: ${expense.icon}\n`;
      }
      textContent += '\n';
    });

    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    textContent += `TOTAL EXPENSES: $${totalAmount.toFixed(2)}\n`;
    textContent += `TOTAL RECORDS: ${expenses.length}\n`;
    textContent += `GENERATED ON: ${new Date().toLocaleDateString()}\n`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=expenses-report.txt');
    res.send(textContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get expense statistics
exports.getExpenseStats = async (req, res) => {
  try {
    const stats = await Expense.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    const totalExpenses = stats.reduce((sum, stat) => sum + stat.totalAmount, 0);
    
    res.json({
      totalExpenses,
      categoryBreakdown: stats,
      totalRecords: stats.reduce((sum, stat) => sum + stat.count, 0)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};