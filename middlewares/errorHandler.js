/* eslint-disable no-unused-vars */
const { env } = require('../config/env');

module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  const payload = {
    error: true,
    message: err.message || 'Internal Server Error'
  };

  if (env.nodeEnv !== 'production') {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
};

