# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
RUN apk add --no-cache wget
COPY --from=builder /app/dist ./dist
COPY server.cjs .
EXPOSE 8080
CMD ["node", "server.cjs"]
