const Income = require('../models/Income');
const Expense = require('../models/Expense');
const axios = require('axios');
const moment = require('moment');

// @desc    AI-powered financial management and analysis
// @route   POST /api/ai/manage
// @access  Private
exports.aiFinancialManagement = async (req, res) => {
  try {
    const userId = req.user._id;
    const { message, action, data } = req.body;

    // Get user's financial data
    const [incomes, expenses] = await Promise.all([
      Income.find({ user: userId }).sort({ date: -1 }),
      Expense.find({ user: userId }).sort({ date: -1 })
    ]);

    // Process AI request
    const result = await processAIManagementRequest(userId, message, action, data, incomes, expenses);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'AI management service temporarily unavailable',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getAIRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const [incomes, expenses] = await Promise.all([
      Income.find({ user: userId }),
      Expense.find({ user: userId })
    ]);

    const recommendations = await generateAIRecommendations(incomes, expenses);
    
    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate recommendations'
    });
  }
};

// @desc    AI-powered expense categorization
// @route   POST /api/ai/categorize
// @access  Private
exports.aiCategorizeExpense = async (req, res) => {
  try {
    const { title, amount, description } = req.body;
    
    const suggestedCategory = await suggestExpenseCategory(title, amount, description);
    
    res.json({
      success: true,
      suggestedCategory,
      confidence: suggestedCategory.confidence || 'high'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to categorize expense'
    });
  }
};

async function processAIManagementRequest(userId, message, action, data, incomes, expenses) {
  const financialSummary = generateFinancialSummary(incomes, expenses);
  
  if (action) {
    return await handleSpecificAction(userId, action, data, financialSummary);
  }

  // If message contains natural language request
  if (message) {
    return await handleNaturalLanguageRequest(userId, message, financialSummary, incomes, expenses);
  }

  // Default response with financial overview
  return {
    message: generateInitialResponse(financialSummary),
    summary: financialSummary,
    suggestions: await generateQuickSuggestions(financialSummary),
    actions: getAvailableActions()
  };
}

async function handleSpecificAction(userId, action, data, financialSummary) {
  switch (action) {
    case 'add_income':
      return await handleAddIncome(userId, data, financialSummary);
    
    case 'add_expense':
      return await handleAddExpense(userId, data, financialSummary);
    
    case 'analyze_spending':
      return await handleSpendingAnalysis(financialSummary);
    
    case 'savings_advice':
      return await handleSavingsAdvice(financialSummary);
    
    case 'budget_suggestions':
      return await handleBudgetSuggestions(financialSummary);
    
    default:
      return {
        message: "I can help you manage your finances. You can add income/expenses, analyze spending, or get savings advice.",
        actions: getAvailableActions()
      };
  }
}

async function handleNaturalLanguageRequest(userId, message, financialSummary, incomes, expenses) {
  const lowerMessage = message.toLowerCase();
  
  // Pattern matching for common requests
  if (lowerMessage.includes('add income') || lowerMessage.includes('new income')) {
    return await handleAddIncomeFromText(userId, message, financialSummary);
  }
  
  if (lowerMessage.includes('add expense') || lowerMessage.includes('spent') || lowerMessage.includes('bought')) {
    return await handleAddExpenseFromText(userId, message, financialSummary);
  }
  
  if (lowerMessage.includes('how much') || lowerMessage.includes('show me') || lowerMessage.includes('tell me')) {
    return await handleQueryRequest(message, financialSummary, incomes, expenses);
  }
  
  if (lowerMessage.includes('savings') || lowerMessage.includes('save money')) {
    return await handleSavingsAdvice(financialSummary);
  }
  
  if (lowerMessage.includes('budget') || lowerMessage.includes('spending limit')) {
    return await handleBudgetSuggestions(financialSummary);
  }

  // Use AI for complex queries
  return await handleAIQuery(message, financialSummary, incomes, expenses);
}

// Income Management
async function handleAddIncome(userId, data, financialSummary) {
  try {
    const income = await Income.create({
      user: userId,
      title: data.title,
      amount: data.amount,
      category: data.category || 'Other',
      description: data.description,
      date: data.date || new Date()
    });

    const updatedSummary = generateFinancialSummary(
      [...(financialSummary.incomes || []), income],
      financialSummary.expenses || []
    );

    return {
      message: `✅ Income added successfully! ${data.title} - $${data.amount}`,
      data: income,
      summary: updatedSummary,
      suggestion: generateIncomeSuggestion(updatedSummary)
    };
  } catch (error) {
    throw new Error('Failed to add income: ' + error.message);
  }
}

