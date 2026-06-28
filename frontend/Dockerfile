FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Protege node_modules del volumen mount
VOLUME ["/app/node_modules"]
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]