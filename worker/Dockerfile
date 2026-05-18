FROM node:22-alpine
WORKDIR /app

COPY worker/package.json ./
RUN npm install

COPY worker/tsconfig.json ./
COPY worker/src ./src
COPY worker/migrations ./migrations

RUN npm run build

CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
