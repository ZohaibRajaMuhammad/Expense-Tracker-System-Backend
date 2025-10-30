const express = require('express');
const { register, login, updateProfile, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const router = express.Router();

// No file upload middleware needed - handled by express-fileupload in app.js
router.post('/register', register);
router.post('/login', login);
router.put('/profile', protect, updateProfile);
router.get('/profile', protect, getProfile);

module.exports = router;