# Use Node.js 18 Alpine as base image (lightweight)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage cache for dependencies
COPY package*.json ./

# Install build dependencies for better-sqlite3 (node-gyp needs python, make, g++)
RUN apk add --no-cache python3 make g++

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .


# Expose the application port (4000 as per server.js default)
EXPOSE 4000

# Start the application
CMD ["npm", "start"]
