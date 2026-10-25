# Multi-stage build: one Dockerfile gives us a "test" image and a slim "production" image.

# ---------- Base: install dependencies ----------
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# ---------- Test: source + tests (used by the Jenkins "Test" stage) ----------
FROM base AS test
COPY src ./src
COPY test ./test
CMD ["npm", "test"]

# ---------- Production: only what the app needs to run ----------
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src

# Version is injected by Jenkins at build time (build number + git commit)
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION} \
    PORT=3000 \
    NODE_ENV=production

EXPOSE 3000
USER node

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
