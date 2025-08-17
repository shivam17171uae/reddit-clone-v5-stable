# ---- Stage 1: Build Frontend ----
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Backend Dependencies ----
FROM node:18-alpine AS backend-deps
WORKDIR /app
COPY backend/package.json ./
RUN npm install --omit=dev

# ---- Stage 3: Final Production Image ----
FROM node:18-alpine
WORKDIR /app
COPY --from=backend-deps /app/node_modules ./node_modules
# Copy the NEW refactored backend source code
COPY backend/src/ ./src
COPY --from=frontend-builder /app/frontend/dist ./src/public
RUN mkdir -p /app/src/uploads

EXPOSE 3001
CMD ["node", "src/server.js"]
