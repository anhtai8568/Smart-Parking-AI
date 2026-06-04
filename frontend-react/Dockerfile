FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

# Sử dụng --host 0.0.0.0 để cho phép truy cập từ máy chủ (host machine)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
