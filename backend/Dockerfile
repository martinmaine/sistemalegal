# Imagen del backend. Render puede construirla, pero su uso principal es
# docker compose: el respaldo local para la defensa oral.
FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencias AS desarrollo
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

FROM dependencias AS compilacion
COPY . .
RUN npm run build

FROM node:24-alpine AS produccion
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=compilacion /app/dist ./dist
# La CA de Supabase: sin ella el backend no puede verificar el certificado del pooler.
COPY certs ./certs
EXPOSE 4000
CMD ["node", "dist/index.js"]
