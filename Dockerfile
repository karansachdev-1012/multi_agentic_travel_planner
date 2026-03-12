# Multi-stage build: React frontend + Node.js backend
# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY vite.config.js index.html ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production Node.js server
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY .env* ./
COPY --from=frontend-build /app/dist ./dist

# Serve static files from dist in production
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
