const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const uploadToCloudinary = async (fileBuffer, options = {}) => {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`☁️ Cloudinary upload attempt ${attempt}/${maxRetries}...`);
      
      const base64Image = fileBuffer.toString('base64');
      const dataURI = `data:image/jpeg;base64,${base64Image}`;

      const uploadOptions = {
        folder: 'expense-tracker/profiles',
        public_id: `profile-${Date.now()}`,
        resource_type: 'image',
        timeout: 30000, // 30 second timeout
        ...options
      };

      const result = await cloudinary.uploader.upload(dataURI, uploadOptions);
      console.log('✅ Cloudinary upload successful!');
      return result;

    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  throw lastError;
};

// Keep the rest of your functions...
const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl) return;
    
    const parts = imageUrl.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return;
    
    const pathParts = parts.slice(uploadIndex + 1);
    const publicId = pathParts.join('/').replace(/\.[^/.]+$/, "");
    
    console.log('🗑️ Deleting from Cloudinary:', publicId);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('✅ Deletion result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error deleting image from Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary
};