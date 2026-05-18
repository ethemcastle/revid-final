FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations

RUN npm run build

CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]

