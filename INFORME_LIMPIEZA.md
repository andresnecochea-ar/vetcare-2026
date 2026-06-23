# Informe de limpieza y reorganización — VetCare

> Revisión de la carpeta del repositorio local al 23/06/2026.
> Objetivo: dejar el proyecto más prolijo, sin romper nada que esté en uso.
> **Nada de esto está aplicado todavía.** Es un plan para que decidas qué hacer.

---

## ⚠️ Lo primero y más importante (seguridad)

Hay archivos subidos a GitHub (repo público) que **no deberían estar versionados**:

**1. `backend/.wrangler/cache/wrangler-account.json`**
Contiene el ID y el nombre de tu cuenta de Cloudflare (tu email). No es una contraseña ni una clave secreta —no permite entrar a tu cuenta— pero es información de tu cuenta que no tiene por qué ser pública. La carpeta `.wrangler` es un caché temporal de la herramienta; no va al repositorio.

**Acción:** quitar del repo toda la carpeta `backend/.wrangler/` y agregarla al `.gitignore` (ver más abajo).

**Tranquilidad sobre lo demás:** la clave de invitación (`INVITE_CODE`) y las contraseñas NO están en ningún archivo del repo —viven en Cloudflare como secreto y en la base de datos hasheadas—. Eso está bien. El `worker.js` que sí está subido no contiene secretos; es solo lógica.

---

## 1. Para BORRAR

### Archivos temporales de la migración (ya cumplieron su función)
Se crearon para aplicar cambios sobre el `index.html` grande y ya no se usan:

- `backend/_check.js` — script de validación de sintaxis, descartable.
- `backend/_initblock.js` — fragmento usado una sola vez para insertar el login.
- `backend/migrate.py` — script de migración puntual, ya ejecutado.

### Caché de herramientas (no es código)
- `backend/.wrangler/` — caché local de wrangler. Se regenera solo. **Sacar del repo** (ver punto de seguridad).

### Backups que ya están a salvo en el historial de git
La carpeta `backups/` tiene 6 copias del `index.html` de distintos momentos del día. Git ya guarda todo ese historial por vos (podés volver a cualquier versión anterior con los commits y tags). Tener copias manuales *además* en el repo es redundante y ensucia.

- `backups/index.20260623-032917.html`
- `backups/index.pre-splash-040631.html`
- `backups/index.pre-logofix-041008.html`
- `backups/index.pre-compress-041443.html`
- `backups/index.pre-resize-042047.html`
- `backups/index.pre-backup-section-042412.html`

**Matiz:** si te da seguridad tenerlos a mano sin depender de git, está perfecto conservarlos — pero entonces conviene que la carpeta `backups/` quede **fuera del repo** (en tu compu nomás, vía `.gitignore`). Lo que no tiene sentido es subirlos a GitHub.

---

## 2. Para NO tocar (están en uso, aunque no lo parezca)

- **`assets/pets/*.png`** — son las siluetas por especie (perro, gato, ave, etc.) que la app muestra cuando una mascota no tiene foto. El `index.html` las usa (`assets/pets/ + especie + .png`). **No borrar.**
- **`index.html`** — la app. Obvio, pero por las dudas.
- **`backend/worker.js`, `backend/wrangler.toml`, `backend/DESPLEGAR.md`** — el servidor, su configuración y la guía para desplegarlo. Se quedan.

---

## 3. Para RENOMBRAR / aclarar

- **`ICONOS_BRIEF.md`** y **`kit_isotipo_veterinaria/`** son material de diseño (brief de íconos + kit del logo en PNG/SVG en muchos tamaños). No son parte de la app que se publica, pero son valiosos. No hace falta renombrarlos; sí conviene **agruparlos** (ver reorganización).
- **`kit_isotipo_veterinaria/`** pesa 1.7 MB (la mayoría del repo). No molesta, pero es lo más pesado. Si querés un repo liviano, este kit es candidato a vivir en una carpeta de material aparte, no en el repo de la app. Es opcional.

---

## 4. Para REORGANIZAR (estructura propuesta)

Hoy todo convive en la raíz. Una estructura más clara sería:

```
vetcare-2026/
├── index.html              ← la app (debe quedar en la raíz para GitHub Pages)
├── assets/
│   └── pets/               ← siluetas por especie (en uso)
├── backend/
│   ├── worker.js
│   ├── wrangler.toml
│   └── DESPLEGAR.md
├── docs/                   ← NUEVA: toda la documentación junta
│   ├── BASE.md
│   ├── ICONOS_BRIEF.md
│   └── INFORME_LIMPIEZA.md (este archivo)
├── design/                 ← NUEVA: material de marca (o sacarlo del repo)
│   └── kit_isotipo_veterinaria/
├── .gitignore              ← NUEVO (ver abajo)
└── .gitattributes
```

**Importante:** `index.html` tiene que quedar **sí o sí en la raíz**, porque es lo que GitHub Pages publica. No lo muevas a una subcarpeta o la app deja de cargar.

---

## 5. `.gitignore` recomendado (no existe hoy)

Crear un archivo `.gitignore` en la raíz con esto evita volver a subir basura:

```
# Caché de herramientas
backend/.wrangler/

# Copias locales de respaldo (git ya guarda el historial)
backups/

# Temporales de migración
backend/_*.js
backend/migrate.py

# Sistema
.DS_Store
Thumbs.db
```

---

## Resumen de acciones sugeridas (de menor a mayor esfuerzo)

1. **(Seguridad, hacer ya)** Sacar `backend/.wrangler/` del repo y agregar `.gitignore`.
2. **(Limpieza fácil)** Borrar los temporales `backend/_check.js`, `backend/_initblock.js`, `backend/migrate.py`.
3. **(Decisión tuya)** Sacar `backups/` del repo (dejarlos en tu compu o borrarlos, git ya tiene el historial).
4. **(Opcional, prolijidad)** Mover `BASE.md` e `ICONOS_BRIEF.md` a `docs/` y el kit de logo a `design/`.
5. **(Opcional)** Si querés repo liviano, sacar `kit_isotipo_veterinaria/` del repo a una carpeta de material aparte.

Decime cuáles querés que aplique y lo hago (con su Summary y Description para que lo subas).
```
