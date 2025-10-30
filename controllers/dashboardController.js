const Income = require('../models/Income');
const Expense = require('../models/Expense');
const moment = require('moment');

exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user._id;

    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();

    const totalIncome = await Income.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalExpense = await Expense.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const monthlyIncome = await Income.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const monthlyExpense = await Expense.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const incomeByCategory = await Income.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const expenseByCategory = await Expense.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const recentIncomes = await Income.find({ user: userId })
      .sort({ date: -1 })
      .limit(5)
      .select('title amount category date');

    const recentExpenses = await Expense.find({ user: userId })
      .sort({ date: -1 })
      .limit(5)
      .select('title amount category date');

    res.json({
      summary: {
        totalIncome: totalIncome[0]?.total || 0,
        totalExpense: totalExpense[0]?.total || 0,
        monthlyIncome: monthlyIncome[0]?.total || 0,
        monthlyExpense: monthlyExpense[0]?.total || 0,
        balance: (totalIncome[0]?.total || 0) - (totalExpense[0]?.total || 0)
      },
      charts: {
        incomeByCategory,
        expenseByCategory
      },
      recentTransactions: {
        incomes: recentIncomes,
        expenses: recentExpenses
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};