# VetCare

Sistema web de gestión veterinaria. El frontend es estático y la API corre en
Cloudflare Workers con una base D1.

## Estado del proyecto

- Frontend: HTML, CSS y JavaScript sin framework.
- API: Cloudflare Worker en TypeScript.
- Datos: Cloudflare D1, versionados mediante migraciones SQL.
- Pruebas: Vitest dentro del runtime de Workers.
- Automatización: GitHub Actions para validar, publicar GitHub Pages y desplegar
  el Worker.

## Preparación local

Requisitos:

- Node.js 22 o superior.
- npm.

Desde la raíz del proyecto:

```powershell
npm install
Copy-Item backend/.dev.vars.example backend/.dev.vars
npm run db:migrate:local
npm test
npm run check
```

`backend/.dev.vars` contiene el código de invitación de desarrollo y está
excluido de Git. Cambialo antes de crear usuarios locales.

Para iniciar la API local:

```powershell
npm run worker:dev
```

El frontend puede servirse con cualquier servidor HTTP estático. La dirección
de la API se define en `js/config.js`.

## Comandos

| Comando | Función |
| --- | --- |
| `npm test` | Ejecuta las pruebas de integración del Worker y D1 |
| `npm run check` | Valida sintaxis, TypeScript, tipos de Wrangler y bundle |
| `npm run build` | Genera el frontend publicable en `dist/` |
| `npm run worker:dev` | Inicia Worker y D1 en modo local |
| `npm run db:migrate:local` | Aplica migraciones a D1 local |
| `npm run db:migrate:remote` | Aplica migraciones a D1 de producción |
| `npm run worker:deploy` | Despliega la API en Cloudflare |

## Datos cubiertos por la API

La sincronización incluye dueños, mascotas, copropietarios, historial clínico,
vacunas, estudios, imágenes, turnos, peluquería, recordatorios, inventario,
facturas y configuración de la clínica. Los campos estructurados como lotes e
ítems de factura se guardan como JSON y vuelven a entregarse como arreglos.

## Roles y auditoría

La primera cuenta de una instalación nueva se crea como administradora. Las
siguientes cuentas comienzan en Recepción y una persona administradora puede
cambiarles el rol desde **Opciones → Accesos y auditoría**.

| Capacidad | Administración | Veterinaria | Recepción |
| --- | --- | --- | --- |
| Configuración, usuarios y roles | Sí | No | No |
| Historia clínica, vacunas y estudios | Sí | Sí | Solo lectura |
| Tutores, pacientes, agenda y recibos | Sí | Sí | Sí |
| Inventario | Sí | Sí | Solo lectura |
| Eliminar pacientes, tutores, productos o recibos | Sí | No | No |
| Consultar auditoría | Sí | No | No |

La auditoría conserva quién realizó la operación, la acción, el tipo e
identificador del registro, los nombres de los campos modificados y la fecha.
No guarda contraseñas ni el contenido clínico o administrativo de esos campos.

## Configuración y secretos

- `backend/wrangler.jsonc`: nombre del Worker, binding D1, orígenes CORS y
  configuración observable.
- `backend/.dev.vars`: secretos locales; nunca se sube al repositorio.
- `INVITE_CODE`: secreto obligatorio en Cloudflare para habilitar el registro.
- `js/config.js`: URL pública de la API consumida por el frontend.

La guía completa para preparar Cloudflare y GitHub está en
[`backend/DESPLEGAR.md`](backend/DESPLEGAR.md).

## Automatización

Cada push y pull request ejecuta las pruebas y validaciones. El despliegue desde
`main` queda deliberadamente desactivado hasta configurar estas variables del
repositorio:

- `PAGES_DEPLOY_ENABLED=true`
- `CLOUDFLARE_DEPLOY_ENABLED=true`

Y estos secretos:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Antes de activar producción, verificá el identificador de D1 y aplicá las
migraciones contra una copia o respaldo de la base existente.
