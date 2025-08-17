FROM node:18-alpine AS builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
RUN mkdir -p /app/uploads
COPY backend/server.js ./
COPY --from=builder /app/frontend/dist ./public
EXPOSE 3001
CMD ["node", "server.js"]
