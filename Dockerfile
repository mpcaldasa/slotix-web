FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/slotix-web/browser/ /usr/share/nginx/html/
EXPOSE 8080
