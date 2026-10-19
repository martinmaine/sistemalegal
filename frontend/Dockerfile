# Imagen del frontend para docker compose. En Vercel el build lo hace la
# plataforma, así que esta imagen es el camino local y el respaldo de la defensa.
FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencias AS desarrollo
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM dependencias AS compilacion
COPY . .
ARG VITE_API_URL
RUN npm run build

FROM nginx:alpine AS produccion
COPY --from=compilacion /app/dist /usr/share/nginx/html
EXPOSE 80
