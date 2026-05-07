FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:css

FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node models ./models
COPY --chown=node:node db.js index.js ./

USER node

EXPOSE 3000
CMD ["node", "index.js"]
