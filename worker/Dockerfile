FROM node:20-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY worker/package.json ./worker/

RUN npm install --workspace=worker

COPY shared/ ./shared/
COPY worker/ ./worker/

CMD ["npx", "tsx", "worker/src/index.ts"]
