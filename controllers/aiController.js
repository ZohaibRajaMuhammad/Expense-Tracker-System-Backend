const axios = require('axios');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const moment = require('moment');

// @desc    Get AI-powered financial insights
// @route   POST /api/ai/insights
// @access  Private
exports.getFinancialInsights = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = 'month' } = req.body;

    // Get current and previous period data
    const { currentData, previousData } = await getPeriodData(userId, period);
    
    // Prepare data for AI analysis
    const analysisData = prepareAnalysisData(currentData, previousData, period);
    
    // Get AI insights
    const aiInsights = await generateAIInsights(analysisData);
    
    res.json({
      success: true,
      insights: aiInsights,
      summary: analysisData.summary,
      period: period
    });
  } catch (error) {
    console.error('AI Insights error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate AI insights',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get quick AI summary
// @route   GET /api/ai/summary
// @access  Private
exports.getQuickSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get current month data
    const currentMonthStart = moment().startOf('month');
    const currentMonthEnd = moment().endOf('month');
    const lastMonthStart = moment().subtract(1, 'month').startOf('month');
    const lastMonthEnd = moment().subtract(1, 'month').endOf('month');

    const [currentIncomes, currentExpenses, previousIncomes, previousExpenses] = await Promise.all([
      Income.find({ 
        user: userId, 
        date: { $gte: currentMonthStart, $lte: currentMonthEnd } 
      }),
      Expense.find({ 
        user: userId, 
        date: { $gte: currentMonthStart, $lte: currentMonthEnd } 
      }),
      Income.find({ 
        user: userId, 
        date: { $gte: lastMonthStart, $lte: lastMonthEnd } 
      }),
      Expense.find({ 
        user: userId, 
        date: { $gte: lastMonthStart, $lte: lastMonthEnd } 
      })
    ]);

    const currentIncome = currentIncomes.reduce((sum, inc) => sum + inc.amount, 0);
    const currentExpense = currentExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const previousIncome = previousIncomes.reduce((sum, inc) => sum + inc.amount, 0);
    const previousExpense = previousExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate category spending
    const expenseByCategory = {};
    currentExpenses.forEach(expense => {
      expenseByCategory[expense.category] = (expenseByCategory[expense.category] || 0) + expense.amount;
    });

    const topCategories = Object.entries(expenseByCategory)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, amount]) => ({ category, amount }));

    const summaryData = {
      current: {
        income: currentIncome,
        expense: currentExpense,
        savings: currentIncome - currentExpense
      },
      previous: {
        income: previousIncome,
        expense: previousExpense,
        savings: previousIncome - previousExpense
      },
      topCategories,
      incomeChange: previousIncome ? ((currentIncome - previousIncome) / previousIncome * 100).toFixed(1) : 0,
      expenseChange: previousExpense ? ((currentExpense - previousExpense) / previousExpense * 100).toFixed(1) : 0
    };

    const aiSummary = await generateAISummary(summaryData);
    
    res.json({
      success: true,
      summary: aiSummary,
      data: summaryData
    });
  } catch (error) {
    console.error('Quick summary error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate AI summary'
    });
  }
};

// Helper Functions
async function getPeriodData(userId, period) {
  let currentStart, currentEnd, previousStart, previousEnd;

  switch (period) {
    case 'week':
      currentStart = moment().startOf('week');
      currentEnd = moment().endOf('week');
      previousStart = moment().subtract(1, 'week').startOf('week');
      previousEnd = moment().subtract(1, 'week').endOf('week');
      break;
    case 'month':
    default:
      currentStart = moment().startOf('month');
      currentEnd = moment().endOf('month');
      previousStart = moment().subtract(1, 'month').startOf('month');
      previousEnd = moment().subtract(1, 'month').endOf('month');
      break;
  }

  const [currentIncomes, currentExpenses, previousIncomes, previousExpenses] = await Promise.all([
    Income.find({ user: userId, date: { $gte: currentStart, $lte: currentEnd } }),
    Expense.find({ user: userId, date: { $gte: currentStart, $lte: currentEnd } }),
    Income.find({ user: userId, date: { $gte: previousStart, $lte: previousEnd } }),
    Expense.find({ user: userId, date: { $gte: previousStart, $lte: previousEnd } })
  ]);

  return {
    currentData: { incomes: currentIncomes, expenses: currentExpenses },
    previousData: { incomes: previousIncomes, expenses: previousExpenses }
  };
}

