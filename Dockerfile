FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
# omit=optional/peer: blocks @prisma/client's optional-peer on the prisma CLI,
# which otherwise drags Studio (react-dom, chart.js) + PGlite into prod
RUN npm ci --omit=dev --omit=optional --omit=peer

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
