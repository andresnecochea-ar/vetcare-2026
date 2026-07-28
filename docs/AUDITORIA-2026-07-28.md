# Auditoría técnica y actualización — 28 de julio de 2026

## Resultado

La base D1 de producción fue respaldada, auditada y actualizada sin pérdida de
registros. El Worker 2.1.0 quedó desplegado en la misma URL pública y el
frontend existente continúa siendo compatible.

## Respaldo

- Archivo local: `backups/vetcare-remote-before-audit-2026-07-28.sql`
- SHA-256: `B4D760591BAB6A7A890C1E9884F980EAAEA0C1491E76A04F6A0DC053B71DAC06`
- El directorio `backups/` está excluido de Git porque contiene datos reales.

## Estado de D1

Conteos comprobados antes y después de las migraciones:

| Entidad | Registros |
| --- | ---: |
| Usuarios | 2 |
| Sesiones | 5 |
| Dueños | 1 |
| Mascotas | 2 |
| Asociaciones mascota/dueño | 0 |
| Turnos clínicos | 1 |
| Turnos de peluquería | 1 |
| Inventario | 1 |
| Historiales, vacunas, imágenes, recordatorios y facturas | 0 |

No se encontraron sesiones huérfanas, relaciones huérfanas, emails inválidos ni
JSON inválido en facturas. Cuatro sesiones estaban vencidas y una seguía activa;
no se eliminaron registros durante la auditoría.

## Migraciones

Se restauró el respaldo en una D1 local aislada y se aplicaron allí ambas
migraciones antes de tocar producción. Los conteos permanecieron iguales.

Después se aplicaron correctamente en producción:

- `0001_initial.sql`
- `0002_complete_data_model.sql`

El esquema agregó:

- `owners.dni` y `owners.notes`
- `groomingAppointments.reminder` y `groomingAppointments.notes`
- `inventory.lots`
- tabla `pet_studies`
- tabla `app_settings`
- índices para consultas frecuentes

## Worker

- URL: `https://vetcare-api.vetcare-neco.workers.dev`
- Versión desplegada: `2.1.0`
- Version ID: `566688f5-a3e2-445a-b44a-8f36ccf58c2e`
- Versión anterior disponible para rollback:
  `a4221503-9dc6-42c2-a001-61dc363e2fcf`

Comprobaciones posteriores:

- `/api/health`: HTTP 200
- `status`: `ok`
- `database`: `ready`
- `schemaVersion`: `2`
- CORS permite el frontend oficial
- CORS rechaza orígenes no autorizados
- `INVITE_CODE` continúa configurado como secreto

## Validación local

- Respaldo de producción restaurado correctamente.
- Migraciones aplicadas sobre la copia sin pérdida de datos.
- Registro e inicio de sesión de prueba correctos.
- Lectura del snapshot completo correcta.
- 3 pruebas de integración aprobadas.
- 21 archivos JavaScript con sintaxis válida.
- TypeScript sin errores.
- Tipos de Wrangler actualizados.
- Bundle del Worker generado correctamente.
- Frontend generado en `dist/`.
- Auditoría npm: 0 vulnerabilidades.

## GitHub y frontend público

- Actualización publicada inicialmente en `main` mediante el commit `044b19e`.
- CI: correcto.
- Workflow de despliegue: correcto.
- GitHub Pages: correcto.
- `index.html`, `js/api.js` y `js/config.js` públicos fueron comparados por hash
  con el commit y coinciden exactamente.

El frontend y el Worker usan la misma URL de API y quedaron sincronizados sin
requerir una acción de los usuarios.
