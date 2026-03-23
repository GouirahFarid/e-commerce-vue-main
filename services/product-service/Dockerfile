# Build stage
FROM node:20-alpine AS builder
# Fix CRITICAL vulnerabilities in Alpine packages
RUN apk upgrade --no-cache libexpat zlib
WORKDIR /app

COPY package.json ./

RUN npm install --only=production && \
    npm cache clean --force

COPY src ./src

# Production stage
FROM node:20-alpine
# Fix CRITICAL vulnerabilities in Alpine packages
RUN apk upgrade --no-cache libexpat zlib && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/src ./src

USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["node", "src/app.js"]