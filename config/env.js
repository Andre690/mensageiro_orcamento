const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  // WhatsApp provider config (if applicable in your project)
  apiUrl: process.env.API_URL || '',
  apiInstance: process.env.API_INSTANCE || '',
  apiKey: process.env.API_KEY || ''
};

module.exports = { env };

