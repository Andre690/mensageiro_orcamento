const morgan = require('morgan');
const { env } = require('../config/env');

// Use 'dev' concise logs in development and 'combined' in production
const format = env.nodeEnv === 'production' ? 'combined' : 'dev';

module.exports = morgan(format);

