# syntax=docker/dockerfile:1.4
# ========================
# ARG defaults
# ========================
ARG NODE_VERSION=20-alpine

# =========================================
# Stage 1: Development
# =========================================
FROM node:${NODE_VERSION} AS development

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# =========================================
# Stage 2: Build (for GitHub Pages deployment)
# =========================================
FROM node:${NODE_VERSION} AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# .env files are excluded by .dockerignore: the app needs no secrets, and build-time
# flags (VITE_APP_DEBUG) can be passed with --build-arg / ENV if ever needed.

RUN npm run build