async function handleAddIncomeFromText(userId, message, financialSummary) {
  // Simple text parsing for income
  const amountMatch = message.match(/\$?(\d+(?:\.\d{2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
  
  let title = 'Income';
  if (message.includes('salary')) title = 'Salary';
  else if (message.includes('freelance')) title = 'Freelance Work';
  else if (message.includes('investment')) title = 'Investment';
  
  const category = title === 'Income' ? 'Other' : title;

  if (!amount) {
    return {
      message: "I'd be happy to add income for you! Please specify the amount, for example: 'Add income of $500 for freelance work'",
      requires: ['amount', 'description']
    };
  }

  return await handleAddIncome(userId, {
    title,
    amount,
    category,
    description: `Added via AI: ${message}`
  }, financialSummary);
}

// Expense Management
async function handleAddExpense(userId, data, financialSummary) {
  try {
    // Auto-categorize if not provided
    let category = data.category;
    if (!category) {
      const suggested = await suggestExpenseCategory(data.title, data.amount, data.description);
      category = suggested.category;
    }

    const expense = await Expense.create({
      user: userId,
      title: data.title,
      amount: data.amount,
      category: category,
      description: data.description,
      date: data.date || new Date()
    });

    const updatedSummary = generateFinancialSummary(
      financialSummary.incomes || [],
      [...(financialSummary.expenses || []), expense]
    );

    return {
      message: `✅ Expense recorded! ${data.title} - $${data.amount} (${category})`,
      data: expense,
      summary: updatedSummary,
      warning: checkExpenseWarning(updatedSummary, expense),
      suggestion: generateExpenseSuggestion(updatedSummary)
    };
  } catch (error) {
    throw new Error('Failed to add expense: ' + error.message);
  }
}

async function handleAddExpenseFromText(userId, message, financialSummary) {
  const amountMatch = message.match(/\$?(\d+(?:\.\d{2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
  
  let category = 'Other';
  let title = 'Expense';
  
  // Simple category detection
  if (message.includes('food') || message.includes('restaurant') || message.includes('grocery')) {
    category = 'Food';
    title = 'Food Expense';
  } else if (message.includes('transport') || message.includes('fuel') || message.includes('uber')) {
    category = 'Transport';
    title = 'Transportation';
  } else if (message.includes('bill') || message.includes('utility') || message.includes('electric')) {
    category = 'Bills';
    title = 'Utility Bill';
  } else if (message.includes('shopping') || message.includes('buy') || message.includes('purchase')) {
    category = 'Shopping';
    title = 'Shopping';
  }

  if (!amount) {
    return {
      message: "I can help you record that expense! Please specify the amount, for example: 'Spent $45 on groceries'",
      requires: ['amount']
    };
  }

  return await handleAddExpense(userId, {
    title,
    amount,
    category,
    description: `Added via AI: ${message}`
  }, financialSummary);
}

// Analysis Functions
async function handleSpendingAnalysis(financialSummary) {
  const { currentMonthIncome, currentMonthExpense, expenseByCategory } = financialSummary;
  
  const spendingRate = (currentMonthExpense / currentMonthIncome) * 100;
  const topCategory = expenseByCategory[0];
  
  let analysis = `Your current spending rate is ${spendingRate.toFixed(1)}% of income. `;
  
  if (spendingRate > 80) {
    analysis += "⚠️ Your spending is quite high. Consider reviewing discretionary expenses.";
  } else if (spendingRate > 60) {
    analysis += "📊 Your spending is moderate. Look for opportunities to optimize.";
  } else {
    analysis += "✅ Great! Your spending is well-controlled.";
  }
  
  if (topCategory) {
    analysis += ` Your top spending category is ${topCategory.category} (${topCategory.percentage}%).`;
  }

  return {
    message: analysis,
    analysis: {
      spendingRate: spendingRate.toFixed(1),
      topCategory: topCategory?.category,
      recommendation: generateSpendingRecommendation(spendingRate)
    }
  };
}

async function handleSavingsAdvice(financialSummary) {
  const { currentMonthIncome, currentMonthExpense, currentMonthSavings } = financialSummary;
  const savingsRate = (currentMonthSavings / currentMonthIncome) * 100;
  
  let advice = `Your current savings rate is ${savingsRate.toFixed(1)}%. `;
  
  if (savingsRate < 10) {
    advice += "🚨 Consider increasing your savings. Try to save at least 20% of your income. ";
    advice += "Review your expenses in Food, Entertainment, and Shopping categories.";
  } else if (savingsRate < 20) {
    advice += "📈 Good start! Aim for 20% savings rate. ";
    advice += "Consider setting up automatic transfers to savings account.";
  } else {
    advice += "🎉 Excellent savings habit! ";
    advice += "Consider investing your surplus for long-term growth.";
  }

  return {
    message: advice,
    tips: generateSavingsTips(savingsRate)
  };
}

async function suggestExpenseCategory(title, amount, description) {
  const expenseKeywords = {
    Food: ['food', 'grocery', 'restaurant', 'dining', 'meal', 'cafe', 'supermarket'],
    Transport: ['transport', 'fuel', 'gas', 'uber', 'lyft', 'taxi', 'bus', 'train', 'metro'],
    Bills: ['bill', 'utility', 'electric', 'water', 'internet', 'phone', 'rent', 'mortgage'],
    Shopping: ['shopping', 'buy', 'purchase', 'mall', 'store', 'amazon', 'online'],
    Entertainment: ['movie', 'concert', 'game', 'netflix', 'spotify', 'entertainment'],
    Healthcare: ['medical', 'doctor', 'hospital', 'medicine', 'pharmacy', 'health'],
    Education: ['education', 'course', 'book', 'tuition', 'school', 'learning']
  };

  const text = `${title} ${description}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(expenseKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return { category, confidence: 'high' };
    }
  }

  // Amount-based categorization for fallback
  if (amount < 50) return { category: 'Food', confidence: 'low' };
  if (amount < 200) return { category: 'Shopping', confidence: 'medium' };
  return { category: 'Other', confidence: 'low' };
}

async function handleAIQuery(message, financialSummary, incomes, expenses) {
  try {
    if (process.env.OPENAI_API_KEY) {
      const prompt = `
You are a financial assistant. Answer the user's question based on their financial data.

Financial Summary:
- Monthly Income: $${financialSummary.currentMonthIncome}
- Monthly Expenses: $${financialSummary.currentMonthExpense}
- Monthly Savings: $${financialSummary.currentMonthSavings}
- Savings Rate: ${((financialSummary.currentMonthSavings / financialSummary.currentMonthIncome) * 100).toFixed(1)}%
- Top Expense Categories: ${financialSummary.expenseByCategory.slice(0, 3).map(cat => `${cat.category} (${cat.percentage}%)`).join(', ')}

Recent Transactions (last 5):
Incomes: ${incomes.slice(0, 5).map(inc => `${inc.title}: $${inc.amount}`).join(', ')}
Expenses: ${expenses.slice(0, 5).map(exp => `${exp.title}: $${exp.amount} (${exp.category})`).join(', ')}

User Question: "${message}"

Provide a helpful, concise response with specific insights from their data. If they ask about adding transactions, guide them on how to do it.
`;

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        message: response.data.choices[0].message.content,
        type: 'ai_response'
      };
    }
  } catch (error) {
    // console.error('AI Query error:', error);
  }

  return {
    message: "I can help you manage your finances! You can ask me to add income/expenses, analyze your spending, or get savings advice. Try: 'Add $50 expense for lunch' or 'How am I spending my money?'",
    type: 'fallback'
  };
}

function generateFinancialSummary(incomes, expenses) {
  const currentMonthStart = moment().startOf('month');
  const currentMonthEnd = moment().endOf('month');
  
  const currentMonthIncome = incomes
    .filter(inc => moment(inc.date).isBetween(currentMonthStart, currentMonthEnd))
    .reduce((sum, inc) => sum + inc.amount, 0);
  
  const currentMonthExpense = expenses
    .filter(exp => moment(exp.date).isBetween(currentMonthStart, currentMonthEnd))
    .reduce((sum, exp) => sum + exp.amount, 0);
  
  const currentMonthSavings = currentMonthIncome - currentMonthExpense;
  
  // Category breakdown
  const categoryMap = {};
  expenses.forEach(exp => {
    categoryMap[exp.category] = (categoryMap[exp.category] || 0) + exp.amount;
  });
  
  const expenseByCategory = Object.entries(categoryMap)
    .map(([category, total]) => ({
      category,
      total,
      percentage: ((total / currentMonthExpense) * 100).toFixed(1)
    }))
    .sort((a, b) => b.total - a.total);

  return {
    currentMonthIncome,
    currentMonthExpense,
    currentMonthSavings,
    expenseByCategory,
    totalIncomes: incomes.length,
    totalExpenses: expenses.length
  };
}

function generateInitialResponse(summary) {
  const { currentMonthIncome, currentMonthExpense, currentMonthSavings } = summary;
  const savingsRate = ((currentMonthSavings / currentMonthIncome) * 100).toFixed(1);
  
  if (currentMonthIncome === 0 && currentMonthExpense === 0) {
    return "Welcome! I'm your AI financial assistant. I can help you manage income and expenses, analyze spending, and provide savings advice. Start by adding your first transaction!";
  }
  
  return `Hello! I'm monitoring your finances. This month you've earned $${currentMonthIncome} and spent $${currentMonthExpense}, saving $${currentMonthSavings} (${savingsRate}% savings rate). How can I help you today?`;
}

function generateQuickSuggestions(summary) {
  const suggestions = [];
  
  if (summary.currentMonthSavings < 0) {
    suggestions.push("⚠️ You're spending more than you earn. Let's review your expenses.");
  }
  
  if (summary.expenseByCategory.length > 0) {
    const topCategory = summary.expenseByCategory[0];
    if (parseFloat(topCategory.percentage) > 40) {
      suggestions.push(`💰 Your ${topCategory.category} spending is ${topCategory.percentage}% of total expenses. Consider optimizing this category.`);
    }
  }
  
  if (summary.currentMonthSavings > summary.currentMonthIncome * 0.2) {
    suggestions.push("🎉 Great savings rate! Consider investment options for your surplus.");
  }
  
  return suggestions.length > 0 ? suggestions : ["Your finances look healthy! Keep tracking your expenses regularly."];
}

function getAvailableActions() {
  return [
    { action: 'add_income', label: 'Add Income', description: 'Record new income' },
    { action: 'add_expense', label: 'Add Expense', description: 'Record new expense' },
    { action: 'analyze_spending', label: 'Analyze Spending', description: 'Get spending analysis' },
    { action: 'savings_advice', label: 'Savings Advice', description: 'Get savings tips' },
    { action: 'budget_suggestions', label: 'Budget Tips', description: 'Get budgeting advice' }
  ];
}

function generateIncomeSuggestion(summary) {
  if (summary.currentMonthIncome < 1000) {
    return "Consider exploring additional income sources to boost your earnings.";
  }
  return "Great income level! Consider setting aside 20% for savings.";
}

function generateExpenseSuggestion(summary) {
  if (summary.currentMonthExpense > summary.currentMonthIncome * 0.8) {
    return "Your expenses are high relative to income. Review discretionary spending.";
  }
  return "Your expenses are well-managed. Keep tracking!";
}

function checkExpenseWarning(summary, expense) {
  if (expense.amount > summary.currentMonthIncome * 0.3) {
    return "This is a significant expense. Ensure it fits your budget.";
  }
  return null;
}

function generateSpendingRecommendation(spendingRate) {
  if (spendingRate > 80) return "Focus on reducing discretionary expenses first.";
  if (spendingRate > 60) return "Look for optimization opportunities in your top categories.";
  return "Your spending is well-balanced. Maintain this pattern.";
}

function generateSavingsTips(savingsRate) {
  const tips = [];
  
  if (savingsRate < 10) {
    tips.push("Set up automatic transfers to savings on payday");
    tips.push("Review and reduce subscription services");
    tips.push("Cook at home more often to save on food expenses");
  } else if (savingsRate < 20) {
    tips.push("Increase your savings rate by 1% each month");
    tips.push("Consider a high-yield savings account");
    tips.push("Set specific savings goals for motivation");
  } else {
    tips.push("Explore investment options for long-term growth");
    tips.push("Consider maxing out retirement contributions");
    tips.push("Build an emergency fund covering 6 months of expenses");
  }
  
  return tips;
}

async function generateAIRecommendations(incomes, expenses) {
  const summary = generateFinancialSummary(incomes, expenses);
  const recommendations = [];

  // Spending recommendations
  if (summary.expenseByCategory.length > 0) {
    const topCategory = summary.expenseByCategory[0];
    if (parseFloat(topCategory.percentage) > 35) {
      recommendations.push({
        type: 'spending_optimization',
        title: `Reduce ${topCategory.category} Spending`,
        description: `Your ${topCategory.category} expenses account for ${topCategory.percentage}% of total spending. Consider ways to optimize this category.`,
        priority: 'high'
      });
    }
  }

  // Savings recommendations
  const savingsRate = (summary.currentMonthSavings / summary.currentMonthIncome) * 100;
  if (savingsRate < 15) {
    recommendations.push({
      type: 'savings_boost',
      title: 'Increase Savings Rate',
      description: `Your current savings rate is ${savingsRate.toFixed(1)}%. Aim for 20% by reducing discretionary expenses.`,
      priority: 'medium'
    });
  }

  // Income recommendations
  if (summary.currentMonthIncome < 3000 && incomes.length < 3) {
    recommendations.push({
      type: 'income_diversification',
      title: 'Diversify Income Sources',
      description: 'Consider adding additional income streams through freelancing, investments, or side projects.',
      priority: 'low'
    });
  }

  return recommendations;
}

async function handleBudgetSuggestions(financialSummary) {
  const { currentMonthIncome, expenseByCategory } = financialSummary;
  
  const budgetSuggestions = expenseByCategory.map(cat => {
    const currentAmount = cat.total;
    const suggestedBudget = currentMonthIncome * getCategoryBudgetPercentage(cat.category);
    
    return {
      category: cat.category,
      currentSpending: currentAmount,
      suggestedBudget: suggestedBudget,
      difference: suggestedBudget - currentAmount,
      recommendation: currentAmount > suggestedBudget ? 
        `Reduce ${cat.category} spending by $${(currentAmount - suggestedBudget).toFixed(2)}` :
        `Your ${cat.category} spending is within recommended limits`
    };
  });

  return {
    message: "Here are your personalized budget suggestions based on your income and spending patterns:",
    suggestions: budgetSuggestions,
    note: "These are general guidelines. Adjust based on your personal financial goals."
  };
}

function getCategoryBudgetPercentage(category) {
  const budgetPercentages = {
    'Food': 0.15,
    'Transport': 0.10,
    'Bills': 0.25,
    'Shopping': 0.10,
    'Entertainment': 0.05,
    'Healthcare': 0.05,
    'Education': 0.05,
    'Other': 0.05
  };
  
  return budgetPercentages[category] || 0.05;
}

async function handleQueryRequest(message, financialSummary, incomes, expenses) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('balance') || lowerMessage.includes('how much money')) {
    const balance = financialSummary.currentMonthIncome - financialSummary.currentMonthExpense;
    return {
      message: `Your current monthly balance is $${balance}. You've earned $${financialSummary.currentMonthIncome} and spent $${financialSummary.currentMonthExpense} this month.`,
      data: { balance, income: financialSummary.currentMonthIncome, expenses: financialSummary.currentMonthExpense }
    };
  }
  
  if (lowerMessage.includes('spent on') || lowerMessage.includes('spending on')) {
    const category = extractCategoryFromQuery(message);
    if (category) {
      const categoryExpenses = expenses.filter(exp => exp.category.toLowerCase() === category.toLowerCase());
      const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      return {
        message: `You've spent $${total} on ${category} this month.`,
        data: { category, total, transactions: categoryExpenses.length }
      };
    }
  }
  
  if (lowerMessage.includes('saved') || lowerMessage.includes('savings')) {
    const savingsRate = ((financialSummary.currentMonthSavings / financialSummary.currentMonthIncome) * 100).toFixed(1);
    return {
      message: `You've saved $${financialSummary.currentMonthSavings} this month, which is ${savingsRate}% of your income.`,
      data: { savings: financialSummary.currentMonthSavings, rate: savingsRate }
    };
  }
  
  return {
    message: "I can tell you about your balance, spending by category, or savings. Try: 'How much have I spent on food?' or 'What's my current balance?'",
    examples: [
      "How much have I spent on transportation?",
      "What's my current balance?",
      "How much have I saved this month?"
    ]
  };
}

function extractCategoryFromQuery(message) {
  const categories = ['food', 'transport', 'bills', 'shopping', 'entertainment', 'healthcare', 'education'];
  for (const category of categories) {
    if (message.toLowerCase().includes(category)) {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }
  return null;
}