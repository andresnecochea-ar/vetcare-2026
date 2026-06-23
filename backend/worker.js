// ============================================================
// VetCare - Cloudflare Worker (API + autenticación)
// Base de datos: D1 "vetcare"
// Una sola veterinaria: todos los usuarios comparten los datos.
// ============================================================

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// --- CORS: permití el origen donde corra tu index.html ---
function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...JSON_HEADERS, ...cors(origin) },
  });
}

function uid() {
  return crypto.randomUUID();
}

// --- Hash de contraseñas con PBKDF2 (nativo en Workers) ---
async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  const hashHex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  const outSalt = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash: hashHex, salt: outSalt };
}

async function getUserFromToken(env, req) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT s.user_id, s.expires_at, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  ).bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  return { id: row.user_id, email: row.email, name: row.name, role: row.role };
}

// Entidades simples (CRUD genérico). Las columnas válidas por tabla:
const TABLES = {
  owners: ['id','name','phone','email','address','relationship'],
  pets: ['id','name','species','breed','sex','color','birthdate','weight','microchip','allergies','chronicConditions','notes','photo'],
  appointments: ['id','petId','date','time','type','vet','notes'],
  groomingAppointments: ['id','petId','date','time','service','groomer','price','status'],
  reminders: ['id','title','petId','date','notes','completed'],
  inventory: ['id','name','category','quantity','unit','price','minStock','supplier','notes'],
  invoices: ['id','number','date','ownerId','petId','items','total','status','notes'],
};

async function listEntity(env, table) {
  const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
  return results || [];
}

async function upsertEntity(env, table, body) {
  const cols = TABLES[table];
  const id = body.id || uid();
  const row = { ...body, id };
  const fields = cols.filter(c => c in row);
  const placeholders = fields.map(() => '?').join(',');
  const updates = fields.map(c => `${c}=excluded.${c}`).join(',');
  const values = fields.map(c => {
    const v = row[c];
    if (typeof v === 'object' && v !== null) return JSON.stringify(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  });
  await env.DB.prepare(
    `INSERT INTO ${table} (${fields.join(',')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`
  ).bind(...values).run();
  return row;
}

async function deleteEntity(env, table, id) {
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return { ok: true };
}

// --- Pets con sub-entidades (history, vaccines, images, owners) ---
async function getPetsFull(env) {
  const pets = await listEntity(env, 'pets');
  const [hist, vac, img, po] = await Promise.all([
    env.DB.prepare('SELECT * FROM pet_history').all(),
    env.DB.prepare('SELECT * FROM pet_vaccines').all(),
    env.DB.prepare('SELECT * FROM pet_images').all(),
    env.DB.prepare('SELECT * FROM pet_owners').all(),
  ]);
  const byPet = (rows, key) => {
    const m = {};
    (rows.results || []).forEach(r => { (m[r[key]] = m[r[key]] || []).push(r); });
    return m;
  };
  const h = byPet(hist, 'pet_id'), v = byPet(vac, 'pet_id'), i = byPet(img, 'pet_id'), o = byPet(po, 'pet_id');
  return pets.map(p => ({
    ...p,
    history: (h[p.id] || []).map(({ pet_id, ...r }) => r),
    vaccines: (v[p.id] || []).map(({ pet_id, ...r }) => r),
    images: (i[p.id] || []).map(({ pet_id, ...r }) => r),
    ownerIds: (o[p.id] || []).map(r => r.owner_id),
  }));
}

async function savePetFull(env, body) {
  const id = body.id || uid();
  await upsertEntity(env, 'pets', { ...body, id });
  // Reemplazar sub-entidades de este pet
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pet_history WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_vaccines WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_images WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_owners WHERE pet_id = ?').bind(id),
  ]);
  const stmts = [];
  (body.history || []).forEach(h => stmts.push(
    env.DB.prepare('INSERT INTO pet_history (id,pet_id,date,type,title,description,treatment,vet) VALUES (?,?,?,?,?,?,?,?)')
      .bind(h.id || uid(), id, h.date, h.type, h.title, h.description, h.treatment, h.vet)));
  (body.vaccines || []).forEach(x => stmts.push(
    env.DB.prepare('INSERT INTO pet_vaccines (id,pet_id,name,date,nextDose) VALUES (?,?,?,?,?)')
      .bind(x.id || uid(), id, x.name, x.date, x.nextDose)));
  (body.images || []).forEach(x => stmts.push(
    env.DB.prepare('INSERT INTO pet_images (id,pet_id,data,caption) VALUES (?,?,?,?)')
      .bind(x.id || uid(), id, x.data || '', x.caption || '')));
  (body.ownerIds || []).forEach(oid => stmts.push(
    env.DB.prepare('INSERT INTO pet_owners (pet_id,owner_id) VALUES (?,?)').bind(id, oid)));
  if (stmts.length) await env.DB.batch(stmts);
  return { ...body, id };
}