function prepareAnalysisData(currentData, previousData, period) {
  const currentIncome = currentData.incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const currentExpense = currentData.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const previousIncome = previousData.incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const previousExpense = previousData.expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Calculate category breakdown
  const categoryBreakdown = {};
  currentData.expenses.forEach(expense => {
    categoryBreakdown[expense.category] = (categoryBreakdown[expense.category] || 0) + expense.amount;
  });

  const topCategories = Object.entries(categoryBreakdown)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: ((amount / currentExpense) * 100).toFixed(1)
    }));

  return {
    summary: {
      period,
      currentIncome,
      currentExpense,
      currentSavings: currentIncome - currentExpense,
      previousIncome,
      previousExpense,
      previousSavings: previousIncome - previousExpense,
      incomeChange: previousIncome ? ((currentIncome - previousIncome) / previousIncome * 100).toFixed(1) : 0,
      expenseChange: previousExpense ? ((currentExpense - previousExpense) / previousExpense * 100).toFixed(1) : 0
    },
    categories: topCategories,
    transactionCount: {
      incomes: currentData.incomes.length,
      expenses: currentData.expenses.length
    }
  };
}

async function generateAIInsights(analysisData) {
  // Use OpenAI API for AI insights
  const prompt = `
You are a financial advisor analyzing personal expense data. Provide concise, actionable insights in natural language.

Financial Data:
- Period: ${analysisData.summary.period}
- Current Income: $${analysisData.summary.currentIncome}
- Current Expenses: $${analysisData.summary.currentExpense}
- Current Savings: $${analysisData.summary.currentSavings}
- Income Change: ${analysisData.summary.incomeChange}% vs previous period
- Expense Change: ${analysisData.summary.expenseChange}% vs previous period
- Top Spending Categories: ${analysisData.categories.map(cat => `${cat.category} (${cat.percentage}%)`).join(', ')}

Please provide:
1. A brief summary of spending patterns
2. Key observations about income vs expenses
3. 2-3 specific, actionable recommendations to improve savings
4. Positive trends to continue (if any)

Keep it friendly, professional, and under 200 words. Focus on practical advice.
`;

  try {
    // For OpenAI
    if (process.env.OPENAI_API_KEY) {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful financial advisor providing personalized spending insights and recommendations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content;
    }
    // For Gemini (Google AI)
    else if (process.env.GEMINI_API_KEY) {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        }
      );

      return response.data.candidates[0].content.parts[0].text;
    }
    // Fallback to simple rule-based insights
    else {
      return generateFallbackInsights(analysisData);
    }
  } catch (error) {
    console.error('AI API error:', error);
    return generateFallbackInsights(analysisData);
  }
}

async function generateAISummary(summaryData) {
  const prompt = `
Create a very brief financial summary (1-2 sentences) based on:

This month:
- Income: $${summaryData.current.income}
- Expenses: $${summaryData.current.expense}
- Savings: $${summaryData.current.savings}

Changes from last month:
- Income: ${summaryData.incomeChange >= 0 ? '+' : ''}${summaryData.incomeChange}%
- Expenses: ${summaryData.expenseChange >= 0 ? '+' : ''}${summaryData.expenseChange}%

Top categories: ${summaryData.topCategories.map(cat => cat.category).join(', ')}

Make it conversational and under 100 words.
`;

  try {
    if (process.env.OPENAI_API_KEY) {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content;
    } else {
      return generateFallbackSummary(summaryData);
    }
  } catch (error) {
    return generateFallbackSummary(summaryData);
  }
}

function generateFallbackInsights(analysisData) {
  const { summary, categories } = analysisData;
  
  const insights = [];
  
  // Spending trend
  if (summary.expenseChange > 10) {
    insights.push(`Your spending increased by ${summary.expenseChange}% this period. Consider reviewing your expenses.`);
  } else if (summary.expenseChange < -5) {
    insights.push(`Great job! You reduced spending by ${Math.abs(summary.expenseChange)}% compared to last period.`);
  }

  // Savings analysis
  const savingsRate = (summary.currentSavings / summary.currentIncome) * 100;
  if (savingsRate < 10) {
    insights.push(`Your savings rate is ${savingsRate.toFixed(1)}%. Aim for 20% by reducing discretionary spending.`);
  } else {
    insights.push(`Good savings rate of ${savingsRate.toFixed(1)}%! Keep maintaining this healthy habit.`);
  }

  // Category insights
  const topCategory = categories[0];
  if (topCategory && topCategory.percentage > 30) {
    insights.push(`Your ${topCategory.category} spending (${topCategory.percentage}%) is quite high. Look for ways to optimize this category.`);
  }

  // Positive reinforcement
  if (summary.currentSavings > 0) {
    insights.push(`You're saving $${summary.currentSavings} this period - that's excellent financial discipline!`);
  }

  return insights.join(' ');
}

function generateFallbackSummary(summaryData) {
  const trend = summaryData.expenseChange > 0 ? 'increased' : 'decreased';
  const topCategory = summaryData.topCategories[0]?.category || 'expenses';
  
  return `This month, you ${trend} spending by ${Math.abs(summaryData.expenseChange)}%. Your main spending was on ${topCategory}. ${summaryData.current.savings > 0 ? `Great job saving $${summaryData.current.savings}!` : 'Focus on increasing your savings next month.'}`;
}