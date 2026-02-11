import express from 'express';
import { createServer as createHttpServer } from 'http';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Status endpoint - Returns server status and information
 * @route GET /api/status
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Object} JSON response with status, timestamp, and message
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    message: 'Nano Agent Server is running',
  });
});

/**
 * Health check endpoint - Simple liveness check
 * @route GET /health
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Object} JSON response with alive status and timestamp
 */
app.get('/health', (req, res) => {
  res.json({
    alive: true,
    timestamp: Date.now(),
  });
});

const httpServer = createHttpServer(app);
export { httpServer, app };