async function deletePetFull(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pet_history WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_vaccines WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_images WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_owners WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pets WHERE id = ?').bind(id),
  ]);
  return { ok: true };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin');
    const path = url.pathname.replace(/\/+$/, '');

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });

    try {
      // ---------- AUTH ----------
      if (path === '/api/register' && req.method === 'POST') {
        const { email, password, name } = await req.json();
        if (!email || !password) return json({ error: 'Faltan email o contraseña' }, 400, origin);
        const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
        if (exists) return json({ error: 'Ese email ya está registrado' }, 409, origin);
        const { hash, salt } = await hashPassword(password);
        const id = uid();
        await env.DB.prepare(
          'INSERT INTO users (id,email,name,pass_hash,pass_salt,role,created_at) VALUES (?,?,?,?,?,?,?)'
        ).bind(id, email.toLowerCase(), name || '', hash, salt, 'staff', new Date().toISOString()).run();
        return json({ ok: true, id }, 201, origin);
      }

      if (path === '/api/login' && req.method === 'POST') {
        const { email, password } = await req.json();
        const u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind((email || '').toLowerCase()).first();
        if (!u) return json({ error: 'Credenciales inválidas' }, 401, origin);
        const { hash } = await hashPassword(password, u.pass_salt);
        if (hash !== u.pass_hash) return json({ error: 'Credenciales inválidas' }, 401, origin);
        const token = uid() + uid().replace(/-/g, '');
        const now = new Date();
        const exp = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 días
        await env.DB.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)')
          .bind(token, u.id, now.toISOString(), exp.toISOString()).run();
        return json({ token, user: { id: u.id, email: u.email, name: u.name, role: u.role } }, 200, origin);
      }

      if (path === '/api/logout' && req.method === 'POST') {
        const auth = req.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
        return json({ ok: true }, 200, origin);
      }

      // ---------- A partir de acá: requiere sesión ----------
      const user = await getUserFromToken(env, req);
      if (!user) return json({ error: 'No autenticado' }, 401, origin);

      if (path === '/api/me') return json({ user }, 200, origin);

      // Snapshot completo de la base (lo usa la app al iniciar)
      if (path === '/api/data' && req.method === 'GET') {
        const [pets, owners, appointments, groomingAppointments, reminders, inventory, invoices] = await Promise.all([
          getPetsFull(env),
          listEntity(env, 'owners'),
          listEntity(env, 'appointments'),
          listEntity(env, 'groomingAppointments'),
          listEntity(env, 'reminders'),
          listEntity(env, 'inventory'),
          listEntity(env, 'invoices'),
        ]);
        return json({ pets, owners, appointments, groomingAppointments, reminders, inventory, invoices }, 200, origin);
      }

      // CRUD por entidad: /api/<entidad>[/<id>]
      const m = path.match(/^\/api\/([a-zA-Z]+)(?:\/(.+))?$/);
      if (m) {
        const table = m[1];
        const id = m[2];
        if (table === 'pets') {
          if (req.method === 'GET') return json(await getPetsFull(env), 200, origin);
          if (req.method === 'POST' || req.method === 'PUT') return json(await savePetFull(env, await req.json()), 200, origin);
          if (req.method === 'DELETE' && id) return json(await deletePetFull(env, id), 200, origin);
        } else if (TABLES[table]) {
          if (req.method === 'GET') return json(await listEntity(env, table), 200, origin);
          if (req.method === 'POST' || req.method === 'PUT') return json(await upsertEntity(env, table, await req.json()), 200, origin);
          if (req.method === 'DELETE' && id) return json(await deleteEntity(env, table, id), 200, origin);
        }
      }

      return json({ error: 'Ruta no encontrada' }, 404, origin);
    } catch (err) {
      return json({ error: 'Error del servidor', detail: String(err && err.message || err) }, 500, origin);
    }
  },
};
