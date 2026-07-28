// VetCare API — Cloudflare Worker + D1.

type JsonObject = Record<string, unknown>;
type DbValue = string | number | null | ArrayBuffer;

type EntityConfig = {
  columns: readonly string[];
  jsonFields?: readonly string[];
  booleanFields?: readonly string[];
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const TABLES: Record<string, EntityConfig> = {
  owners: {
    columns: ['id', 'name', 'phone', 'email', 'address', 'relationship', 'dni', 'notes'],
  },
  pets: {
    columns: [
      'id', 'name', 'species', 'breed', 'sex', 'color', 'birthdate', 'weight',
      'microchip', 'allergies', 'chronicConditions', 'notes', 'photo',
    ],
  },
  appointments: {
    columns: ['id', 'petId', 'date', 'time', 'type', 'vet', 'notes'],
  },
  groomingAppointments: {
    columns: [
      'id', 'petId', 'date', 'time', 'service', 'groomer', 'price', 'status',
      'reminder', 'notes',
    ],
  },
  reminders: {
    columns: ['id', 'title', 'petId', 'date', 'notes', 'completed'],
    booleanFields: ['completed'],
  },
  inventory: {
    columns: [
      'id', 'name', 'category', 'quantity', 'unit', 'price', 'minStock',
      'supplier', 'notes', 'lots',
    ],
    jsonFields: ['lots'],
  },
  invoices: {
    columns: ['id', 'number', 'date', 'ownerId', 'petId', 'items', 'total', 'status', 'notes'],
    jsonFields: ['items'],
  },
};

function uid(): string {
  return crypto.randomUUID();
}

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError('El cuerpo debe ser un objeto JSON');
  }
  return value as JsonObject;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function configuredOrigins(env: Env): Set<string> {
  return new Set(
    stringValue(env.ALLOWED_ORIGINS)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function isAllowedOrigin(origin: string | null, env: Env): boolean {
  if (!origin) return true;
  if (configuredOrigins(env).has(origin)) return true;

  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null, env: Env): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });

  if (origin && isAllowedOrigin(origin, env)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  return headers;
}

function json(data: unknown, status: number, origin: string | null, env: Env): Response {
  const headers = corsHeaders(origin, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers });
}

async function secureEqual(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder();
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [])
    : crypto.getRandomValues(new Uint8Array(16));

  if (salt.length !== 16) throw new HttpError('Credenciales inválidas', 401);

  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  );
  const hash = [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const outSalt = [...salt].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return { hash, salt: outSalt };
}

async function getUserFromToken(env: Env, request: Request): Promise<JsonObject | null> {
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT s.user_id, s.expires_at, u.email, u.name, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
  ).bind(token).first<JsonObject>();

  if (!row) return null;
  if (new Date(stringValue(row.expires_at)).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }

  return {
    id: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

function serializeValue(value: unknown): DbValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'string') return value;
  return String(value);
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function deserializeRow(row: JsonObject, config: EntityConfig): JsonObject {
  const result = { ...row };
  for (const field of config.jsonFields ?? []) {
    result[field] = parseJson(result[field], []);
  }
  for (const field of config.booleanFields ?? []) {
    result[field] = result[field] === true || result[field] === 1;
  }
  return result;
}

function tableConfig(table: string): EntityConfig {
  const config = TABLES[table];
  if (!config) throw new HttpError('Entidad desconocida', 404);
  return config;
}

function buildUpsertStatement(
  env: Env,
  table: string,
  body: JsonObject,
): { id: string; row: JsonObject; statement: D1PreparedStatement } {
  const config = tableConfig(table);
  const suppliedId = optionalString(body.id);
  const id = suppliedId ?? uid();
  const row: JsonObject = { ...body, id };
  const fields = config.columns.filter((column) => Object.hasOwn(row, column));
  const placeholders = fields.map(() => '?').join(',');
  const updates = fields
    .filter((field) => field !== 'id')
    .map((field) => `${field}=excluded.${field}`)
    .join(',');
  const conflict = updates ? `DO UPDATE SET ${updates}` : 'DO NOTHING';
  const values = fields.map((field) => serializeValue(row[field]));
  const statement = env.DB.prepare(
    `INSERT INTO ${table} (${fields.join(',')}) VALUES (${placeholders})
     ON CONFLICT(id) ${conflict}`,
  ).bind(...values);

  return { id, row, statement };
}

