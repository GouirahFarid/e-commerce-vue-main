# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Production stage
FROM node:20-alpine
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=builder --chown=nodejs:nodejs /app ./
USER nodejs
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["node", "src/app.js"]
