const Expense = require('../models/Expense');


exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user._id }).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addExpense = async (req, res) => {
  try {
    const { title, amount, category, description, date } = req.body;

    const expense = await Expense.create({
      user: req.user._id,
      title,
      amount,
      category,
      description,
      date: date || Date.now()
    });

    res.status(201).json(expense);
  } catch (error) {
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
    res.json({ message: 'Expense removed' });
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
      textContent += `   Amount: $${expense.amount}\n`;
      textContent += `   Category: ${expense.category}\n`;
      textContent += `   Date: ${new Date(expense.date).toLocaleDateString()}\n`;
      if (expense.description) {
        textContent += `   Description: ${expense.description}\n`;
      }
      textContent += '\n';
    });

    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    textContent += `TOTAL EXPENSES: $${totalAmount}\n`;
    textContent += `TOTAL RECORDS: ${expenses.length}\n`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=expenses-report.txt');
    res.send(textContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.updateExpense = async (req, res) => {
  try {
    const { title, amount, category, description, date } = req.body;
    
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    expense.title = title || expense.title;
    expense.amount = amount || expense.amount;
    expense.category = category || expense.category;
    expense.description = description !== undefined ? description : expense.description;
    expense.date = date || expense.date;

    const updatedExpense = await expense.save();

    res.json({
      _id: updatedExpense._id,
      title: updatedExpense.title,
      amount: updatedExpense.amount,
      category: updatedExpense.category,
      description: updatedExpense.description,
      date: updatedExpense.date,
      createdAt: updatedExpense.createdAt,
      user: updatedExpense.user
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
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