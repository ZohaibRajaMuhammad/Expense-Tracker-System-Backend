const axios = require('axios');
const moment = require('moment');

// @desc    Get comprehensive dashboard data by fetching from income/expense APIs
// @route   GET /api/dashboard
// @access  Private
exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user._id;
    const baseURL = `${req.protocol}://${req.get('host')}`;
    
    // Fetch data from income and expense APIs
    const [incomesResponse, expensesResponse] = await Promise.all([
      axios.get(`${baseURL}/api/incomes`, {
        headers: { Authorization: req.headers.authorization }
      }),
      axios.get(`${baseURL}/api/expenses`, {
        headers: { Authorization: req.headers.authorization }
      })
    ]);

    const incomes = incomesResponse.data || [];
    const expenses = expensesResponse.data || [];

    // Calculate summary data
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
    const totalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const balance = totalIncome - totalExpense;

    // Current month calculations
    const currentMonthStart = moment().startOf('month');
    const currentMonthEnd = moment().endOf('month');
    
    const currentMonthIncome = incomes
      .filter(income => moment(income.date).isBetween(currentMonthStart, currentMonthEnd))
      .reduce((sum, income) => sum + income.amount, 0);

    const currentMonthExpense = expenses
      .filter(expense => moment(expense.date).isBetween(currentMonthStart, currentMonthEnd))
      .reduce((sum, expense) => sum + expense.amount, 0);

    const currentMonthSavings = currentMonthIncome - currentMonthExpense;

    // Calculate category-wise data
    const incomeByCategory = calculateCategoryData(incomes, 'income');
    const expenseByCategory = calculateCategoryData(expenses, 'expense');

    // Monthly trend data (last 6 months)
    const monthlyTrend = calculateMonthlyTrend(incomes, expenses);

    // Recent transactions (last 5 of each)
    const recentIncomes = incomes
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .map(income => ({
        ...income,
        type: 'income',
        date: moment(income.date).format('YYYY-MM-DD')
      }));

    const recentExpenses = expenses
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .map(expense => ({
        ...expense,
        type: 'expense',
        date: moment(expense.date).format('YYYY-MM-DD')
      }));

    // Top categories
    const topIncomeCategories = incomeByCategory.slice(0, 3);
    const topExpenseCategories = expenseByCategory.slice(0, 3);

    // Calculate insights
    const insights = calculateInsights(incomes, expenses, currentMonthIncome, currentMonthExpense);

    // Prepare dashboard response
    const dashboardData = {
      summary: {
        totalIncome,
        totalExpense,
        balance,
        currentPeriodIncome: currentMonthIncome,
        currentPeriodExpense: currentMonthExpense,
        currentPeriodSavings: currentMonthSavings,
        recordCount: {
          incomes: incomes.length,
          expenses: expenses.length
        },
        period: 'month'
      },
      charts: {
        incomeByCategory: incomeByCategory.map(item => ({
          ...item,
          percentage: totalIncome > 0 ? ((item.total / totalIncome) * 100).toFixed(1) : '0.0'
        })),
        expenseByCategory: expenseByCategory.map(item => ({
          ...item,
          percentage: totalExpense > 0 ? ((item.total / totalExpense) * 100).toFixed(1) : '0.0'
        })),
        monthlyTrend,
        topCategories: {
          income: topIncomeCategories,
          expense: topExpenseCategories
        }
      },
      recentTransactions: {
        incomes: recentIncomes,
        expenses: recentExpenses
      },
      insights,
      isEmpty: incomes.length === 0 && expenses.length === 0
    };

    res.json(dashboardData);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.json(getEmptyDashboard());
    }
    
    res.status(500).json({ 
      message: 'Error fetching dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to calculate category data
function calculateCategoryData(transactions, type) {
  const categoryMap = {};
  
  transactions.forEach(transaction => {
    const category = transaction.category;
    if (!categoryMap[category]) {
      categoryMap[category] = {
        category,
        total: 0,
        count: 0
      };
    }
    categoryMap[category].total += transaction.amount;
    categoryMap[category].count += 1;
  });

  return Object.values(categoryMap)
    .sort((a, b) => b.total - a.total);
}

// Helper function to calculate monthly trend
function calculateMonthlyTrend(incomes, expenses) {
  const monthlyTrend = [];
  
  for (let i = 5; i >= 0; i--) {
    const monthStart = moment().subtract(i, 'months').startOf('month');
    const monthEnd = moment().subtract(i, 'months').endOf('month');
    const monthName = moment().subtract(i, 'months').format('MMM YYYY');

    const monthIncome = incomes
      .filter(income => moment(income.date).isBetween(monthStart, monthEnd))
      .reduce((sum, income) => sum + income.amount, 0);

    const monthExpense = expenses
      .filter(expense => moment(expense.date).isBetween(monthStart, monthEnd))
      .reduce((sum, expense) => sum + expense.amount, 0);

    monthlyTrend.push({
      month: monthName,
      income: monthIncome,
      expense: monthExpense,
      savings: monthIncome - monthExpense
    });
  }
  
  return monthlyTrend;
}

// Helper function to calculate insights
function calculateInsights(incomes, expenses, currentMonthIncome, currentMonthExpense) {
  const highestIncome = incomes.length > 0 ? Math.max(...incomes.map(i => i.amount)) : 0;
  const highestExpense = expenses.length > 0 ? Math.max(...expenses.map(e => e.amount)) : 0;
  
  const averageIncome = incomes.length > 0 ? (incomes.reduce((sum, i) => sum + i.amount, 0) / incomes.length) : 0;
  const averageExpense = expenses.length > 0 ? (expenses.reduce((sum, e) => sum + e.amount, 0) / expenses.length) : 0;
  
  const savingsRate = currentMonthIncome > 0 ? 
    ((currentMonthIncome - currentMonthExpense) / currentMonthIncome * 100) : 0;

  return {
    highestIncome,
    highestExpense,
    averageIncome: averageIncome.toFixed(2),
    averageExpense: averageExpense.toFixed(2),
    savingsRate: savingsRate.toFixed(1),
    totalTransactions: incomes.length + expenses.length
  };
}

// Helper function for empty dashboard
function getEmptyDashboard() {
  return {
    summary: {
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      currentPeriodIncome: 0,
      currentPeriodExpense: 0,
      currentPeriodSavings: 0,
      recordCount: {
        incomes: 0,
        expenses: 0
      },
      period: 'month'
    },
    charts: {
      incomeByCategory: [],
      expenseByCategory: [],
      monthlyTrend: Array(6).fill().map((_, i) => {
        const monthName = moment().subtract(5 - i, 'months').format('MMM YYYY');
        return {
          month: monthName,
          income: 0,
          expense: 0,
          savings: 0
        };
      }),
      topCategories: {
        income: [],
        expense: []
      }
    },
    recentTransactions: {
      incomes: [],
      expenses: []
    },
    insights: {
      highestIncome: 0,
      highestExpense: 0,
      averageIncome: "0.00",
      averageExpense: "0.00",
      savingsRate: "0.0",
      totalTransactions: 0
    },
    isEmpty: true
  };
}

// @desc    Get financial overview
// @route   GET /api/dashboard/overview
// @access  Private
exports.getFinancialOverview = async (req, res) => {
  try {
    const userId = req.user._id;
    const baseURL = `${req.protocol}://${req.get('host')}`;
    
    const [incomesResponse, expensesResponse] = await Promise.all([
      axios.get(`${baseURL}/api/incomes`, {
        headers: { Authorization: req.headers.authorization }
      }),
      axios.get(`${baseURL}/api/expenses`, {
        headers: { Authorization: req.headers.authorization }
      })
    ]);

    const incomes = incomesResponse.data || [];
    const expenses = expensesResponse.data || [];

    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
    const totalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const overview = {
      income: {
        total: totalIncome,
        count: incomes.length,
        average: incomes.length > 0 ? (totalIncome / incomes.length).toFixed(2) : 0,
        max: incomes.length > 0 ? Math.max(...incomes.map(i => i.amount)) : 0,
        min: incomes.length > 0 ? Math.min(...incomes.map(i => i.amount)) : 0
      },
      expense: {
        total: totalExpense,
        count: expenses.length,
        average: expenses.length > 0 ? (totalExpense / expenses.length).toFixed(2) : 0,
        max: expenses.length > 0 ? Math.max(...expenses.map(e => e.amount)) : 0,
        min: expenses.length > 0 ? Math.min(...expenses.map(e => e.amount)) : 0
      },
      net: totalIncome - totalExpense,
      period: {
        startDate: moment().startOf('month').format('YYYY-MM-DD'),
        endDate: moment().endOf('month').format('YYYY-MM-DD')
      }
    };

    res.json(overview);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching financial overview' });
  }
};