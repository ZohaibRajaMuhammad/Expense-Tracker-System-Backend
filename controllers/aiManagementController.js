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
    console.error('AI Management Error:', error);
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
    console.error('Recommendations Error:', error);
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
    console.error('Categorization Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to categorize expense'
    });
  }
};

// @desc    Check AI service health
// @route   GET /api/ai/health
// @access  Private
exports.checkAIHealth = async (req, res) => {
  try {
    const health = await checkAIServiceHealth();
    res.json({
      success: true,
      ...health
    });
  } catch (error) {
    res.json({
      success: false,
      available: false,
      reason: error.message
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
    
    case 'financial_health':
      return await handleFinancialHealthCheck(financialSummary);
    
    default:
      return {
        message: "I can help you manage your finances. You can add income/expenses, analyze spending, or get savings advice.",
        actions: getAvailableActions()
      };
  }
}

async function handleNaturalLanguageRequest(userId, message, financialSummary, incomes, expenses) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced pattern matching for common requests
  if (lowerMessage.includes('add income') || lowerMessage.includes('new income') || lowerMessage.includes('received') || lowerMessage.includes('earned')) {
    return await handleAddIncomeFromText(userId, message, financialSummary);
  }
  
  if (lowerMessage.includes('add expense') || lowerMessage.includes('spent') || lowerMessage.includes('bought') || lowerMessage.includes('paid for')) {
    return await handleAddExpenseFromText(userId, message, financialSummary);
  }
  
  if (lowerMessage.includes('how much') || lowerMessage.includes('show me') || lowerMessage.includes('tell me') || lowerMessage.includes('what is my')) {
    return await handleQueryRequest(message, financialSummary, incomes, expenses);
  }
  
  if (lowerMessage.includes('savings') || lowerMessage.includes('save money') || lowerMessage.includes('save more')) {
    return await handleSavingsAdvice(financialSummary);
  }
  
  if (lowerMessage.includes('budget') || lowerMessage.includes('spending limit') || lowerMessage.includes('how much should i spend')) {
    return await handleBudgetSuggestions(financialSummary);
  }

  if (lowerMessage.includes('financial health') || lowerMessage.includes('how am i doing') || lowerMessage.includes('financial situation')) {
    return await handleFinancialHealthCheck(financialSummary);
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
  // Enhanced text parsing for income
  const amountMatch = message.match(/\$?(\d+(?:\.\d{2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
  
  let title = 'Income';
  let category = 'Other';
  
  // Enhanced category detection
  if (message.includes('salary') || message.includes('paycheck') || message.includes('wage')) {
    title = 'Salary';
    category = 'Salary';
  } else if (message.includes('freelance') || message.includes('contract') || message.includes('gig')) {
    title = 'Freelance Work';
    category = 'Freelance';
  } else if (message.includes('investment') || message.includes('dividend') || message.includes('stock')) {
    title = 'Investment Income';
    category = 'Investment';
  } else if (message.includes('bonus') || message.includes('commission')) {
    title = 'Bonus';
    category = 'Bonus';
  } else if (message.includes('business') || message.includes('side hustle')) {
    title = 'Business Income';
    category = 'Business';
  }

  if (!amount) {
    return {
      message: "I'd be happy to add income for you! Please specify the amount, for example: 'Add income of $500 for freelance work'",
      requires: ['amount', 'description'],
      examples: [
        "Add income $1500 salary",
        "Received $300 freelance payment",
        "Earned $200 from side business"
      ]
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
  
  // Enhanced category detection
  if (message.includes('food') || message.includes('restaurant') || message.includes('grocery') || message.includes('lunch') || message.includes('dinner')) {
    category = 'Food';
    title = 'Food Expense';
  } else if (message.includes('transport') || message.includes('fuel') || message.includes('gas') || message.includes('uber') || message.includes('taxi') || message.includes('bus')) {
    category = 'Transport';
    title = 'Transportation';
  } else if (message.includes('bill') || message.includes('utility') || message.includes('electric') || message.includes('water') || message.includes('internet') || message.includes('phone')) {
    category = 'Bills';
    title = 'Utility Bill';
  } else if (message.includes('shopping') || message.includes('buy') || message.includes('purchase') || message.includes('amazon') || message.includes('mall')) {
    category = 'Shopping';
    title = 'Shopping';
  } else if (message.includes('entertainment') || message.includes('movie') || message.includes('netflix') || message.includes('game') || message.includes('concert')) {
    category = 'Entertainment';
    title = 'Entertainment';
  } else if (message.includes('health') || message.includes('medical') || message.includes('doctor') || message.includes('hospital') || message.includes('medicine')) {
    category = 'Healthcare';
    title = 'Healthcare';
  }

  if (!amount) {
    return {
      message: "I can help you record that expense! Please specify the amount, for example: 'Spent $45 on groceries'",
      requires: ['amount'],
      examples: [
        "Spent $25 on lunch",
        "Paid $100 for electricity bill",
        "Bought groceries for $85"
      ]
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
  
  if (currentMonthIncome === 0) {
    return {
      message: "I don't see any income data for this month. Add your income first to get spending analysis.",
      analysis: null
    };
  }
  
  const spendingRate = (currentMonthExpense / currentMonthIncome) * 100;
  const topCategory = expenseByCategory[0];
  
  let analysis = `Your current spending rate is ${spendingRate.toFixed(1)}% of income. `;
  
  if (spendingRate > 80) {
    analysis += "⚠️ Your spending is quite high. Consider reviewing discretionary expenses like dining out and entertainment.";
  } else if (spendingRate > 60) {
    analysis += "📊 Your spending is moderate. Look for optimization opportunities in your top categories.";
  } else if (spendingRate > 40) {
    analysis += "✅ Good spending control. You're maintaining a healthy balance between spending and saving.";
  } else {
    analysis += "🎉 Excellent! Your spending is well below your means, leaving room for savings and investments.";
  }
  
  if (topCategory && currentMonthExpense > 0) {
    analysis += ` Your top spending category is ${topCategory.category} (${topCategory.percentage}% of total expenses).`;
  }

  return {
    message: analysis,
    analysis: {
      spendingRate: spendingRate.toFixed(1),
      topCategory: topCategory?.category,
      topCategoryPercentage: topCategory?.percentage,
      recommendation: generateSpendingRecommendation(spendingRate)
    }
  };
}

async function handleSavingsAdvice(financialSummary) {
  const { currentMonthIncome, currentMonthExpense, currentMonthSavings } = financialSummary;
  
  if (currentMonthIncome === 0) {
    return {
      message: "I don't see any income data for this month. Add your income to get personalized savings advice.",
      tips: []
    };
  }
  
  const savingsRate = (currentMonthSavings / currentMonthIncome) * 100;
  
  let advice = `Your current savings rate is ${savingsRate.toFixed(1)}%. `;
  
  if (savingsRate < 0) {
    advice += "🚨 You're spending more than you earn. Focus on reducing expenses immediately. ";
    advice += "Review your spending in discretionary categories and consider temporary cuts.";
  } else if (savingsRate < 10) {
    advice += "⚠️ Consider increasing your savings. Try to save at least 20% of your income. ";
    advice += "Start by reviewing recurring subscriptions and dining out expenses.";
  } else if (savingsRate < 20) {
    advice += "📈 Good start! Aim for 20% savings rate. ";
    advice += "Consider setting up automatic transfers to savings account on payday.";
  } else if (savingsRate < 30) {
    advice += "✅ Great savings habit! ";
    advice += "You're building a solid financial foundation. Consider exploring investment options.";
  } else {
    advice += "🎉 Excellent savings rate! ";
    advice += "You're well on your way to financial independence. Consider maxing out retirement accounts and exploring diversified investments.";
  }

  return {
    message: advice,
    tips: generateSavingsTips(savingsRate),
    currentSavingsRate: savingsRate.toFixed(1)
  };
}

async function handleFinancialHealthCheck(financialSummary) {
  const { currentMonthIncome, currentMonthExpense, currentMonthSavings, expenseByCategory } = financialSummary;
  
  if (currentMonthIncome === 0) {
    return {
      message: "I can't provide a financial health check without income data. Please add your income information first.",
      healthScore: 0,
      status: 'Incomplete Data'
    };
  }
  
  const savingsRate = (currentMonthSavings / currentMonthIncome) * 100;
  const spendingRate = (currentMonthExpense / currentMonthIncome) * 100;
  
  let healthScore = 0;
  let status = '';
  let message = '';
  
  // Calculate health score (0-100)
  if (savingsRate >= 20) healthScore += 40;
  else if (savingsRate >= 10) healthScore += 25;
  else if (savingsRate >= 0) healthScore += 10;
  
  if (spendingRate <= 60) healthScore += 30;
  else if (spendingRate <= 80) healthScore += 15;
  
  if (expenseByCategory.length >= 3) healthScore += 15;
  else healthScore += 5;
  
  if (currentMonthSavings > 0) healthScore += 15;
  
  // Determine status
  if (healthScore >= 80) {
    status = 'Excellent';
    message = 'Your financial health is excellent! Keep up the good habits.';
  } else if (healthScore >= 60) {
    status = 'Good';
    message = 'Your financial health is good. There are opportunities for improvement.';
  } else if (healthScore >= 40) {
    status = 'Fair';
    message = 'Your financial health needs attention. Focus on increasing savings.';
  } else {
    status = 'Needs Improvement';
    message = 'Your financial health requires immediate attention. Review spending and increase income.';
  }

  return {
    message: `${message} Your financial health score is ${healthScore}/100.`,
    healthScore,
    status,
    metrics: {
      savingsRate: savingsRate.toFixed(1),
      spendingRate: spendingRate.toFixed(1),
      monthlySavings: currentMonthSavings
    },
    recommendations: generateHealthRecommendations(healthScore, savingsRate, spendingRate)
  };
}

async function suggestExpenseCategory(title, amount, description) {
  const expenseKeywords = {
    Food: ['food', 'grocery', 'restaurant', 'dining', 'meal', 'cafe', 'supermarket', 'lunch', 'dinner', 'breakfast', 'coffee'],
    Transport: ['transport', 'fuel', 'gas', 'uber', 'lyft', 'taxi', 'bus', 'train', 'metro', 'subway', 'parking', 'toll'],
    Bills: ['bill', 'utility', 'electric', 'water', 'internet', 'phone', 'rent', 'mortgage', 'insurance', 'subscription'],
    Shopping: ['shopping', 'buy', 'purchase', 'mall', 'store', 'amazon', 'online', 'clothing', 'electronics', 'fashion'],
    Entertainment: ['movie', 'concert', 'game', 'netflix', 'spotify', 'entertainment', 'hobby', 'sports', 'vacation', 'travel'],
    Healthcare: ['medical', 'doctor', 'hospital', 'medicine', 'pharmacy', 'health', 'dental', 'vision', 'insurance'],
    Education: ['education', 'course', 'book', 'tuition', 'school', 'learning', 'training', 'workshop', 'seminar']
  };

  const text = `${title} ${description}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(expenseKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return { category, confidence: 'high' };
    }
  }

  // Amount-based categorization for fallback
  if (amount < 30) return { category: 'Food', confidence: 'low' };
  if (amount < 100) return { category: 'Shopping', confidence: 'medium' };
  if (amount < 500) return { category: 'Bills', confidence: 'medium' };
  return { category: 'Other', confidence: 'low' };
}

// Enhanced AI Query Function with better error handling and prompts
async function handleAIQuery(message, financialSummary, incomes, expenses) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not configured');
      return getEnhancedFallbackResponse(message, financialSummary);
    }

    const prompt = createEnhancedPrompt(message, financialSummary, incomes, expenses);
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: `You are a helpful financial advisor. Provide specific, actionable advice based on the user's financial data. 
          Be concise but thorough. Reference their actual numbers and categories. 
          If they ask about adding transactions, guide them on the exact format to use. 
          If data is missing, ask for clarification. Always be encouraging but honest about financial health.` 
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    if (validateOpenAIResponse(response)) {
      return {
        message: response.data.choices[0].message.content,
        type: 'ai_response',
        source: 'openai'
      };
    } else {
      throw new Error('Invalid response format from OpenAI');
    }
    
  } catch (error) {
    console.error('AI Query failed:', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    return getEnhancedFallbackResponse(message, financialSummary);
  }
}

function validateOpenAIResponse(response) {
  if (!response.data) return false;
  if (!response.data.choices || !Array.isArray(response.data.choices)) return false;
  if (!response.data.choices[0] || !response.data.choices[0].message) return false;
  if (!response.data.choices[0].message.content) return false;
  return true;
}

function createEnhancedPrompt(message, financialSummary, incomes, expenses) {
  const currentDate = moment().format('MMMM YYYY');
  const lastMonth = moment().subtract(1, 'month').format('MMMM');
  
  // Format recent transactions better
  const recentIncomes = incomes.slice(0, 5).map(inc => 
    `- ${inc.title}: $${inc.amount} (${moment(inc.date).format('MMM DD')})`
  ).join('\n') || 'No recent income';
  
  const recentExpenses = expenses.slice(0, 5).map(exp => 
    `- ${exp.title}: $${exp.amount} (${exp.category}) - ${moment(exp.date).format('MMM DD')}`
  ).join('\n') || 'No recent expenses';

  // Calculate additional metrics
  const savingsRate = ((financialSummary.currentMonthSavings / financialSummary.currentMonthIncome) * 100).toFixed(1);
  const spendingRate = ((financialSummary.currentMonthExpense / financialSummary.currentMonthIncome) * 100).toFixed(1);

  return `
USER FINANCIAL DATA (${currentDate}):

INCOME & EXPENSES:
- Monthly Income: $${financialSummary.currentMonthIncome}
- Monthly Expenses: $${financialSummary.currentMonthExpense}
- Monthly Savings: $${financialSummary.currentMonthSavings}
- Savings Rate: ${savingsRate}%
- Spending Rate: ${spendingRate}%

TOP SPENDING CATEGORIES (this month):
${financialSummary.expenseByCategory.slice(0, 5).map(cat => 
  `- ${cat.category}: $${cat.total} (${cat.percentage}% of expenses)`
).join('\n')}

RECENT INCOME (last 5):
${recentIncomes}

RECENT EXPENSES (last 5):
${recentExpenses}

TRANSACTION HISTORY:
- Total Income Records: ${financialSummary.totalIncomes}
- Total Expense Records: ${financialSummary.totalExpenses}

USER QUESTION: "${message}"

INSTRUCTIONS FOR RESPONSE:
1. Analyze their specific financial situation using the data provided
2. Provide personalized, actionable advice based on their actual numbers
3. Reference specific categories, amounts, and percentages from their data
4. If asking about adding transactions, provide exact examples they can use
5. If data is limited, ask clarifying questions
6. Be encouraging but honest about their financial health
7. Keep response under 300 words but make it comprehensive
8. Use specific numbers from their data in your response

RESPONSE:
`;
}

function getEnhancedFallbackResponse(message, financialSummary) {
  const lowerMessage = message.toLowerCase();
  const { currentMonthIncome, currentMonthExpense, currentMonthSavings } = financialSummary;
  
  // More intelligent fallback responses based on message content
  if (lowerMessage.includes('investment') || lowerMessage.includes('invest') || lowerMessage.includes('stock')) {
    return {
      message: `Based on your current savings of $${currentMonthSavings}, consider speaking with a financial advisor about investment options. You're saving ${((currentMonthSavings / currentMonthIncome) * 100).toFixed(1)}% of your income. For investments, typically aim to have 3-6 months of emergency savings first.`,
      type: 'fallback_advice'
    };
  }
  
  if (lowerMessage.includes('debt') || lowerMessage.includes('loan') || lowerMessage.includes('credit card')) {
    return {
      message: "For debt management advice, I'll need more specific information about your debt amounts and interest rates. You can add these as expenses with category 'Debt' for better analysis. Generally, focus on high-interest debt first while maintaining minimum payments on others.",
      type: 'fallback_guidance'
    };
  }

  if (lowerMessage.includes('retirement') || lowerMessage.includes('401k') || lowerMessage.includes('pension')) {
    return {
      message: "For retirement planning, a common guideline is to save 15% of your income for retirement. Based on your current savings rate, you're on track. Consider consulting a financial advisor for personalized retirement strategy.",
      type: 'fallback_advice'
    };
  }

  // Context-aware default fallback
  if (currentMonthIncome === 0) {
    return {
      message: "I notice you haven't recorded any income yet. Start by adding your income sources using: 'Add income $3000 salary' or through the add income action. I can then provide more specific financial advice.",
      type: 'setup_guidance',
      examples: [
        "Add income $5000 monthly salary",
        "Received $1200 freelance payment",
        "Earned $800 from side business"
      ]
    };
  }

  const savingsRate = ((currentMonthSavings / currentMonthIncome) * 100).toFixed(1);
  
  return {
    message: `I can help you manage your finances! This month you've earned $${currentMonthIncome} and spent $${currentMonthExpense}, saving $${currentMonthSavings} (${savingsRate}% savings rate). Try: "Add $50 expense for lunch" or "How can I save more money?" or "Analyze my spending".`,
    type: 'fallback_general',
    examples: [
      "Add income $500 freelance work",
      "Spent $75 on groceries yesterday", 
      "How much have I saved this month?",
      "Where am I spending the most?",
      "Give me savings tips",
      "What's my financial health?"
    ]
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
      percentage: currentMonthExpense > 0 ? ((total / currentMonthExpense) * 100).toFixed(1) : '0.0'
    }))
    .sort((a, b) => b.total - a.total);

  return {
    currentMonthIncome,
    currentMonthExpense,
    currentMonthSavings,
    expenseByCategory,
    totalIncomes: incomes.length,
    totalExpenses: expenses.length,
    incomes: incomes,
    expenses: expenses
  };
}

function generateInitialResponse(summary) {
  const { currentMonthIncome, currentMonthExpense, currentMonthSavings } = summary;
  
  if (currentMonthIncome === 0 && currentMonthExpense === 0) {
    return "Welcome! I'm your AI financial assistant. I can help you manage income and expenses, analyze spending patterns, provide savings advice, and give budget suggestions. Start by adding your first transaction using natural language like 'Add income $3000 salary' or 'Spent $45 on groceries'!";
  }
  
  const savingsRate = currentMonthIncome > 0 ? ((currentMonthSavings / currentMonthIncome) * 100).toFixed(1) : '0';
  
  return `Hello! I'm monitoring your finances. This month you've earned $${currentMonthIncome} and spent $${currentMonthExpense}, saving $${currentMonthSavings} (${savingsRate}% savings rate). How can I help you today? You can ask me to add transactions, analyze spending, or get financial advice.`;
}

function generateQuickSuggestions(summary) {
  const suggestions = [];
  const { currentMonthIncome, currentMonthExpense, currentMonthSavings, expenseByCategory } = summary;
  
  if (currentMonthIncome === 0) {
    suggestions.push("💡 Start by adding your income to get personalized financial insights");
    return suggestions;
  }
  
  if (currentMonthSavings < 0) {
    suggestions.push("⚠️ You're spending more than you earn. Let's review your expenses together.");
  }
  
  if (expenseByCategory.length > 0) {
    const topCategory = expenseByCategory[0];
    if (parseFloat(topCategory.percentage) > 40) {
      suggestions.push(`💰 Your ${topCategory.category} spending is ${topCategory.percentage}% of total expenses. Consider optimizing this category.`);
    }
  }
  
  const savingsRate = (currentMonthSavings / currentMonthIncome) * 100;
  if (savingsRate > 20) {
    suggestions.push("🎉 Great savings rate! Consider investment options for your surplus.");
  } else if (savingsRate < 10 && currentMonthSavings > 0) {
    suggestions.push("📈 Try to increase your savings rate to at least 20% for better financial security.");
  }
  
  if (currentMonthExpense === 0 && currentMonthIncome > 0) {
    suggestions.push("💳 Start tracking your expenses to get a complete picture of your finances.");
  }
  
  return suggestions.length > 0 ? suggestions : ["Your finances look healthy! Keep tracking your expenses regularly for ongoing optimization."];
}

function getAvailableActions() {
  return [
    { action: 'add_income', label: 'Add Income', description: 'Record new income' },
    { action: 'add_expense', label: 'Add Expense', description: 'Record new expense' },
    { action: 'analyze_spending', label: 'Analyze Spending', description: 'Get spending analysis' },
    { action: 'savings_advice', label: 'Savings Advice', description: 'Get savings tips' },
    { action: 'budget_suggestions', label: 'Budget Tips', description: 'Get budgeting advice' },
    { action: 'financial_health', label: 'Financial Health', description: 'Get overall financial health check' }
  ];
}

function generateIncomeSuggestion(summary) {
  if (summary.currentMonthIncome < 1000) {
    return "Consider exploring additional income sources like freelancing or part-time work to boost your earnings.";
  } else if (summary.currentMonthIncome < 3000) {
    return "Good income level! Consider setting aside 20% for savings and building an emergency fund.";
  }
  return "Excellent income! Focus on maximizing savings and exploring investment opportunities.";
}

function generateExpenseSuggestion(summary) {
  if (summary.currentMonthExpense > summary.currentMonthIncome * 0.8) {
    return "Your expenses are high relative to income. Review discretionary spending like dining out and entertainment.";
  } else if (summary.currentMonthExpense > summary.currentMonthIncome * 0.6) {
    return "Your expenses are moderate. Look for optimization opportunities in your top spending categories.";
  }
  return "Your expenses are well-managed. Consider allocating more to savings and investments.";
}

function checkExpenseWarning(summary, expense) {
  if (expense.amount > summary.currentMonthIncome * 0.3) {
    return "This is a significant expense. Ensure it fits your budget and consider its impact on your monthly savings.";
  } else if (expense.amount > summary.currentMonthIncome * 0.15) {
    return "This is a moderate expense. Make sure it aligns with your financial priorities.";
  }
  return null;
}

function generateSpendingRecommendation(spendingRate) {
  if (spendingRate > 80) return "Focus on reducing discretionary expenses first. Create a budget and track every expense.";
  if (spendingRate > 60) return "Look for optimization opportunities in your top categories. Consider meal planning and reviewing subscriptions.";
  if (spendingRate > 40) return "Your spending is well-balanced. Consider increasing retirement contributions.";
  return "Excellent spending control! You have significant room for savings and investments.";
}

function generateSavingsTips(savingsRate) {
  const tips = [];
  
  if (savingsRate < 0) {
    tips.push("Immediately review and reduce discretionary spending");
    tips.push("Create a strict budget focusing on essential expenses only");
    tips.push("Consider temporary additional income sources");
    tips.push("Negotiate bills and cancel unused subscriptions");
  } else if (savingsRate < 10) {
    tips.push("Set up automatic transfers to savings on payday");
    tips.push("Review and reduce subscription services");
    tips.push("Cook at home more often to save on food expenses");
    tips.push("Use the 24-hour rule for non-essential purchases");
  } else if (savingsRate < 20) {
    tips.push("Increase your savings rate by 1% each month");
    tips.push("Consider a high-yield savings account for better returns");
    tips.push("Set specific savings goals for motivation");
    tips.push("Review insurance policies for potential savings");
  } else {
    tips.push("Explore investment options for long-term growth");
    tips.push("Consider maxing out retirement contributions");
    tips.push("Build an emergency fund covering 6 months of expenses");
    tips.push("Diversify your investments across different asset classes");
  }
  
  return tips;
}

function generateHealthRecommendations(healthScore, savingsRate, spendingRate) {
  const recommendations = [];
  
  if (healthScore < 40) {
    recommendations.push("Focus on increasing income through additional sources");
    recommendations.push("Create a strict budget and track all expenses");
    recommendations.push("Build a small emergency fund first, then tackle debt");
  } else if (healthScore < 60) {
    recommendations.push("Aim to increase savings rate to at least 15%");
    recommendations.push("Review and optimize your top spending categories");
    recommendations.push("Set up automatic savings transfers");
  } else if (healthScore < 80) {
    recommendations.push("Consider increasing retirement contributions");
    recommendations.push("Explore investment opportunities for excess savings");
    recommendations.push("Review insurance coverage and estate planning");
  } else {
    recommendations.push("Maximize tax-advantaged accounts");
    recommendations.push("Consider professional financial planning");
    recommendations.push("Explore charitable giving and legacy planning");
  }
  
  return recommendations;
}

async function generateAIRecommendations(incomes, expenses) {
  const summary = generateFinancialSummary(incomes, expenses);
  const recommendations = [];

  // Check if we have basic data
  if (summary.currentMonthIncome === 0) {
    recommendations.push({
      type: 'setup',
      title: 'Add Your Income',
      description: 'Start by adding your income information to get personalized recommendations.',
      priority: 'high',
      action: 'add_income'
    });
    return recommendations;
  }

  // Spending recommendations
  if (summary.expenseByCategory.length > 0) {
    const topCategory = summary.expenseByCategory[0];
    if (parseFloat(topCategory.percentage) > 35) {
      recommendations.push({
        type: 'spending_optimization',
        title: `Optimize ${topCategory.category} Spending`,
        description: `Your ${topCategory.category} expenses account for ${topCategory.percentage}% of total spending. Look for ways to reduce costs in this category.`,
        priority: 'high',
        action: 'analyze_spending'
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
      priority: savingsRate < 0 ? 'high' : 'medium',
      action: 'savings_advice'
    });
  }

  // Budget recommendations
  if (summary.expenseByCategory.length >= 3) {
    recommendations.push({
      type: 'budget_planning',
      title: 'Create Detailed Budget',
      description: 'With multiple spending categories, create a detailed budget to optimize your financial plan.',
      priority: 'medium',
      action: 'budget_suggestions'
    });
  }

  // Income recommendations
  if (summary.currentMonthIncome < 3000 && incomes.length < 3) {
    recommendations.push({
      type: 'income_diversification',
      title: 'Diversify Income Sources',
      description: 'Consider adding additional income streams through freelancing, investments, or side projects.',
      priority: 'low',
      action: 'add_income'
    });
  }

  // Emergency fund recommendation
  if (savingsRate > 15 && summary.currentMonthSavings < 1000) {
    recommendations.push({
      type: 'emergency_fund',
      title: 'Build Emergency Fund',
      description: 'Focus on building an emergency fund covering 3-6 months of essential expenses.',
      priority: 'medium',
      action: 'savings_advice'
    });
  }

  return recommendations;
}

async function handleBudgetSuggestions(financialSummary) {
  const { currentMonthIncome, expenseByCategory } = financialSummary;
  
  if (currentMonthIncome === 0) {
    return {
      message: "I need your income information to provide personalized budget suggestions. Please add your income first.",
      suggestions: []
    };
  }
  
  const budgetSuggestions = expenseByCategory.map(cat => {
    const currentAmount = cat.total;
    const suggestedBudget = currentMonthIncome * getCategoryBudgetPercentage(cat.category);
    const difference = suggestedBudget - currentAmount;
    const isOverBudget = currentAmount > suggestedBudget;
    
    return {
      category: cat.category,
      currentSpending: currentAmount,
      suggestedBudget: Math.round(suggestedBudget),
      difference: Math.round(difference),
      isOverBudget,
      recommendation: isOverBudget ? 
        `Reduce ${cat.category} spending by $${Math.abs(Math.round(difference))}` :
        `Your ${cat.category} spending is within recommended limits`
    };
  });

  // Add overall budget assessment
  const totalSuggested = budgetSuggestions.reduce((sum, item) => sum + item.suggestedBudget, 0);
  const totalActual = budgetSuggestions.reduce((sum, item) => sum + item.currentSpending, 0);
  const overallStatus = totalActual <= totalSuggested ? 'Within Budget' : 'Over Budget';

  return {
    message: `Here are your personalized budget suggestions based on your $${currentMonthIncome} monthly income:`,
    suggestions: budgetSuggestions,
    overall: {
      status: overallStatus,
      totalSuggested,
      totalActual,
      difference: Math.round(totalSuggested - totalActual)
    },
    note: "These are general guidelines. Adjust based on your personal financial goals and circumstances."
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
    'Other': 0.05,
    'Savings': 0.20
  };
  
  return budgetPercentages[category] || 0.05;
}

async function handleQueryRequest(message, financialSummary, incomes, expenses) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('balance') || lowerMessage.includes('how much money') || lowerMessage.includes('remaining')) {
    const balance = financialSummary.currentMonthIncome - financialSummary.currentMonthExpense;
    const status = balance >= 0 ? 'positive' : 'negative';
    
    return {
      message: `Your current monthly balance is $${balance}. You've earned $${financialSummary.currentMonthIncome} and spent $${financialSummary.currentMonthExpense} this month.`,
      data: { 
        balance, 
        income: financialSummary.currentMonthIncome, 
        expenses: financialSummary.currentMonthExpense,
        status 
      }
    };
  }
  
  if (lowerMessage.includes('spent on') || lowerMessage.includes('spending on') || lowerMessage.includes('how much on')) {
    const category = extractCategoryFromQuery(message);
    if (category) {
      const categoryExpenses = expenses.filter(exp => 
        exp.category.toLowerCase() === category.toLowerCase() &&
        moment(exp.date).isSame(moment(), 'month')
      );
      const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const count = categoryExpenses.length;
      
      let message = `You've spent $${total} on ${category} this month`;
      if (count > 0) {
        message += ` across ${count} transaction${count > 1 ? 's' : ''}.`;
      } else {
        message += '.';
      }
      
      return {
        message,
        data: { 
          category, 
          total, 
          transactions: count,
          average: count > 0 ? total / count : 0
        }
      };
    }
  }
  
  if (lowerMessage.includes('saved') || lowerMessage.includes('savings') || lowerMessage.includes('saving')) {
    const savingsRate = financialSummary.currentMonthIncome > 0 ? 
      ((financialSummary.currentMonthSavings / financialSummary.currentMonthIncome) * 100).toFixed(1) : '0';
    
    return {
      message: `You've saved $${financialSummary.currentMonthSavings} this month, which is ${savingsRate}% of your income.`,
      data: { 
        savings: financialSummary.currentMonthSavings, 
        rate: savingsRate,
        recommendation: savingsRate < 20 ? 'Consider increasing your savings rate' : 'Great job on savings!'
      }
    };
  }
  
  if (lowerMessage.includes('most') && lowerMessage.includes('spend') || lowerMessage.includes('highest expense')) {
    if (financialSummary.expenseByCategory.length > 0) {
      const topCategory = financialSummary.expenseByCategory[0];
      return {
        message: `Your highest spending category is ${topCategory.category} at $${topCategory.total} (${topCategory.percentage}% of total expenses).`,
        data: topCategory
      };
    } else {
      return {
        message: "I don't see any spending data yet. Start by adding your expenses to see spending patterns.",
        data: null
      };
    }
  }
  
  return {
    message: "I can tell you about your balance, spending by category, savings, or highest expenses. Try: 'How much have I spent on food?' or 'What's my current balance?' or 'Where do I spend the most?'",
    examples: [
      "How much have I spent on transportation?",
      "What's my current balance?",
      "How much have I saved this month?",
      "What's my highest expense category?",
      "How much money do I have left this month?"
    ]
  };
}

function extractCategoryFromQuery(message) {
  const categories = {
    'food': ['food', 'grocery', 'restaurant', 'dining', 'meal', 'lunch', 'dinner'],
    'transport': ['transport', 'fuel', 'gas', 'uber', 'taxi', 'bus', 'train'],
    'bills': ['bill', 'utility', 'electric', 'water', 'internet', 'phone', 'rent'],
    'shopping': ['shopping', 'buy', 'purchase', 'mall', 'store', 'amazon'],
    'entertainment': ['entertainment', 'movie', 'netflix', 'game', 'hobby'],
    'healthcare': ['health', 'medical', 'doctor', 'hospital', 'medicine'],
    'education': ['education', 'course', 'book', 'tuition', 'school']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }
  return null;
}

async function checkAIServiceHealth() {
  if (!process.env.OPENAI_API_KEY) {
    return { 
      available: false, 
      reason: 'OpenAI API key not configured in environment variables',
      service: 'openai'
    };
  }

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Say 'OK' if working." }],
      max_tokens: 5
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return { 
      available: true, 
      service: 'openai',
      model: response.data.model
    };
  } catch (error) {
    return { 
      available: false, 
      reason: error.response?.data?.error?.message || error.message,
      service: 'openai'
    };
  }
}

module.exports = exports;