const Income = require('../models/Income');

// Valid income categories from the model
const validIncomeCategories = ['Salary', 'Freelance', 'Rentals', 'Business', 'Stocks', 'Startup', 'Other'];

exports.getIncomes = async (req, res) => {
  try {
    const incomes = await Income.find({ user: req.user._id }).sort({ date: -1 });
    res.json(incomes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getIncome = async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);

    if (!income) {
      return res.status(404).json({ message: 'Income not found' });
    }

    if (income.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(income);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addIncome = async (req, res) => {
  try {
    const { title, amount, category, description, date, icon } = req.body;

    // Validate required fields
    if (!title || !amount || !category) {
      return res.status(400).json({ 
        message: 'Title, amount, and category are required' 
      });
    }

    // Validate category
    if (!validIncomeCategories.includes(category)) {
      return res.status(400).json({ 
        message: `Invalid category. Must be one of: ${validIncomeCategories.join(', ')}` 
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({ 
        message: 'Amount must be greater than 0' 
      });
    }

    const income = await Income.create({
      user: req.user._id,
      title: title.trim(),
      amount: parseFloat(amount),
      category,
      description: description ? description.trim() : '',
      icon: icon || '',
      date: date || new Date()
    });

    res.status(201).json(income);
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

exports.updateIncome = async (req, res) => {
  try {
    const { title, amount, category, description, date, icon } = req.body;
    
    const income = await Income.findById(req.params.id);

    if (!income) {
      return res.status(404).json({ message: 'Income not found' });
    }

    if (income.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Validate category if provided
    if (category && !validIncomeCategories.includes(category)) {
      return res.status(400).json({ 
        message: `Invalid category. Must be one of: ${validIncomeCategories.join(', ')}` 
      });
    }

    // Validate amount if provided
    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ 
        message: 'Amount must be greater than 0' 
      });
    }

    // Update fields
    if (title !== undefined) income.title = title.trim();
    if (amount !== undefined) income.amount = parseFloat(amount);
    if (category !== undefined) income.category = category;
    if (description !== undefined) income.description = description.trim();
    if (icon !== undefined) income.icon = icon;
    if (date !== undefined) income.date = date;

    const updatedIncome = await income.save();

    res.json(updatedIncome);
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
    res.json({ message: 'Income removed successfully' });
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
      textContent += `   Amount: $${income.amount.toFixed(2)}\n`;
      textContent += `   Category: ${income.category}\n`;
      textContent += `   Date: ${new Date(income.date).toLocaleDateString()}\n`;
      if (income.description) {
        textContent += `   Description: ${income.description}\n`;
      }
      if (income.icon) {
        textContent += `   Icon: ${income.icon}\n`;
      }
      textContent += '\n';
    });

    const totalAmount = incomes.reduce((sum, income) => sum + income.amount, 0);
    textContent += `TOTAL INCOME: $${totalAmount.toFixed(2)}\n`;
    textContent += `TOTAL RECORDS: ${incomes.length}\n`;
    textContent += `GENERATED ON: ${new Date().toLocaleDateString()}\n`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=incomes-report.txt');
    res.send(textContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get income statistics
exports.getIncomeStats = async (req, res) => {
  try {
    const stats = await Income.aggregate([
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

    const totalIncome = stats.reduce((sum, stat) => sum + stat.totalAmount, 0);
    
    res.json({
      totalIncome,
      categoryBreakdown: stats,
      totalRecords: stats.reduce((sum, stat) => sum + stat.count, 0)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};