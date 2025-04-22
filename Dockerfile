# Use Node.js LTS (Long Term Support) as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY services/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY services/ ./

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=development

# Run the application
CMD ["npm", "run", "dev"]
