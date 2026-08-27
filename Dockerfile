# Build React admin + mock portals
FROM node:20-alpine AS dashboard-build
WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# Runtime: Express API, Telegram bot, static dashboard
FROM node:20-alpine AS app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3500

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY data ./data
COPY scripts ./scripts
COPY --from=dashboard-build /app/dashboard/dist ./dashboard/dist

EXPOSE 3500
CMD ["node", "src/index.js"]
