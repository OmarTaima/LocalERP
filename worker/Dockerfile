FROM node:20-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY worker/package.json ./worker/

RUN npm install --workspace=worker

COPY shared/ ./shared/
COPY worker/ ./worker/

RUN npm run build --workspace=shared && npm run build --workspace=worker

CMD ["node", "worker/dist/index.js"]
