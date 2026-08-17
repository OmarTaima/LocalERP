FROM node:20-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

RUN npm install --workspace=backend

COPY shared/ ./shared/
COPY backend/ ./backend/

RUN npm run build --workspace=shared && npm run build --workspace=backend

EXPOSE 4000

CMD ["node", "backend/dist/index.js"]
