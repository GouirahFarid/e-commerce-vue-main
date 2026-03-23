# Build stage
FROM node:20-alpine AS builder
# Fix CRITICAL vulnerabilities in Alpine packages
RUN apk upgrade --no-cache libexpat zlib
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
# Fix CRITICAL vulnerabilities in Alpine packages
RUN apk upgrade --no-cache libexpat zlib && \
    apk add --no-cache curl
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
WORKDIR /app
COPY package.json ./
RUN npm install --only=production
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs server.cjs .
USER nodejs
EXPOSE 8080
CMD ["node", "server.cjs"]