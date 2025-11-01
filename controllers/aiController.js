const Income = require('../models/Income');
const Expense = require('../models/Expense');
const moment = require('moment');

// @desc    Get AI-powered financial insights
// @route   POST /api/ai/insights
// @access  Private
exports.getFinancialInsights = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Fetch user's financial data
    const [incomes, expenses] = await Promise.all([
      Income.find({ user: userId }),
      Expense.find({ user: userId })
    ]);

    if ((!incomes || incomes.length === 0) && (!expenses || expenses.length === 0)) {
      return res.json({
        success: true,
        message: "Start tracking your income and expenses to get personalized AI insights!",
        insights: {
          incomeTips: getDefaultIncomeTips(),
          expenseTips: getDefaultExpenseTips(),
          savingTips: getDefaultSavingTips(),
          analysis: "No financial data available yet. Add your first transaction to begin.",
          riskLevel: "LOW",
          recommendations: [
            "Start by adding your regular income sources",
            "Track your daily expenses for better visibility",
            "Set up basic budget categories"
          ]
        }
      });
    }

    // Calculate financial metrics
    const financialData = calculateFinancialMetrics(incomes || [], expenses || []);
    
    // Generate AI insights
    const insights = await generateAIInsights(financialData, incomes || [], expenses || []);

    res.json({
      success: true,
      message: "AI financial insights generated successfully",
      insights
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate AI insights',
      error: error.message
    });
  }
};

// @desc    Get personalized financial tips
// @route   POST /api/ai/tips
// @access  Private
exports.getPersonalizedTips = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category } = req.body; // 'income', 'expense', 'saving'

    const [incomes, expenses] = await Promise.all([
      Income.find({ user: userId }),
      Expense.find({ user: userId })
    ]);

    const financialData = calculateFinancialMetrics(incomes || [], expenses || []);
    
    let tips = [];
    switch (category) {
      case 'income':
        tips = generateIncomeTips(financialData, incomes || []);
        break;
      case 'expense':
        tips = generateExpenseTips(financialData, expenses || []);
        break;
      case 'saving':
        tips = generateSavingTips(financialData);
        break;
      default:
        tips = [
          ...generateIncomeTips(financialData, incomes || []),
          ...generateExpenseTips(financialData, expenses || []),
          ...generateSavingTips(financialData)
        ];
    }

    res.json({
      success: true,
      message: `Personalized ${category || 'financial'} tips`,
      category: category || 'all',
      tips
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate tips',
      error: error.message
    });
  }
};

// @desc    Get spending analysis and predictions
// @route   POST /api/ai/analysis
// @access  Private
exports.getSpendingAnalysis = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const [incomes, expenses] = await Promise.all([
      Income.find({ user: userId }),
      Expense.find({ user: userId })
    ]);

    const analysis = analyzeSpendingPatterns(incomes || [], expenses || []);
    const predictions = predictFutureSpending(expenses || []);
    const opportunities = identifySavingsOpportunities(expenses || []);

    res.json({
      success: true,
      message: "Spending analysis completed",
      analysis: {
        spendingPatterns: analysis,
        predictions,
        savingsOpportunities: opportunities,
        riskAssessment: assessFinancialRisk(incomes || [], expenses || [])
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to analyze spending',
      error: error.message
    });
  }
};

// @desc    Get investment suggestions based on income
// @route   POST /api/ai/investment-suggestions
// @access  Private
exports.getInvestmentSuggestions = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const incomes = await Income.find({ user: userId });
    const expenses = await Expense.find({ user: userId });

    const financialData = calculateFinancialMetrics(incomes || [], expenses || []);
    const suggestions = generateInvestmentSuggestions(financialData);

    res.json({
      success: true,
      message: "Investment suggestions generated",
      suggestions
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate investment suggestions',
      error: error.message
    });
  }
};

