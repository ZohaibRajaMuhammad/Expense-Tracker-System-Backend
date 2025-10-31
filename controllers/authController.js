const User = require('../models/User');
const Income = require('../models/Income'); 
const jwt = require('jsonwebtoken');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/realCloudinary');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

exports.register = async (req, res) => {
  try {
    console.log('\n DEBUG - Registration started');
    console.log(' Request body keys:', Object.keys(req.body));
    console.log(' Request files:', req.files ? Object.keys(req.files) : 'No files');
    
    console.log('🔍 Request details:', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      hasBody: !!req.body,
      hasFiles: !!req.files
    });

    if (req.files && req.files.profileImage) {
      const file = req.files.profileImage;
      console.log('📸 File details:', {
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        mimetype: file.mimetype,
        dataLength: file.data ? `${file.data.length} bytes` : 'No data',
        truncated: file.truncated || false
      });
    }

    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if (!firstName?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'First name is required'
      });
    }

    if (!lastName?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Last name is required'
      });
    }

    if (!email?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    if (!confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please confirm your password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Passwords do not match' 
      });
    }

    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists with this email address' 
      });
    }

    let profileImageUrl = null;
    let cloudinaryStatus = 'not_attempted';

    const cloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                                process.env.CLOUDINARY_API_KEY && 
                                process.env.CLOUDINARY_API_SECRET;

    console.log(' Cloudinary configuration check:', {
      configured: cloudinaryConfigured,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
      api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
    });

    if (req.files && req.files.profileImage && cloudinaryConfigured) {
      const file = req.files.profileImage;
      
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ 
          success: false,
          message: 'Only image files are allowed (JPEG, PNG, GIF, etc.)' 
        });
      }
      
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ 
          success: false,
          message: 'File size must be less than 5MB' 
        });
      }

      if (!file.data || file.data.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'File data is empty or corrupted' 
        });
      }

      console.log('Attempting Cloudinary upload...');
      
      try {
        const { cloudinary } = require('../config/realCloudinary');
        await cloudinary.api.ping();
        console.log(' Cloudinary connectivity test passed');

        const uploadResult = await uploadToCloudinary(file.data);
        profileImageUrl = uploadResult.secure_url;
        cloudinaryStatus = 'success';
        console.log(' Cloudinary upload successful! URL:', profileImageUrl);
        
      } catch (uploadError) {
        cloudinaryStatus = 'failed';
        console.error(' Cloudinary upload failed:', {
          message: uploadError.message,
          code: uploadError.http_code,
          name: uploadError.name
        });
        
        console.log(' Continuing registration without profile image');
        
        if (uploadError.message.includes('ENOTFOUND') || uploadError.message.includes('getaddrinfo')) {
          console.log(' Network issue: Cannot reach Cloudinary servers');
        } else if (uploadError.http_code === 401) {
          console.log(' Cloudinary authentication failed - check API credentials');
        }
      }
    } else if (req.files && req.files.profileImage && !cloudinaryConfigured) {
      console.log(' Skipping image upload - Cloudinary not configured');
      cloudinaryStatus = 'skipped_no_config';
    } else {
      console.log('No profile image provided or no files in request');
      cloudinaryStatus = 'no_file';
    }

    console.log('👤 Creating user in database...');
    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password,
      profileImage: profileImageUrl
    });

    console.log(' User created successfully:', user.email);

    try {
      const sampleIncome = new Income({
        user: user._id,
        title: 'Welcome Income',
        amount: 0,
        category: 'Other',
        description: 'Get started by adding your first income!',
        icon: '💰',
        date: new Date()
      });
      await sampleIncome.save();
      console.log('✅ Sample income created for new user');
    } catch (incomeError) {
      console.log('⚠️ Could not create sample income:', incomeError.message);
    }

    let successMessage = 'User registered successfully';
    if (cloudinaryStatus === 'success') {
      successMessage = 'User registered successfully with profile image';
    } else if (cloudinaryStatus === 'failed') {
      successMessage = 'User registered successfully (image upload skipped due to technical issues)';
    } else if (cloudinaryStatus === 'skipped_no_config') {
      successMessage = 'User registered successfully (image upload skipped - Cloudinary not configured)';
    }

    res.status(201).json({
      success: true,
      message: successMessage,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage,
        token: generateToken(user._id),
      },
      uploadStatus: {
        attempted: cloudinaryStatus !== 'not_attempted' && cloudinaryStatus !== 'no_file',
        success: cloudinaryStatus === 'success',
        status: cloudinaryStatus,
        message: cloudinaryStatus === 'failed' ? 'Image upload failed but registration completed' : undefined
      }
    });

  } catch (error) {
    console.error(' Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email address'
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Registration failed due to server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      suggestion: 'Please try again or contact support if the problem persists'
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user && (await user.matchPassword(password))) {
      const incomeCount = await Income.countDocuments({ user: user._id });
      
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profileImage: user.profileImage,
          token: generateToken(user._id),
          stats: {
            incomeCount
          }
        }
      });
    } else {
      res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }
  } catch (error) {
    console.error(' Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    console.log('🔄 Profile update request received');
    console.log('📦 Body:', req.body);
    console.log('📁 Files:', req.files ? Object.keys(req.files) : 'No files');

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (req.body.firstName) user.firstName = req.body.firstName.trim();
    if (req.body.lastName) user.lastName = req.body.lastName.trim();
    
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ 
        email: req.body.email.toLowerCase().trim(),
        _id: { $ne: user._id }
      });
      
      if (emailExists) {
        return res.status(400).json({ 
          success: false,
          message: 'Email already exists' 
        });
      }
      user.email = req.body.email.toLowerCase().trim();
    }

    let imageUpdated = false;

    if (req.files && req.files.profileImage) {
      const file = req.files.profileImage;
      
      console.log(' Processing profile image update:', {
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        mimetype: file.mimetype
      });

      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ 
          success: false,
          message: 'Only image files are allowed' 
        });
      }
      
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ 
          success: false,
          message: 'File size must be less than 5MB' 
        });
      }

      if (user.profileImage && user.profileImage.includes('cloudinary')) {
        try {
          await deleteFromCloudinary(user.profileImage);
          console.log('Old profile image deleted from Cloudinary');
        } catch (deleteError) {
          console.error(' Error deleting old image:', deleteError);
        }
      }

      try {
        const uploadResult = await uploadToCloudinary(file.data);
        user.profileImage = uploadResult.secure_url;
        imageUpdated = true;
        console.log('New profile image uploaded:', user.profileImage);
      } catch (uploadError) {
        console.error(' Cloudinary upload error:', uploadError);
        return res.status(400).json({ 
          success: false,
          message: 'Error uploading image to cloud storage' 
        });
      }
    }

    const updatedUser = await user.save();

    res.json({
      success: true,
      message: imageUpdated ? 'Profile updated successfully with new image' : 'Profile updated successfully',
      data: {
        _id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        profileImage: updatedUser.profileImage,
        token: generateToken(updatedUser._id),
      }
    });

  } catch (error) {
    console.error(' Profile update error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    console.log(' Fetching user profile for:', req.user._id);
    
    const user = await User.findById(req.user._id).select('-password');
    
    if (user) {
      const incomeStats = await Income.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: null,
            totalIncome: { $sum: '$amount' },
            incomeCount: { $sum: 1 },
            averageIncome: { $avg: '$amount' }
          }
        }
      ]);

      const stats = incomeStats.length > 0 ? incomeStats[0] : {
        totalIncome: 0,
        incomeCount: 0,
        averageIncome: 0
      };

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profileImage: user.profileImage,
          createdAt: user.createdAt,
          stats: {
            totalIncome: stats.totalIncome || 0,
            incomeCount: stats.incomeCount || 0,
            averageIncome: stats.averageIncome || 0
          }
        }
      });
    } else {
      res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
  } catch (error) {
    console.error(' Get profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    console.log(' Deleting user account:', req.user._id);
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (user.profileImage && user.profileImage.includes('cloudinary')) {
      try {
        await deleteFromCloudinary(user.profileImage);
        console.log(' Profile image deleted from Cloudinary');
      } catch (deleteError) {
        console.error(' Error deleting profile image:', deleteError);
      }
    }

    try {
      await Income.deleteMany({ user: user._id });
      console.log(' All user incomes deleted');
    } catch (incomeError) {
      console.error(' Error deleting user incomes:', incomeError);
    }

    await User.findByIdAndDelete(req.user._id);

    res.json({
      success: true,
      message: 'Account and all associated data deleted successfully'
    });

  } catch (error) {
    console.error(' Delete account error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};