# Simple Dockerfile for the server

FROM node:18-alpine
WORKDIR /app
COPY server/package.json ./server/package.json
COPY server/index.js ./server/index.js
COPY server/data ./server/data
RUN cd /app && cd server && npm install --production
EXPOSE 3000
CMD ["node", "server/index.js"]
