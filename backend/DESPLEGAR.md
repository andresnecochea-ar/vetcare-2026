# Cómo desplegar el backend de VetCare

El Worker hay que desplegarlo desde tu compu porque requiere tu login de Cloudflare.
Son 4 comandos. Abrí una terminal en la carpeta `backend`.

## 1. Instalar wrangler (una sola vez)
```
npm install -g wrangler
```

## 2. Iniciar sesión en Cloudflare (abre el navegador)
```
wrangler login
```

## 3. Desplegar el Worker
```
wrangler deploy
```
Al terminar te muestra una URL parecida a:
```
https://vetcare-api.TU-SUBDOMINIO.workers.dev
```
**Copiá esa URL.** Es la dirección de tu API.

## 4. Pegar la URL en la app
Abrí `index.html`, buscá arriba del script la línea:
```
const API_BASE = 'PEGAR_AQUI_LA_URL_DEL_WORKER';
```
y reemplazá el texto por tu URL (sin barra al final). Guardá.

## Primer usuario
La primera vez, abrí la app y usá el botón "Crear cuenta" para registrar tu usuario.
A partir de ahí entrás con email y contraseña.

## Datos
- La base de datos `vetcare` (D1) ya está creada con todas las tablas.
- Empieza vacía: los datos de demo del navegador NO se suben solos.
