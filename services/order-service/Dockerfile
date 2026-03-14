FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
RUN apk add --no-cache wget
COPY . .
EXPOSE 3002
CMD ["node", "src/app.js"]
