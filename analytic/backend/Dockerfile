FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM deps AS build
COPY tsconfig.json ./
COPY producer ./producer
COPY consumers ./consumers
COPY schemas ./schemas
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
CMD ["npm", "run", "start"]
