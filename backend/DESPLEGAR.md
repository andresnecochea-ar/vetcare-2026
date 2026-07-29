# Despliegue de VetCare

La aplicación usa dos destinos:

- GitHub Pages publica el frontend estático.
- Cloudflare Workers ejecuta la API y D1 conserva los datos.

## 1. Preparar el proyecto

Desde la raíz:

```powershell
npm install
Copy-Item backend/.dev.vars.example backend/.dev.vars
npm run db:migrate:local
npm test
npm run check
```

Editá `backend/.dev.vars` y reemplazá el código de invitación de ejemplo. Este
archivo está ignorado por Git.

## 2. Conectar Cloudflare

Wrangler está instalado dentro del proyecto; no hace falta instalarlo
globalmente.

```powershell
npx wrangler login
npx wrangler whoami
```

El archivo `backend/wrangler.jsonc` referencia la base D1 `vetcare` con este
identificador:

```text
57abd6e4-a2c0-4ae3-a0ae-c3b7ccd5d799
```

Confirmá que pertenece a la cuenta conectada. Si creás una base nueva:

```powershell
npx wrangler d1 create vetcare
```

Después reemplazá `database_id` en `backend/wrangler.jsonc` por el valor
devuelto.

## 3. Configurar el secreto

`INVITE_CODE` es obligatorio y no debe agregarse a `vars` ni guardarse en Git:

```powershell
npx wrangler secret put INVITE_CODE --config backend/wrangler.jsonc
```

Wrangler solicita el valor de manera interactiva.

## 4. Migrar y desplegar

Antes de modificar una base que ya tenga datos, hacé un respaldo y revisá qué
migraciones están pendientes:

```powershell
npx wrangler d1 migrations list vetcare --remote --config backend/wrangler.jsonc
```

Luego:

```powershell
npm run db:migrate:remote
npm run worker:deploy
```

Verificá:

```text
https://vetcare-api.vetcare-neco.workers.dev/api/health
```

El resultado esperado contiene `"status": "ok"`, `"database": "ready"` y
`"schemaVersion": 6`.

La migración `0006_roles_and_audit.sql` convierte las cuentas existentes con
el rol anterior `staff` en administradoras. Esto evita bloquear el acceso al
publicar la matriz de permisos; luego los roles se ajustan desde la aplicación.

## 5. Configurar el frontend

La URL de la API está separada del código en `js/config.js`:

```javascript
window.VETCARE_CONFIG = Object.freeze({
  apiBase: 'https://vetcare-api.vetcare-neco.workers.dev'
});
```

Si cambia el dominio del Worker, actualizá solamente ese archivo. El origen
público también debe estar incluido en `ALLOWED_ORIGINS` dentro de
`backend/wrangler.jsonc`.

## 6. Conectar GitHub Actions

En el repositorio de GitHub configurá:

**Settings → Secrets and variables → Actions → Secrets**

- `CLOUDFLARE_API_TOKEN`: token limitado a Workers Scripts y D1.
- `CLOUDFLARE_ACCOUNT_ID`: identificador de la cuenta.

**Settings → Secrets and variables → Actions → Variables**

- `PAGES_DEPLOY_ENABLED=true`
- `CLOUDFLARE_DEPLOY_ENABLED=true`

En **Settings → Pages**, elegí **GitHub Actions** como origen. El workflow de
`main` primero prueba el proyecto; sólo después publica Pages, aplica las
migraciones D1 pendientes y despliega el Worker.

El secreto `INVITE_CODE` se configura una sola vez directamente en Cloudflare y
no necesita estar disponible para GitHub.

## Referencias oficiales

- [Configuración de Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Migraciones de D1](https://developers.cloudflare.com/d1/reference/migrations/)
- [Secretos de Workers](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Publicar con GitHub Pages](https://docs.github.com/actions/deployment/deploying-to-your-cloud-provider/deploying-to-github-pages)
