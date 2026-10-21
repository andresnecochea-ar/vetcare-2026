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
ff69acbe-d754-4f3a-9b8d-e5811a24156e
```

Confirmá que pertenece a la cuenta conectada. Si creás una base nueva:

```powershell
npx wrangler d1 create vetcare
```

Después reemplazá `database_id` en `backend/wrangler.jsonc` por el valor
devuelto.

### Cuenta propia de VetCare

La cuenta **VetCare** tiene el ID `930d054277b5ab3e2adca108517e9aeb` y queda
fijada mediante `account_id` en `backend/wrangler.jsonc`. Contiene el Worker
`vetcare-api` y la base D1 `vetcare`. Faneroo y Chep Desktop tienen sus propias
cuentas y no son destinos válidos para publicar VetCare.

El secreto de GitHub `CLOUDFLARE_ACCOUNT_ID` debe coincidir con esta cuenta.
El token de despliegue está limitado a esta cuenta, con escritura de Workers
y D1 y lectura de configuración. Vence el **20/10/2027**; renovarlo y actualizar
`CLOUDFLARE_API_TOKEN` antes de esa fecha. No guardar tokens en Git.

El traslado conserva usuarios, verificadores de contraseña y datos clínicos.
El código de invitación se configura como secreto en el Worker nuevo;
no se reemplaza por el valor de ejemplo de `backend/.dev.vars`. La dirección
anterior se conserva temporalmente como puente hacia la nueva API después
del cambio, para atender pestañas que todavía usan la configuración anterior.
Su código y configuración están en `backend/legacy-proxy/`; no contiene base
ni secreto de invitación. Se administra aparte con credenciales de la cuenta
Faneroo; el token del repositorio sólo permite publicar en VetCare.

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
https://vetcare-api.vetcare-necochea.workers.dev/api/health
```

El resultado esperado contiene `"status": "ok"`, `"database": "ready"` y
`"schemaVersion": 18`.

La migración `0006_roles_and_audit.sql` convierte las cuentas existentes con
el rol anterior `staff` en administradoras. Esto evita bloquear el acceso al
publicar la matriz de permisos; luego los roles se ajustan desde la aplicación.

## 5. Configurar el frontend

La URL de la API está separada del código en `js/config.js`:

```javascript
window.VETCARE_CONFIG = Object.freeze({
  apiBase: 'https://vetcare-api.vetcare-necochea.workers.dev'
});
```

Si cambia el dominio del Worker, actualizá ese archivo y el parámetro de versión
de su etiqueta `<script>` en `index.html` para renovar las copias del navegador. El origen
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
