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

# Copy .env file for build-time environment variables
COPY .env .

RUN npm run build
