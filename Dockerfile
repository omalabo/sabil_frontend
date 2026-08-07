# Étape 1 : Construction de l'application avec Node.js
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# On s'assure que l'URL de l'API est bien celle de la prod pendant le build
ENV VITE_API_BASE_URL=https://api.sabil-al-ilm.org/api
RUN npm run build

# Étape 2 : Servir les fichiers avec Nginx (ultra rapide et léger)
FROM nginx:alpine
# On copie le dossier 'dist' généré à l'étape 1 vers le dossier de Nginx
COPY --from=builder /app/dist /usr/share/nginx/html
# On copie notre configuration personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
