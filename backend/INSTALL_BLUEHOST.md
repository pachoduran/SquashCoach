# 🎾 Squash Coach - Guía de Instalación en Bluehost VPS

## 📋 Requisitos Previos

Tu VPS Bluehost necesita:
- **Sistema Operativo:** Ubuntu 20.04+ o CentOS 7+
- **Python:** 3.9 o superior
- **MongoDB:** 4.4 o superior
- **Acceso SSH:** root o usuario con sudo

---

## 🚀 Paso 1: Conectarse al VPS

```bash
ssh usuario@tu-ip-bluehost
```

---

## 🐍 Paso 2: Instalar Python 3.9+

### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install python3.9 python3.9-venv python3-pip -y
```

### CentOS:
```bash
sudo yum install python39 python39-pip -y
```

---

## 🍃 Paso 3: Instalar MongoDB

### Ubuntu 20.04+:
```bash
# Importar clave pública
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Agregar repositorio
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Instalar
sudo apt update
sudo apt install mongodb-org -y

# Iniciar y habilitar
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Verificar que MongoDB está corriendo:
```bash
sudo systemctl status mongod
```

---

## 📁 Paso 4: Crear Estructura de Carpetas

```bash
# Crear carpeta para la app
sudo mkdir -p /var/www/squash-coach
cd /var/www/squash-coach

# Subir archivos (desde tu computadora)
# Usa SCP o SFTP para subir:
# - server.py
# - requirements-minimal.txt (renómbralo a requirements.txt)
```

### Subir archivos con SCP (desde tu computadora local):
```bash
scp server.py usuario@tu-ip-bluehost:/var/www/squash-coach/
scp requirements-minimal.txt usuario@tu-ip-bluehost:/var/www/squash-coach/requirements.txt
```

---

## 🔧 Paso 5: Configurar el Backend

```bash
cd /var/www/squash-coach

# Crear entorno virtual
python3.9 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 🔐 Paso 6: Crear archivo .env

```bash
nano /var/www/squash-coach/.env
```

Contenido del archivo `.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=squash_coach
```

Guardar: `Ctrl+X`, luego `Y`, luego `Enter`

---

## 🧪 Paso 7: Probar que funciona

```bash
cd /var/www/squash-coach
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001
```

Deberías ver:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
INFO:     Application startup complete.
```

Prueba desde otro terminal o navegador:
```bash
curl http://tu-ip-bluehost:8001/api/
```

Debería responder: `{"message":"Squash Coach API","version":"1.0.0"}`

---

## 🔥 Paso 8: Abrir Puerto en Firewall

### Ubuntu (UFW):
```bash
sudo ufw allow 8001/tcp
sudo ufw reload
```

### CentOS (firewalld):
```bash
sudo firewall-cmd --permanent --add-port=8001/tcp
sudo firewall-cmd --reload
```

---

## ⚙️ Paso 9: Crear Servicio Systemd (para que corra siempre)

```bash
sudo nano /etc/systemd/system/squash-coach.service
```

Contenido:
```ini
[Unit]
Description=Squash Coach API
After=network.target mongod.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/squash-coach
Environment="PATH=/var/www/squash-coach/venv/bin"
ExecStart=/var/www/squash-coach/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Guardar y activar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable squash-coach
sudo systemctl start squash-coach
```

Verificar estado:
```bash
sudo systemctl status squash-coach
```

---

## 🌐 Paso 10: Configurar Nginx (Opcional - para HTTPS)

Si quieres usar un dominio con HTTPS:

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

sudo nano /etc/nginx/sites-available/squash-coach
```

Contenido:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activar:
```bash
sudo ln -s /etc/nginx/sites-available/squash-coach /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Obtener certificado SSL (HTTPS)
sudo certbot --nginx -d tu-dominio.com
```

---

## 📱 Paso 11: Actualizar la App Móvil

Una vez que tu backend esté corriendo, necesitas actualizar la URL en la app.

En el archivo `frontend/.env`, cambia:
```
EXPO_PUBLIC_BACKEND_URL=https://tu-dominio.com
```

O si usas IP directa:
```
EXPO_PUBLIC_BACKEND_URL=http://tu-ip-bluehost:8001
```

Luego genera un nuevo APK con `eas build`.

---

## 🛠️ Comandos Útiles

```bash
# Ver logs del backend
sudo journalctl -u squash-coach -f

# Reiniciar backend
sudo systemctl restart squash-coach

# Ver estado de MongoDB
sudo systemctl status mongod

# Conectarse a MongoDB para ver datos
mongosh
use squash_coach
db.users.find()
db.matches.find()
```

---

## ❓ Problemas Comunes

### Error: "Connection refused"
- Verifica que MongoDB esté corriendo: `sudo systemctl status mongod`
- Verifica que el firewall permita el puerto: `sudo ufw status`

### Error: "Module not found"
- Activa el entorno virtual: `source venv/bin/activate`
- Reinstala dependencias: `pip install -r requirements.txt`

### La app no conecta
- Verifica la URL en el frontend
- Asegúrate de que el puerto esté abierto en el firewall de Bluehost (panel de control)

---

## 📞 Soporte

Si tienes problemas, revisa:
1. Logs del backend: `sudo journalctl -u squash-coach -f`
2. Logs de MongoDB: `sudo journalctl -u mongod -f`
3. Estado de servicios: `sudo systemctl status squash-coach mongod`
