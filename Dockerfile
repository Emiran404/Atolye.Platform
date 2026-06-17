# Aşama 1: Ortak Derleme (Builder)
FROM node:20 AS builder
WORKDIR /app

# Kök dizindeki bağımlılıkları kopyala ve kur
COPY package*.json ./
RUN npm install

# Frontend kaynaklarını kopyala ve derle
COPY vite.config.js eslint.config.js index.html ./
COPY src ./src
COPY public ./public
RUN npm run build:frontend

# Backend bağımlılıklarını kopyala ve kur
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install

# Backend kaynaklarını kopyala ve derle
COPY server/ ./
RUN npm run build


# Aşama 2: Üretim (Production) Sunucusu
FROM node:20-slim
WORKDIR /app

# Gerekli sistem paketleri (better-sqlite3 derlemesi için python ve build araçları şarttır)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Server production bağımlılıklarını kur
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

# Builder aşamasından derlenmiş backend kodlarını (dist) kopyala
COPY --from=builder /app/server/dist ./dist

# Builder aşamasından derlenmiş frontend'i (kök /dist) kopyala
COPY --from=builder /app/dist /app/dist

# Ortam değişkenleri
ENV NODE_ENV=production
ENV PORT=3001

# Gerekli klasörlerin (volumes) oluşturulması
RUN mkdir -p /app/server/data /app/server/backups /app/src/uploads_student

# Dışarıya açılacak port
EXPOSE 3001

# Uygulamayı başlat (TypeScript'in derlediği dist/index.js dosyası üzerinden)
CMD ["node", "dist/index.js"]