function calculateFinancialMetrics(incomes = [], expenses = []) {
  const safeIncomes = Array.isArray(incomes) ? incomes : [];
  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  
  const totalIncome = safeIncomes.reduce((sum, income) => sum + (income?.amount || 0), 0);
  const totalExpenses = safeExpenses.reduce((sum, expense) => sum + (expense?.amount || 0), 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthIncome = safeIncomes
    .filter(income => {
      if (!income || !income.date) return false;
      const incomeDate = new Date(income.date);
      return incomeDate.getMonth() === currentMonth && incomeDate.getFullYear() === currentYear;
    })
    .reduce((sum, income) => sum + (income?.amount || 0), 0);

  const currentMonthExpense = safeExpenses
    .filter(expense => {
      if (!expense || !expense.date) return false;
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
    })
    .reduce((sum, expense) => sum + (expense?.amount || 0), 0);

  const incomeByCategory = analyzeByCategory(safeIncomes, 'income');
  const expenseByCategory = analyzeByCategory(safeExpenses, 'expense');

  return {
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    currentMonthIncome,
    currentMonthExpense,
    incomeByCategory,
    expenseByCategory,
    transactionCount: {
      incomes: safeIncomes.length,
      expenses: safeExpenses.length
    }
  };
}

function analyzeByCategory(transactions = [], type) {
  const categoryMap = {};
  
  if (!transactions || !Array.isArray(transactions)) {
    return categoryMap;
  }
  
  transactions.forEach(transaction => {
    if (!transaction || !transaction.category) return;
    
    const category = transaction.category;
    if (!categoryMap[category]) {
      categoryMap[category] = {
        total: 0,
        count: 0,
        average: 0,
        percentage: 0
      };
    }
    categoryMap[category].total += transaction.amount || 0;
    categoryMap[category].count += 1;
  });

  const total = Object.values(categoryMap).reduce((sum, cat) => sum + (cat?.total || 0), 0);
  
  Object.keys(categoryMap).forEach(category => {
    if (categoryMap[category].count > 0) {
      categoryMap[category].average = categoryMap[category].total / categoryMap[category].count;
    }
    categoryMap[category].percentage = total > 0 ? (categoryMap[category].total / total) * 100 : 0;
  });

  return categoryMap;
}

async function generateAIInsights(financialData, incomes = [], expenses = []) {
  const incomeTips = generateIncomeTips(financialData, incomes);
  const expenseTips = generateExpenseTips(financialData, expenses);
  const savingTips = generateSavingTips(financialData);
  const analysis = generateFinancialAnalysis(financialData);

  return {
    incomeTips,
    expenseTips,
    savingTips,
    analysis,
    riskLevel: assessFinancialRisk(incomes, expenses),
    monthlyProjection: projectNextMonth(financialData, expenses),
    quickWins: identifyQuickWins(expenses)
  };
}

function generateIncomeTips(financialData, incomes = []) {
  const tips = [];
  const incomeCategories = financialData.incomeByCategory || {};

  const categoryCount = Object.keys(incomeCategories).length;
  if (categoryCount <= 1) {
    tips.push({
      type: 'DIVERSIFICATION',
      title: 'Diversify Income Sources',
      message: 'Consider adding multiple income streams for financial stability',
      priority: 'HIGH',
      action: 'Explore freelance work, investments, or side businesses',
      potentialImpact: 'High'
    });
  }

  const hasSalary = incomeCategories['Salary'];
  if (!hasSalary && financialData.totalIncome > 0) {
    tips.push({
      type: 'STABILITY',
      title: 'Create Income Stability',
      message: 'Irregular income can make budgeting challenging',
      priority: 'MEDIUM',
      action: 'Set aside funds during high-income months for low-income periods',
      potentialImpact: 'Medium'
    });
  }

  if (financialData.totalIncome > 0) {
    tips.push({
      type: 'GROWTH',
      title: 'Increase Earnings Potential',
      message: 'Look for opportunities to increase your primary income source',
      priority: 'LOW',
      action: 'Consider skill development or asking for a raise',
      potentialImpact: 'High'
    });
  }

  if (financialData.netSavings > 1000) {
    tips.push({
      type: 'PASSIVE_INCOME',
      title: 'Build Passive Income',
      message: 'You have savings that could generate passive income',
      priority: 'MEDIUM',
      action: 'Research dividend stocks, peer-to-peer lending, or rental income',
      potentialImpact: 'Medium'
    });
  }

  return tips.slice(0, 5); 
}

function generateExpenseTips(financialData, expenses = []) {
  const tips = [];
  const expenseCategories = financialData.expenseByCategory || {};

  Object.entries(expenseCategories).forEach(([category, data]) => {
    if (data && data.percentage > 30) {
      tips.push({
        type: 'REDUCTION',
        title: `Reduce ${category} Spending`,
        message: `You're spending ${data.percentage.toFixed(1)}% of your expenses on ${category}`,
        priority: 'HIGH',
        action: `Review ${category.toLowerCase()} expenses and identify areas to cut back`,
        potentialImpact: 'High',
        currentSpending: `$${data.total.toLocaleString()}`
      });
    }
  });

  const subscriptionExpenses = expenses.filter(exp => {
    if (!exp || !exp.category || !exp.title) return false;
    
    return (['Entertainment', 'Bills', 'Other'].includes(exp.category)) &&
           exp.title.toLowerCase().includes('subscription');
  });

  if (subscriptionExpenses.length > 3) {
    const totalSubscriptions = subscriptionExpenses.reduce((sum, exp) => sum + (exp?.amount || 0), 0);
    tips.push({
      type: 'SUBSCRIPTION',
      title: 'Review Subscriptions',
      message: `You have ${subscriptionExpenses.length} subscriptions costing $${totalSubscriptions.toLocaleString()} monthly`,
      priority: 'MEDIUM',
      action: 'Cancel unused subscriptions and bundle services',
      potentialImpact: 'Medium'
    });
  }

  const recentExpenses = expenses
    .filter(exp => {
      if (!exp || !exp.date) return false;
      return moment(exp.date).isAfter(moment().subtract(7, 'days'));
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (recentExpenses.length > 10) {
    tips.push({
      type: 'IMPULSE',
      title: 'Monitor Impulse Spending',
      message: 'High frequency of recent transactions may indicate impulse spending',
      priority: 'MEDIUM',
      action: 'Implement a 24-hour waiting period for non-essential purchases',
      potentialImpact: 'Medium'
    });
  }

  return tips.slice(0, 5);
}

function generateSavingTips(financialData) {
  const tips = [];
  const savingsRate = financialData.savingsRate || 0;

  if (savingsRate < 10) {
    tips.push({
      type: 'EMERGENCY_FUND',
      title: 'Build Emergency Fund',
      message: `Your savings rate is ${savingsRate.toFixed(1)}%. Aim for at least 20%`,
      priority: 'HIGH',
      action: 'Automate savings transfers and reduce discretionary spending',
      potentialImpact: 'High',
      target: '20% savings rate'
    });
  }

  if (savingsRate >= 10 && savingsRate < 20) {
    tips.push({
      type: 'SAVINGS_GROWTH',
      title: 'Increase Savings Rate',
      message: 'Good start! Try to increase your savings rate gradually',
      priority: 'MEDIUM',
      action: 'Save 50% of any income increases or windfalls',
      potentialImpact: 'Medium'
    });
  }

  if (savingsRate >= 20) {
    tips.push({
      type: 'INVESTMENT',
      title: 'Optimize Savings',
      message: 'Excellent savings rate! Consider investment options',
      priority: 'LOW',
      action: 'Explore high-yield savings accounts or low-risk investments',
      potentialImpact: 'High'
    });
  }

  const monthlyExpenses = financialData.currentMonthExpense || (financialData.totalExpenses / 12) || 0;
  if (financialData.netSavings < (monthlyExpenses * 3)) {
    tips.push({
      type: 'EMERGENCY_FUND',
      title: 'Strengthen Emergency Fund',
      message: 'Aim for 3-6 months of expenses in your emergency fund',
      priority: 'HIGH',
      action: 'Set aside funds until you reach this safety net',
      potentialImpact: 'High',
      current: `${((financialData.netSavings || 0) / (monthlyExpenses || 1)).toFixed(1)} months coverage`
    });
  }

  return tips;
}

function generateFinancialAnalysis(financialData) {
  const analysis = [];
  const { savingsRate = 0, netSavings = 0, totalIncome = 0, totalExpenses = 0 } = financialData;

  if (netSavings > 0) {
    analysis.push({
      aspect: 'Financial Health',
      status: 'POSITIVE',
      message: `You're saving $${netSavings.toLocaleString()} (${savingsRate.toFixed(1)}% of income)`,
      details: 'Your income exceeds expenses, which is excellent for financial growth'
    });
  } else {
    analysis.push({
      aspect: 'Financial Health',
      status: 'NEGATIVE',
      message: `You're spending $${Math.abs(netSavings).toLocaleString()} more than you earn`,
      details: 'Focus on reducing expenses or increasing income to achieve balance'
    });
  }

  const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;
  if (expenseRatio > 90) {
    analysis.push({
      aspect: 'Expense Management',
      status: 'CRITICAL',
      message: `Expenses are ${expenseRatio.toFixed(1)}% of your income`,
      details: 'High expense ratio leaves little room for savings and investments'
    });
  } else if (expenseRatio > 70) {
    analysis.push({
      aspect: 'Expense Management',
      status: 'WARNING',
      message: `Expenses are ${expenseRatio.toFixed(1)}% of your income`,
      details: 'Consider optimizing expenses to increase savings capacity'
    });
  }

  if (savingsRate >= 20) {
    analysis.push({
      aspect: 'Savings Rate',
      status: 'EXCELLENT',
      message: `Savings rate of ${savingsRate.toFixed(1)}% is excellent`,
      details: 'You are building wealth effectively through disciplined saving'
    });
  } else if (savingsRate >= 10) {
    analysis.push({
      aspect: 'Savings Rate',
      status: 'GOOD',
      message: `Savings rate of ${savingsRate.toFixed(1)}% is good`,
      details: 'Continue working towards a 20% savings rate for optimal wealth building'
    });
  }

  return analysis;
}

function analyzeSpendingPatterns(incomes = [], expenses = []) {
  const patterns = [];
  
  const weeklySpending = {};
  expenses.forEach(expense => {
    if (!expense || !expense.date) return;
    const week = moment(expense.date).format('YYYY-[W]WW');
    weeklySpending[week] = (weeklySpending[week] || 0) + (expense.amount || 0);
  });

  const weeklyAverages = Object.values(weeklySpending);
  const avgWeeklySpending = weeklyAverages.length > 0 
    ? weeklyAverages.reduce((a, b) => a + b, 0) / weeklyAverages.length 
    : 0;

  patterns.push({
    pattern: 'WEEKLY_SPENDING',
    average: avgWeeklySpending,
    trend: 'STABLE',
    insight: `You spend about $${avgWeeklySpending.toFixed(2)} weekly on average`
  });

  const categoryPatterns = {};
  expenses.forEach(expense => {
    if (!expense || !expense.category) return;
    if (!categoryPatterns[expense.category]) {
      categoryPatterns[expense.category] = {
        total: 0,
        count: 0,
        average: 0
      };
    }
    categoryPatterns[expense.category].total += expense.amount || 0;
    categoryPatterns[expense.category].count += 1;
  });

  Object.keys(categoryPatterns).forEach(category => {
    if (categoryPatterns[category].count > 0) {
      categoryPatterns[category].average = 
        categoryPatterns[category].total / categoryPatterns[category].count;
    }
  });

  patterns.push({
    pattern: 'CATEGORY_BREAKDOWN',
    categories: categoryPatterns,
    insight: 'Your spending is distributed across different categories'
  });

  return patterns;
}

function predictFutureSpending(expenses = []) {
  if (!expenses || expenses.length === 0) {
    return {
      nextMonthPrediction: 0,
      confidence: 'LOW',
      factors: ['Insufficient data for prediction'],
      recommendation: 'Start tracking expenses to get accurate predictions'
    };
  }

  const monthlySpending = {};
  expenses.forEach(expense => {
    if (!expense || !expense.date) return;
    const month = moment(expense.date).format('YYYY-MM');
    monthlySpending[month] = (monthlySpending[month] || 0) + (expense.amount || 0);
  });

  const spendingValues = Object.values(monthlySpending);
  const avgMonthlySpending = spendingValues.length > 0 
    ? spendingValues.reduce((a, b) => a + b, 0) / spendingValues.length 
    : 0;

  return {
    nextMonthPrediction: avgMonthlySpending,
    confidence: spendingValues.length >= 3 ? 'HIGH' : 'MEDIUM',
    factors: [
      'Historical spending patterns',
      'Seasonal variations',
      'Recent spending trends'
    ],
    recommendation: 'Budget 10-15% more than predicted for unexpected expenses'
  };
}

function identifySavingsOpportunities(expenses = []) {
  const opportunities = [];

  const recurringTitles = {};
  expenses.forEach(expense => {
    if (!expense || !expense.title) return;
    const title = expense.title.toLowerCase();
    recurringTitles[title] = (recurringTitles[title] || 0) + 1;
  });

  Object.entries(recurringTitles)
    .filter(([_, count]) => count > 3)
    .forEach(([title, count]) => {
      const relatedExpenses = expenses.filter(exp => 
        exp && exp.title && exp.title.toLowerCase() === title
      );
      const totalAmount = relatedExpenses.reduce((sum, exp) => sum + (exp?.amount || 0), 0);
      
      opportunities.push({
        type: 'RECURRING_EXPENSE',
        title: `Frequent: ${title}`,
        frequency: `${count} times`,
        totalAmount: totalAmount,
        suggestion: 'Consider if this recurring expense can be reduced or eliminated',
        potentialSavings: `Up to $${(totalAmount * 0.2).toFixed(2)} monthly`
      });
    });

  const highExpenses = expenses
    .filter(exp => exp && exp.amount > 500)
    .sort((a, b) => (b?.amount || 0) - (a?.amount || 0))
    .slice(0, 5);

  highExpenses.forEach(expense => {
    if (!expense) return;
    opportunities.push({
      type: 'HIGH_VALUE',
      title: `Large expense: ${expense.title || 'Unknown'}`,
      amount: expense.amount || 0,
      date: expense.date,
      suggestion: 'Review if this large expense was necessary or could be optimized',
      category: expense.category || 'Unknown'
    });
  });

  return opportunities.slice(0, 5);
}

function assessFinancialRisk(incomes = [], expenses = []) {
  const totalIncome = incomes.reduce((sum, inc) => sum + (inc?.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp?.amount || 0), 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  if (netSavings < 0) return 'HIGH';
  if (savingsRate < 10) return 'MEDIUM';
  if (savingsRate < 20) return 'LOW';
  return 'VERY_LOW';
}

function generateInvestmentSuggestions(financialData) {
  const suggestions = [];
  const { netSavings = 0, savingsRate = 0 } = financialData;

  if (netSavings > 5000 && savingsRate > 15) {
    suggestions.push({
      type: 'STOCK_MARKET',
      title: 'Stock Market Investment',
      description: 'Consider low-cost index funds for long-term growth',
      risk: 'MEDIUM',
      potentialReturn: '7-10% annually',
      minimum: '$1000',
      timeframe: '5+ years'
    });
  }

  if (netSavings > 1000) {
    suggestions.push({
      type: 'HIGH_YIELD_SAVINGS',
      title: 'High-Yield Savings Account',
      description: 'Earn better interest than traditional savings accounts',
      risk: 'LOW',
      potentialReturn: '4-5% annually',
      minimum: '$0',
      timeframe: 'Flexible'
    });
  }

  if (netSavings > 3000) {
    suggestions.push({
      type: 'REAL_ESTATE',
      title: 'Real Estate Investment Trusts (REITs)',
      description: 'Invest in real estate without buying property directly',
      risk: 'MEDIUM',
      potentialReturn: '8-12% annually',
      minimum: '$500',
      timeframe: '3+ years'
    });
  }

  return suggestions;
}

function identifyQuickWins(expenses = []) {
  const quickWins = [];
  
  const subscriptionKeywords = ['netflix', 'spotify', 'prime', 'disney', 'hulu', 'subscription'];
  const subscriptions = expenses.filter(exp => {
    if (!exp || !exp.description) return false;
    
    const description = exp.description.toLowerCase();
    return subscriptionKeywords.some(keyword => {
      if (!keyword) return false;
      return description.includes(keyword.toLowerCase());
    });
  });

  if (subscriptions.length > 0) {
    const monthlySubscriptions = subscriptions.reduce((sum, sub) => sum + (sub?.amount || 0), 0);
    quickWins.push({
      type: 'SUBSCRIPTION_REVIEW',
      title: 'Review Subscriptions',
      potentialSavings: `$${(monthlySubscriptions * 0.3).toFixed(2)} monthly`,
      effort: 'LOW',
      impact: 'MEDIUM',
      action: 'Cancel 1-2 unused subscriptions'
    });
  }

  const diningExpenses = expenses.filter(exp => {
    if (!exp || !exp.category || !exp.title) return false;
    
    return exp.category === 'Food' && 
           (exp.title.toLowerCase().includes('restaurant') || 
            exp.title.toLowerCase().includes('dining'));
  });

  if (diningExpenses.length > 0) {
    const diningTotal = diningExpenses.reduce((sum, exp) => sum + (exp?.amount || 0), 0);
    quickWins.push({
      type: 'DINING_REDUCTION',
      title: 'Reduce Dining Out',
      potentialSavings: `$${(diningTotal * 0.2).toFixed(2)} monthly`,
      effort: 'MEDIUM',
      impact: 'HIGH',
      action: 'Cook at home 2 more times per week'
    });
  }

  return quickWins;
}

function projectNextMonth(financialData, expenses = []) {
  const { currentMonthIncome = 0, currentMonthExpense = 0 } = financialData;
  
  const recentExpenses = expenses.filter(exp => {
    if (!exp || !exp.date) return false;
    return moment(exp.date).isAfter(moment().subtract(3, 'months'));
  });

  const avgRecentExpenses = recentExpenses.length > 0 
    ? recentExpenses.reduce((sum, exp) => sum + (exp?.amount || 0), 0) / 3
    : currentMonthExpense;

  return {
    projectedIncome: currentMonthIncome,
    projectedExpenses: avgRecentExpenses,
    projectedSavings: currentMonthIncome - avgRecentExpenses,
    confidence: recentExpenses.length >= 10 ? 'HIGH' : 'MEDIUM'
  };
}

// Default tips for new users
function getDefaultIncomeTips() {
  return [
    {
      type: 'DIVERSIFICATION',
      title: 'Start Multiple Income Streams',
      message: 'Consider having at least 2-3 different income sources',
      priority: 'HIGH',
      action: 'Explore freelance opportunities or part-time work',
      potentialImpact: 'High'
    }
  ];
}

function getDefaultExpenseTips() {
  return [
    {
      type: 'TRACKING',
      title: 'Track Every Expense',
      message: 'Start by recording all your expenses for better visibility',
      priority: 'HIGH',
      action: 'Use this app to log daily expenses',
      potentialImpact: 'High'
    }
  ];
}

function getDefaultSavingTips() {
  return [
    {
      type: 'EMERGENCY_FUND',
      title: 'Build Basic Emergency Fund',
      message: 'Aim to save 3 months of essential expenses',
      priority: 'HIGH',
      action: 'Set aside a fixed amount from each income',
      potentialImpact: 'High'
    }
  ];
}