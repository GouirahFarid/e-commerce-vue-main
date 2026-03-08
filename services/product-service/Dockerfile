FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
RUN apk add --no-cache wget
COPY . .
EXPOSE 3000
CMD ["node", "src/app.js"]
