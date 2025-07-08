const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Logging
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Cache implementation
const cache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// API Error Handling Class
class APIError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware to handle errors
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  console.error(err.stack);

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message
  });
};

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = uuidv4();
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// API endpoint to search universities
app.get('/api/universities', async (req, res, next) => {
  try {
    const { country, name } = req.query;
    
    if (!country) {
      throw new APIError('Country parameter is required', 400);
    }

    // Validate country input
    if (typeof country !== 'string' || country.length > 100) {
      throw new APIError('Invalid country parameter', 400);
    }

    // Check cache first
    const cacheKey = `${country.toLowerCase()}-${name ? name.toLowerCase() : ''}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      return res.status(200).json({
        status: 'success',
        data: cachedData.data,
        fromCache: true,
        requestId: req.requestId
      });
    }

    // Build API URL
    let apiUrl = `http://universities.hipolabs.com/search?country=${encodeURIComponent(country)}`;
    if (name) {
      apiUrl += `&name=${encodeURIComponent(name)}`;
    }

    // Make request to external API
    const response = await axios.get(apiUrl, {
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'UniversitySearchApp/1.0'
      }
    });

    // Validate response
    if (!Array.isArray(response.data)) {
      throw new APIError('Invalid data received from API', 502);
    }

    // Process data
    const universities = response.data.map(university => ({
      name: university.name,
      country: university.country,
      alphaTwoCode: university.alpha_two_code,
      domains: university.domains,
      webPages: university.web_pages,
      stateProvince: university['state-province'] || null
    }));

    // Cache the data
    cache.set(cacheKey, {
      data: universities,
      timestamp: Date.now()
    });

    res.status(200).json({
      status: 'success',
      data: universities,
      fromCache: false,
      requestId: req.requestId
    });

  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      next(new APIError(`External API error: ${error.response.statusText}`, error.response.status));
    } else if (error.request) {
      // The request was made but no response was received
      next(new APIError('No response received from external API', 504));
    } else {
      // Something happened in setting up the request that triggered an Error
      next(new APIError(error.message, 500));
    }
  }
});

// API endpoint to get country list
app.get('/api/countries', async (req, res, next) => {
  try {
    const cacheKey = 'countries-list';
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      return res.status(200).json({
        status: 'success',
        data: cachedData.data,
        fromCache: true,
        requestId: req.requestId
      });
    }

    const response = await axios.get('http://universities.hipolabs.com/search', {
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'UniversitySearchApp/1.0'
      }
    });

    if (!Array.isArray(response.data)) {
      throw new APIError('Invalid data received from API', 502);
    }

    // Extract unique countries
    const countries = [...new Set(response.data.map(u => u.country))].sort();
    
    // Cache the data
    cache.set(cacheKey, {
      data: countries,
      timestamp: Date.now()
    });

    res.status(200).json({
      status: 'success',
      data: countries,
      fromCache: false,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

// Export for testing
module.exports = app;