async function listEntity(env: Env, table: string): Promise<JsonObject[]> {
  const config = tableConfig(table);
  const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all<JsonObject>();
  return (results ?? []).map((row) => deserializeRow(row, config));
}

async function upsertEntity(env: Env, table: string, body: JsonObject): Promise<JsonObject> {
  const { row, statement } = buildUpsertStatement(env, table, body);
  await statement.run();
  return deserializeRow(row, tableConfig(table));
}

async function deleteEntity(env: Env, table: string, id: string): Promise<{ ok: true }> {
  tableConfig(table);
  if (table === 'owners') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM pet_owners WHERE owner_id = ?').bind(id),
      env.DB.prepare('DELETE FROM owners WHERE id = ?').bind(id),
    ]);
  } else {
    await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  }
  return { ok: true };
}

function groupBy(rows: JsonObject[], key: string): Record<string, JsonObject[]> {
  const grouped: Record<string, JsonObject[]> = {};
  for (const row of rows) {
    const value = stringValue(row[key]);
    if (!value) continue;
    (grouped[value] ??= []).push(row);
  }
  return grouped;
}

async function getPetsFull(env: Env): Promise<JsonObject[]> {
  const pets = await listEntity(env, 'pets');
  const [historyResult, vaccineResult, imageResult, studyResult, ownerResult] = await Promise.all([
    env.DB.prepare('SELECT * FROM pet_history').all<JsonObject>(),
    env.DB.prepare('SELECT * FROM pet_vaccines').all<JsonObject>(),
    env.DB.prepare('SELECT * FROM pet_images').all<JsonObject>(),
    env.DB.prepare('SELECT * FROM pet_studies').all<JsonObject>(),
    env.DB.prepare('SELECT * FROM pet_owners').all<JsonObject>(),
  ]);

  const history = groupBy(historyResult.results ?? [], 'pet_id');
  const vaccines = groupBy(vaccineResult.results ?? [], 'pet_id');
  const images = groupBy(imageResult.results ?? [], 'pet_id');
  const studies = groupBy(studyResult.results ?? [], 'pet_id');
  const owners = groupBy(ownerResult.results ?? [], 'pet_id');

  const withoutPetId = ({ pet_id: _petId, ...row }: JsonObject): JsonObject => row;
  return pets.map((pet) => {
    const id = stringValue(pet.id);
    return {
      ...pet,
      history: (history[id] ?? []).map(withoutPetId),
      vaccines: (vaccines[id] ?? []).map(withoutPetId),
      images: (images[id] ?? []).map(withoutPetId),
      studies: (studies[id] ?? []).map(withoutPetId),
      ownerIds: (owners[id] ?? []).map((row) => stringValue(row.owner_id)).filter(Boolean),
    };
  });
}

