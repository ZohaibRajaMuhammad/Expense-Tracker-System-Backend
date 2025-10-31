require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const connectDB = require('./config/database');

// Connect to database
connectDB();

const app = express();

// Enhanced CORS configuration
// Updated CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:5173', // Local development
      'https://effulgent-belekoy-71e975.netlify.app', // Netlify deployment
      'https://main--effulgent-belekoy-71e975.netlify.app' // Netlify preview deployments
    ];
    
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      // Origin is in the allowed list
      callback(null, true);
    } else {
      // Origin is not allowed
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
}));

// Body parsing middleware - CRITICAL: Must come before fileUpload
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

app.use(fileUpload({
  limits: { 
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  abortOnLimit: true,
  createParentPath: true,
  debug: process.env.NODE_ENV === 'development',
  useTempFiles: false, // Important: don't use temp files, work with buffers
  tempFileDir: '/tmp/'
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(` ${new Date().toISOString()} ${req.method} ${req.path}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log(' Body keys:', Object.keys(req.body));
    console.log(' Files:', req.files ? Object.keys(req.files) : 'None');
  }
  next();
});

// Routes - FIXED: Changed from './routes/income' to './routes/incomes'
app.use('/api/auth', require('./routes/auth'));
app.use('/api/incomes', require('./routes/income')); // ← FIXED THIS LINE
app.use('/api/expenses', require('./routes/expense'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ai', require('./routes/aiManagement'));



// Enhanced health check route
app.get('/api/health', (req, res) => {
  const healthCheck = {
    success: true,
    message: 'Expense Tracker API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected', // Assuming DB connection is established
    upload: {
      enabled: true,
      maxFileSize: '5MB',
      supportedTypes: 'images'
    },
    services: {
      cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
      jwt: !!process.env.JWT_SECRET
    },
    // Add routes information
    routes: {
      incomes: '/api/incomes',
      expenses: '/api/expenses',
      auth: '/api/auth',
      dashboard: '/api/dashboard'
    }
  };
  
  res.status(200).json(healthCheck);
});

// Enhanced test upload endpoint
app.post('/api/test-upload', (req, res) => {
  try {
    console.log(' Test upload request received');
    console.log(' Body keys:', Object.keys(req.body));
    
    if (req.files) {
      console.log(' Files received:', Object.keys(req.files));
      
      Object.keys(req.files).forEach(fileKey => {
        const file = req.files[fileKey];
        console.log(`    ${fileKey}:`, {
          name: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          mimetype: file.mimetype,
          dataLength: file.data ? `${file.data.length} bytes` : 'no data',
          truncated: file.truncated || false
        });
      });
    } else {
      console.log(' No files received in request');
    }

    if (req.files && req.files.profileImage) {
      const file = req.files.profileImage;
      return res.json({
        success: true,
        message: ' File received successfully!',
        fileInfo: {
          name: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          mimetype: file.mimetype,
          dataLength: `${file.data ? file.data.length : 0} bytes`,
          truncated: file.truncated || false,
          encoding: file.encoding
        },
        requestInfo: {
          contentType: req.headers['content-type'],
          contentLength: req.headers['content-length']
        }
      });
    }
    
    res.json({
      success: true,
      message: ' Endpoint is working, but no file received',
      instructions: 'Send a file with field name "profileImage" in form-data',
      bodyReceived: Object.keys(req.body)
    });
  } catch (error) {
    console.error(' Test upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Test upload failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Cloudinary test endpoint
app.get('/api/test-cloudinary', async (req, res) => {
  try {
    const { cloudinary } = require('./config/realCloudinary');
    
    // Test Cloudinary configuration
    const configTest = {
      cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
      api_key: !!process.env.CLOUDINARY_API_KEY,
      api_secret: !!process.env.CLOUDINARY_API_SECRET
    };
    
    if (!configTest.cloud_name || !configTest.api_key || !configTest.api_secret) {
      return res.status(400).json({
        success: false,
        message: 'Cloudinary configuration incomplete',
        missing: {
          cloud_name: !configTest.cloud_name,
          api_key: !configTest.api_key,
          api_secret: !configTest.api_secret
        }
      });
    }

    // Try to ping Cloudinary
    const result = await cloudinary.api.ping();
    
    res.json({
      success: true,
      message: ' Cloudinary is properly configured and accessible!',
      config: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
        api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
        api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
      },
      pingResult: result
    });
  } catch (error) {
    console.error(' Cloudinary test failed:', error);
    res.status(500).json({
      success: false,
      message: ' Cloudinary configuration test failed',
      error: error.message,
      suggestion: 'Check your .env file and internet connection'
    });
  }
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error(' Server Error:', err.stack);
  
  // File upload errors
  if (err.message && err.message.includes('File too large')) {
    return res.status(400).json({ 
      success: false,
      message: 'File too large. Maximum size is 5MB.',
      maxSize: '5MB'
    });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size exceeds the 5MB limit.',
      maxSize: '5MB'
    });
  }
  
  if (err.message && err.message.includes('Unexpected field')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file field name. Use "profileImage" for profile pictures.',
      expectedField: 'profileImage'
    });
  }
  
  // Multer-like errors (for compatibility)
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Too many files or unexpected file field.',
      maxFiles: 1,
      expectedField: 'profileImage'
    });
  }

  // Route not found errors (for income routes)
  if (err.message && err.message.includes('Cannot find module')) {
    if (err.message.includes('./routes/income')) {
      return res.status(500).json({
        success: false,
        message: 'Income routes not configured properly',
        error: 'Check if routes/incomes.js file exists',
        solution: 'Create routes/incomes.js with income route handlers'
      });
    }
  }

  // Database errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(500).json({
      success: false,
      message: 'Database error occurred',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Default error
  res.status(500).json({ 
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    requestId: req.id || Date.now()
  });
});

// 404 handler - must be last
app.use('*', (req, res) => {
  console.log(` 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /api/incomes',
      'POST /api/incomes',
      'PUT /api/incomes/:id',
      'DELETE /api/incomes/:id',
      'GET /api/expenses',
      'POST /api/expenses',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/health',
      'POST /api/test-upload',
      'GET /api/test-cloudinary'
    ]
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n Expense Tracker API Server Started');
  console.log(` Port: ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Database: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
  console.log(` Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Not configured'}`);
  console.log(` JWT: ${process.env.JWT_SECRET ? 'Configured' : 'Not configured'}`);
  console.log('\n Available Routes:');
  console.log(`    Incomes: http://localhost:${PORT}/api/incomes`);
  console.log(`    Expenses: http://localhost:${PORT}/api/expenses`);
  console.log(`    Auth: http://localhost:${PORT}/api/auth`);
  console.log(`    Health: http://localhost:${PORT}/api/health`);
  console.log('\n Server is ready to accept requests...\n');
});