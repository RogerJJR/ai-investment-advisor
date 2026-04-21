FROM node:20-alpine

WORKDIR /app
COPY package.json ./
# No deps yet; RUN npm install becomes a no-op but kept for future.
RUN npm install --omit=dev
COPY index.js ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "index.js"]
