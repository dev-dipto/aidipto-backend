FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm install typescript --no-save && (npx tsc -p tsconfig.json || true) && test -f dist/server.js && npm uninstall typescript

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/server.js"]