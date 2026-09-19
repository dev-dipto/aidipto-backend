FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm install typescript --no-save && npx tsc -p tsconfig.json && npm uninstall typescript

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/server.js"]
