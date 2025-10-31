const express = require('express');
const { register, login, updateProfile, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.put('/profile', protect, updateProfile);
router.get('/profile', protect, getProfile);
// Handle undefined routes
router.all('*', (req, res) => {
  res.status(404).json({
    message: `Route ${req.originalUrl} not found`
  });
}); 

module.exports = router;