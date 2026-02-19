FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Stage: install all deps and build
FROM base AS build
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi
COPY . .
RUN npm run build

# Stage: production deps only
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile --prod; \
    elif [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# Stage: final runtime image
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/build ./build
EXPOSE $PORT
CMD ["node", "./build/server/index.js"]
