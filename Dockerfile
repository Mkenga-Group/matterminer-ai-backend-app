# Use an officially supported, slim Alpine Linux base image for a small footprint
FROM node:20-alpine

# Set Node environment to production
ENV NODE_ENV=production

# Create a non-root user and group for enhanced security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to maximize layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the rest of the application source code
COPY . .

# Change ownership of the app directory to the non-root user
RUN chown -R appuser:appgroup /usr/src/app

# Switch context to the non-root user
USER appuser

# Expose the API port to the host network
EXPOSE 3000

# Start the Node application explicitly
CMD ["node", "src/server.js"]