function insertPetChildren(env: Env, id: string, body: JsonObject): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];

  for (const history of arrayOfObjects(body.history)) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO pet_history (id,pet_id,date,type,title,description,treatment,vet)
         VALUES (?,?,?,?,?,?,?,?)`,
      ).bind(
        optionalString(history.id) ?? uid(),
        id,
        stringValue(history.date),
        stringValue(history.type),
        stringValue(history.title),
        stringValue(history.description),
        stringValue(history.treatment),
        stringValue(history.vet),
      ),
    );
  }

  for (const vaccine of arrayOfObjects(body.vaccines)) {
    statements.push(
      env.DB.prepare(
        'INSERT INTO pet_vaccines (id,pet_id,name,date,nextDose) VALUES (?,?,?,?,?)',
      ).bind(
        optionalString(vaccine.id) ?? uid(),
        id,
        stringValue(vaccine.name),
        stringValue(vaccine.date),
        stringValue(vaccine.nextDose),
      ),
    );
  }

  for (const image of arrayOfObjects(body.images)) {
    statements.push(
      env.DB.prepare(
        'INSERT INTO pet_images (id,pet_id,data,caption) VALUES (?,?,?,?)',
      ).bind(
        optionalString(image.id) ?? uid(),
        id,
        stringValue(image.data),
        stringValue(image.caption),
      ),
    );
  }

  for (const study of arrayOfObjects(body.studies)) {
    statements.push(
      env.DB.prepare(
        'INSERT INTO pet_studies (id,pet_id,type,title,date,url) VALUES (?,?,?,?,?,?)',
      ).bind(
        optionalString(study.id) ?? uid(),
        id,
        stringValue(study.type),
        stringValue(study.title),
        stringValue(study.date),
        stringValue(study.url),
      ),
    );
  }

  for (const ownerId of arrayOfStrings(body.ownerIds)) {
    statements.push(
      env.DB.prepare('INSERT INTO pet_owners (pet_id,owner_id) VALUES (?,?)').bind(id, ownerId),
    );
  }

  return statements;
}

async function savePetFull(env: Env, body: JsonObject): Promise<JsonObject> {
  const { id, statement } = buildUpsertStatement(env, 'pets', body);
  const statements = [
    statement,
    env.DB.prepare('DELETE FROM pet_history WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_vaccines WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_images WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_studies WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_owners WHERE pet_id = ?').bind(id),
    ...insertPetChildren(env, id, body),
  ];
  await env.DB.batch(statements);
  return { ...body, id };
}

async function deletePetFull(env: Env, id: string): Promise<{ ok: true }> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pet_history WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_vaccines WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_images WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_studies WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM pet_owners WHERE pet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM appointments WHERE petId = ?').bind(id),
    env.DB.prepare('DELETE FROM groomingAppointments WHERE petId = ?').bind(id),
    env.DB.prepare('DELETE FROM reminders WHERE petId = ?').bind(id),
    env.DB.prepare("UPDATE invoices SET petId = '' WHERE petId = ?").bind(id),
    env.DB.prepare('DELETE FROM pets WHERE id = ?').bind(id),
  ]);
  return { ok: true };
}

async function getAppSettings(env: Env): Promise<{ clinicName: string; settings: JsonObject }> {
  const row = await env.DB.prepare(
    "SELECT clinicName, settings FROM app_settings WHERE id = 'singleton'",
  ).first<JsonObject>();
  const parsed = parseJson(row?.settings, {});
  return {
    clinicName: stringValue(row?.clinicName, 'VetCare'),
    settings: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonObject : {},
  };
}

async function saveAppSettings(env: Env, body: JsonObject): Promise<{ clinicName: string; settings: JsonObject }> {
  const clinicName = stringValue(body.clinicName, 'VetCare');
  const settings = asObject(body.settings ?? {});
  await env.DB.prepare(
    `INSERT INTO app_settings (id, clinicName, settings) VALUES ('singleton', ?, ?)
     ON CONFLICT(id) DO UPDATE SET clinicName=excluded.clinicName, settings=excluded.settings`,
  ).bind(clinicName, JSON.stringify(settings)).run();
  return { clinicName, settings };
}

async function health(env: Env): Promise<{
  status: string;
  version: string;
  database: string;
  schemaVersion: number;
}> {
  const schema = await env.DB.prepare(
    `SELECT
       (
         SELECT COUNT(*)
         FROM sqlite_master
         WHERE type = 'table'
           AND name IN (
             'users', 'sessions', 'owners', 'pets', 'pet_owners',
             'pet_history', 'pet_vaccines', 'pet_images', 'pet_studies',
             'appointments', 'groomingAppointments', 'reminders',
             'inventory', 'invoices', 'app_settings'
           )
       ) = 15
       AND (SELECT COUNT(*) FROM pragma_table_info('owners') WHERE name IN ('dni', 'notes')) = 2
       AND (
         SELECT COUNT(*)
         FROM pragma_table_info('groomingAppointments')
         WHERE name IN ('reminder', 'notes')
       ) = 2
       AND (SELECT COUNT(*) FROM pragma_table_info('inventory') WHERE name = 'lots') = 1
       AS ready`,
  ).first<{ ready: number }>();
  const ready = schema?.ready === 1;

  return {
    status: ready ? 'ok' : 'degraded',
    version: stringValue(env.APP_VERSION, 'unknown'),
    database: ready ? 'ready' : 'migrations-pending',
    schemaVersion: ready ? 2 : 0,
  };
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const path = url.pathname.replace(/\/+$/, '');

  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin, env)) return json({ error: 'Origen no permitido' }, 403, origin, env);
    return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
  }

  if (!isAllowedOrigin(origin, env)) return json({ error: 'Origen no permitido' }, 403, origin, env);

  if (path === '/api/health' && request.method === 'GET') {
    const result = await health(env);
    return json(result, result.status === 'ok' ? 200 : 503, origin, env);
  }

  if (path === '/api/register' && request.method === 'POST') {
    const body = asObject(await request.json<unknown>());
    const email = stringValue(body.email).trim().toLowerCase();
    const password = stringValue(body.password);
    const name = stringValue(body.name).trim();
    const inviteCode = stringValue(body.inviteCode);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError('Email inválido');
    if (password.length < 8) throw new HttpError('La contraseña debe tener al menos 8 caracteres');
    if (!env.INVITE_CODE || !(await secureEqual(inviteCode, env.INVITE_CODE))) {
      throw new HttpError('Clave de invitación incorrecta', 403);
    }

    const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (exists) throw new HttpError('Ese email ya está registrado', 409);

    const { hash, salt } = await hashPassword(password);
    const id = uid();
    await env.DB.prepare(
      `INSERT INTO users (id,email,name,pass_hash,pass_salt,role,created_at)
       VALUES (?,?,?,?,?,?,?)`,
    ).bind(id, email, name, hash, salt, 'staff', new Date().toISOString()).run();
    return json({ ok: true, id }, 201, origin, env);
  }

  if (path === '/api/login' && request.method === 'POST') {
    const body = asObject(await request.json<unknown>());
    const email = stringValue(body.email).trim().toLowerCase();
    const password = stringValue(body.password);
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<JsonObject>();
    if (!user) throw new HttpError('Credenciales inválidas', 401);

    const { hash } = await hashPassword(password, stringValue(user.pass_salt));
    if (!(await secureEqual(hash, stringValue(user.pass_hash)))) {
      throw new HttpError('Credenciales inválidas', 401);
    }

    const token = `${uid()}${uid().replaceAll('-', '')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await env.DB.prepare(
      'INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)',
    ).bind(token, stringValue(user.id), now.toISOString(), expiresAt.toISOString()).run();

    return json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }, 200, origin, env);
  }

  if (path === '/api/logout' && request.method === 'POST') {
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return json({ ok: true }, 200, origin, env);
  }

  const user = await getUserFromToken(env, request);
  if (!user) throw new HttpError('No autenticado', 401);

  if (path === '/api/me' && request.method === 'GET') {
    return json({ user }, 200, origin, env);
  }

  if (path === '/api/data' && request.method === 'GET') {
    const [pets, owners, appointments, groomingAppointments, reminders, inventory, invoices, appSettings] =
      await Promise.all([
        getPetsFull(env),
        listEntity(env, 'owners'),
        listEntity(env, 'appointments'),
        listEntity(env, 'groomingAppointments'),
        listEntity(env, 'reminders'),
        listEntity(env, 'inventory'),
        listEntity(env, 'invoices'),
        getAppSettings(env),
      ]);

    return json({
      pets,
      owners,
      appointments,
      groomingAppointments,
      reminders,
      inventory,
      invoices,
      ...appSettings,
    }, 200, origin, env);
  }

  if (path === '/api/settings') {
    if (request.method === 'GET') return json(await getAppSettings(env), 200, origin, env);
    if (request.method === 'POST' || request.method === 'PUT') {
      return json(await saveAppSettings(env, asObject(await request.json<unknown>())), 200, origin, env);
    }
  }

  const match = path.match(/^\/api\/([a-zA-Z]+)(?:\/([^/]+))?$/);
  if (match) {
    const [, table, id] = match;
    if (table === 'pets') {
      if (request.method === 'GET') return json(await getPetsFull(env), 200, origin, env);
      if (request.method === 'POST' || request.method === 'PUT') {
        return json(await savePetFull(env, asObject(await request.json<unknown>())), 200, origin, env);
      }
      if (request.method === 'DELETE' && id) return json(await deletePetFull(env, id), 200, origin, env);
    } else if (Object.hasOwn(TABLES, table)) {
      if (request.method === 'GET') return json(await listEntity(env, table), 200, origin, env);
      if (request.method === 'POST' || request.method === 'PUT') {
        return json(await upsertEntity(env, table, asObject(await request.json<unknown>())), 200, origin, env);
      }
      if (request.method === 'DELETE' && id) return json(await deleteEntity(env, table, id), 200, origin, env);
    }
  }

  throw new HttpError('Ruta no encontrada', 404);
}

export default {
  async fetch(request, env): Promise<Response> {
    const requestId = uid();
    const origin = request.headers.get('Origin');
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const isHttpError = error instanceof HttpError;
      const status = isHttpError ? error.status : 500;
      const message = isHttpError ? error.message : 'Error del servidor';

      if (!isHttpError || status >= 500) {
        console.error(JSON.stringify({
          message: 'request_failed',
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          error: error instanceof Error ? error.message : String(error),
        }));
      }

      return json({ error: message, requestId }, status, origin, env);
    }
  },
} satisfies ExportedHandler<Env>;
