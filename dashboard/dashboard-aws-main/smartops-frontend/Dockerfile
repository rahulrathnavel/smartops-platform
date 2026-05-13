FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config: SPA routing + WebSocket proxy to dashboard-backend
RUN cat > /etc/nginx/conf.d/default.conf << 'NGINX'
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    resolver 172.20.0.10 valid=10s;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy WebSocket connections to dashboard-backend
    location /socket.io/ {
        set $backend http://dashboard-backend.smartops-system.svc.cluster.local:4000;
        proxy_pass $backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Proxy REST API calls to dashboard-backend
    location /health-backend {
        set $backend http://dashboard-backend.smartops-system.svc.cluster.local:4000;
        proxy_pass $backend/health;
    }

    # Static assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|svg|css|js|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
}
NGINX

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
