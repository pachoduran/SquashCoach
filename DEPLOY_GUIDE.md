# Guía de Despliegue - Squash Coach Web
# Servidor: CentOS VPS (mismo que tecnophysio.com)
# Dominio: www.squashcoach.co

## IMPORTANTE: Esta app es solo frontend (archivos estáticos)
## El frontend se comunica directamente con tu API en lev.jsb.mybluehost.me:8001
## NO necesitas Python ni backend en el VPS para esta app

# ============================================
# PASO 1: Guardar código en GitHub
# ============================================
# En Emergent: usa el botón "Save to Github" en el chat
# Esto creará/actualizará tu repositorio en GitHub

# ============================================
# PASO 2: Conectarte a tu VPS por SSH
# ============================================
# ssh root@TU_IP_VPS

# ============================================
# PASO 3: Instalar Node.js (si no lo tienes)
# ============================================
# Verificar si ya está instalado:
node --version
# Si no está instalado:
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
# Instalar yarn:
sudo npm install -g yarn

# ============================================
# PASO 4: Clonar el repositorio
# ============================================
cd /var/www
git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git squashcoach
cd squashcoach/frontend

# ============================================
# PASO 5: Compilar el frontend para producción
# ============================================
yarn install
REACT_APP_BACKEND_URL=https://www.squashcoach.co yarn build

# Esto crea la carpeta /var/www/squashcoach/frontend/build/
# con todos los archivos estáticos listos para servir

# ============================================
# PASO 6: Configurar Nginx
# ============================================
# Crear archivo de configuración (NO modifica tecnophysio.com)
sudo nano /etc/nginx/conf.d/squashcoach.conf

# --- COPIAR ESTE CONTENIDO EN squashcoach.conf ---
# server {
#     listen 80;
#     server_name squashcoach.co www.squashcoach.co;
#
#     root /var/www/squashcoach/frontend/build;
#     index index.html;
#
#     # React SPA - todas las rutas van a index.html
#     location / {
#         try_files $uri $uri/ /index.html;
#     }
#
#     # Cache de archivos estáticos
#     location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
#         expires 30d;
#         add_header Cache-Control "public, immutable";
#     }
# }
# --- FIN DEL CONTENIDO ---

# ============================================
# PASO 7: Verificar y reiniciar Nginx
# ============================================
sudo nginx -t
sudo systemctl reload nginx

# ============================================
# PASO 8: Configurar SSL con Let's Encrypt
# ============================================
# Instalar certbot si no lo tienes:
sudo yum install -y certbot python3-certbot-nginx

# Obtener certificado SSL:
sudo certbot --nginx -d squashcoach.co -d www.squashcoach.co

# Certbot modificará automáticamente tu squashcoach.conf
# para agregar HTTPS y redirigir HTTP -> HTTPS

# ============================================
# PASO 9: Verificar
# ============================================
# Abrir en el navegador: https://www.squashcoach.co
# Debería mostrar la página de login

# ============================================
# PARA ACTUALIZAR EN EL FUTURO:
# ============================================
# cd /var/www/squashcoach
# git pull
# cd frontend
# yarn install
# REACT_APP_BACKEND_URL=https://www.squashcoach.co yarn build
# (Nginx sirve automáticamente los archivos nuevos)
