const express = require('express');
const { env } = require('./config/env');
const requestLogger = require('./middlewares/requestLogger');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes');

// Create Express app
const app = express();

// Core middlewares
app.use(express.json());
app.use(requestLogger);

// Mount routes
app.use('/api', routes);

// Health root (simple ping)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: env.nodeEnv });
});

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = { app };

