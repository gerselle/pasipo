FROM node:20-alpine

WORKDIR /pasipo

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE ${SERVER_PORT}

CMD ["node", "src/server/app.js"]