const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Income title is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: 0
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Food', 'Transport', 'Entertainment', 'Healthcare', 'Shopping', 'Bills', 'Education', 'Other']
  }, 
  description: {
    type: String,
    trim: true
  },
  // New field for icon/emoji
  icon: {
    type: String,
    trim: true,
    default: '' // Default empty string, can store emojis like "💰", "💼", "📈"
  },
  date: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Income', incomeSchema);