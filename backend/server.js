require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const { v2: cloudinary } = require('cloudinary');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Redis client setup
const redisClient = createClient(
  process.env.REDIS_HOST && process.env.REDIS_PORT
    ? {
        username: process.env.REDIS_USERNAME || 'default',
        password: process.env.REDIS_PASSWORD,
        socket: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT),
        },
      }
    : {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      }
);

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Connect to Redis
let redisConnected = false;
redisClient.connect().then(() => {
  redisConnected = true;
  console.log('Redis connected successfully');
}).catch((err) => {
  console.error('Failed to connect to Redis:', err);
  console.warn('Proceeding without Redis cache');
});

// Cache key constant
const IMAGES_CACHE_KEY = 'cloudinary:images:all';
const CACHE_TTL = 3600; // 1 hour in seconds

// Helper function to fetch images from Cloudinary
async function fetchImagesFromCloudinary() {
  try {
    console.log('Fetching images from Cloudinary...');
    const result = await cloudinary.search
      .expression('resource_type:image')
      .max_results(20)
      .execute();

    const images = result.resources.map((resource) => ({
      public_id: resource.public_id,
      url: cloudinary.url(resource.public_id, {
        crop: 'fill',
        width: 400,
        height: 400,
        quality: 'auto',
      }),
      original_url: resource.secure_url,
      title: resource.public_id.split('/').pop(),
    }));

    return images;
  } catch (error) {
    console.error('Error fetching from Cloudinary:', error);
    throw new Error('Failed to fetch images from Cloudinary');
  }
}

// API endpoint to get all 20 images with caching
app.get('/api/images', async (req, res) => {
  try {
    let images = null;

    // Try to get from Redis cache if connected
    if (redisConnected) {
      const cachedImages = await redisClient.get(IMAGES_CACHE_KEY);
      if (cachedImages) {
        console.log('Serving images from Redis cache');
        return res.json({
          success: true,
          cached: true,
          data: JSON.parse(cachedImages),
        });
      }
    }

    // Fetch from Cloudinary if not in cache
    images = await fetchImagesFromCloudinary();

    // Cache the images in Redis if connected
    if (redisConnected) {
      await redisClient.setEx(
        IMAGES_CACHE_KEY,
        CACHE_TTL,
        JSON.stringify(images)
      );
      console.log('Images cached in Redis');
    }

    res.json({
      success: true,
      cached: false,
      data: images,
    });
  } catch (error) {
    console.error('Error in /api/images:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    redis: redisConnected ? 'connected' : 'disconnected',
  });
});

// Clear cache endpoint (useful for testing)
app.post('/api/clear-cache', async (req, res) => {
  try {
    if (redisConnected) {
      await redisClient.del(IMAGES_CACHE_KEY);
      res.json({ success: true, message: 'Cache cleared' });
    } else {
      res.status(400).json({ success: false, message: 'Redis not connected' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Redis URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  if (redisConnected) {
    await redisClient.quit();
  }
  process.exit(0);
});
