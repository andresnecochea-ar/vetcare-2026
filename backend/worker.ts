// VetCare API — Cloudflare Worker + D1.

type JsonObject = Record<string, unknown>;
type DbValue = string | number | null | ArrayBuffer;
type UserRole = 'admin' | 'veterinarian' | 'reception';

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

const USER_ROLES = new Set<UserRole>(['admin', 'veterinarian', 'reception']);
const VETERINARIAN_WRITE = new Set([
  'owners', 'pets', 'appointments', 'groomingAppointments', 'reminders',
  'inventory', 'invoices',
]);
const RECEPTION_WRITE = new Set([
  'owners', 'pets', 'appointments', 'groomingAppointments', 'reminders', 'invoices',
]);
const OPERATIONAL_DELETE = new Set(['appointments', 'groomingAppointments', 'reminders']);
const RECEPTION_CLINICAL_FIELDS = [
  'weight', 'allergies', 'chronicConditions', 'notes',
  'history', 'vaccines', 'images', 'studies',
] as const;

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

function revisionValue(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function userRole(user: JsonObject): UserRole {
  const role = stringValue(user.role) as UserRole;
  return USER_ROLES.has(role) ? role : 'reception';
}

function requireAdmin(user: JsonObject): void {
  if (userRole(user) !== 'admin') throw new HttpError('Acceso reservado a administradores', 403);
}

function requireMutationPermission(
  user: JsonObject,
  entity: string,
  action: 'write' | 'delete',
): void {
  const role = userRole(user);
  if (role === 'admin') return;
  if (action === 'delete') {
    if (OPERATIONAL_DELETE.has(entity)) return;
    throw new HttpError('Tu rol no permite eliminar este registro', 403);
  }
  const allowed = role === 'veterinarian' ? VETERINARIAN_WRITE : RECEPTION_WRITE;
  if (!allowed.has(entity)) throw new HttpError('Tu rol no permite modificar este módulo', 403);
}

function comparableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function ensureReceptionPetUpdateAllowed(env: Env, body: JsonObject): Promise<void> {
  const id = optionalString(body.id);
  const existing = id
    ? (await getPetsFull(env)).find((pet) => pet.id === id)
    : undefined;
  for (const field of RECEPTION_CLINICAL_FIELDS) {
    if (!Object.hasOwn(body, field)) continue;
    const nextValue = body[field];
    const previousValue = existing?.[field];
    const emptyNewValue = nextValue === null
      || nextValue === undefined
      || nextValue === ''
      || (Array.isArray(nextValue) && nextValue.length === 0);
    if (!existing && emptyNewValue) continue;
    if (existing && comparableJson(nextValue) === comparableJson(previousValue)) continue;
    throw new HttpError('Recepción no puede modificar información clínica', 403);
  }
}

function auditFields(body: JsonObject): string[] {
  const ignored = new Set(['id', 'revision', 'syncToken', 'vitals']);
  return Object.keys(body).filter((field) => !ignored.has(field)).sort();
}

async function writeAudit(
  env: Env,
  user: JsonObject,
  action: string,
  entityType: string,
  entityId: string,
  fields: string[] = [],
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_log (
       id,user_id,user_email,user_name,action,entity_type,entity_id,fields,created_at
     ) VALUES (?,?,?,?,?,?,?,?,?)`,
  ).bind(
    uid(),
    stringValue(user.id),
    stringValue(user.email),
    stringValue(user.name),
    action,
    entityType,
    entityId,
    JSON.stringify([...new Set(fields)]),
    new Date().toISOString(),
  ).run();
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

async function listUsers(env: Env): Promise<JsonObject[]> {
  const { results } = await env.DB.prepare(
    'SELECT id,email,name,role,created_at FROM users ORDER BY name,email',
  ).all<JsonObject>();
  return results ?? [];
}

async function changeUserRole(
  env: Env,
  actor: JsonObject,
  targetId: string,
  body: JsonObject,
): Promise<JsonObject> {
  requireAdmin(actor);
  const role = stringValue(body.role) as UserRole;
  if (!USER_ROLES.has(role)) throw new HttpError('Rol inválido');
  const target = await env.DB.prepare(
    'SELECT id,email,name,role,created_at FROM users WHERE id = ?',
  ).bind(targetId).first<JsonObject>();
  if (!target) throw new HttpError('Usuario no encontrado', 404);
  if (stringValue(target.role) === 'admin' && role !== 'admin') {
    const admins = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM users WHERE role = 'admin'",
    ).first<{ total: number }>();
    if ((admins?.total ?? 0) <= 1) {
      throw new HttpError('Debe quedar al menos un administrador', 409);
    }
  }
  await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, targetId).run();
  await writeAudit(env, actor, 'role_change', 'users', targetId, ['role']);
  return { ...target, role };
}

async function listAudit(env: Env, limit: number): Promise<JsonObject[]> {
  const { results } = await env.DB.prepare(
    `SELECT id,user_id,user_email,user_name,action,entity_type,entity_id,fields,created_at
     FROM audit_log
     ORDER BY created_at DESC
     LIMIT ?`,
  ).bind(limit).all<JsonObject>();
  return (results ?? []).map((row) => ({
    ...row,
    fields: parseJson(row.fields, []),
  }));
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
      env.DB.prepare("UPDATE invoices SET ownerId = '' WHERE ownerId = ?").bind(id),
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
    const { syncToken: _syncToken, ...publicPet } = pet;
    const id = stringValue(publicPet.id);
    return {
      ...publicPet,
      history: (history[id] ?? []).map(withoutPetId),
      vaccines: (vaccines[id] ?? []).map(withoutPetId),
      images: (images[id] ?? []).map(withoutPetId),
      studies: (studies[id] ?? []).map(withoutPetId),
      ownerIds: (owners[id] ?? []).map((row) => stringValue(row.owner_id)).filter(Boolean),
    };
  });
}

type PetChildConfig = {
  bodyKey: string;
  table: string;
  columns: readonly string[];
};

const PET_CHILDREN: readonly PetChildConfig[] = [
  {
    bodyKey: 'history',
    table: 'pet_history',
    columns: [
      'date', 'type', 'title', 'description', 'treatment', 'vet',
      'weight', 'temp', 'hr', 'exam', 'diagnosis', 'nextControl',
    ],
  },
  {
    bodyKey: 'vaccines',
    table: 'pet_vaccines',
    columns: ['name', 'date', 'nextDose'],
  },
  {
    bodyKey: 'images',
    table: 'pet_images',
    columns: ['data', 'caption'],
  },
  {
    bodyKey: 'studies',
    table: 'pet_studies',
    columns: ['type', 'title', 'date', 'url'],
  },
];

function gatedPetChildren(
  env: Env,
  petId: string,
  syncToken: string,
  body: JsonObject,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];

  for (const config of PET_CHILDREN) {
    const rows = arrayOfObjects(body[config.bodyKey]);
    const ids: string[] = [];
    const dbColumns = ['id', 'pet_id', ...config.columns];
    const placeholders = dbColumns.map(() => '?').join(',');
    const updates = dbColumns
      .filter((column) => column !== 'id')
      .map((column) => `${column}=excluded.${column}`)
      .join(',');

    for (const row of rows) {
      const rowId = optionalString(row.id) ?? uid();
      ids.push(rowId);
      const values = [rowId, petId, ...config.columns.map((column) => stringValue(row[column]))];
      statements.push(
        env.DB.prepare(
          `INSERT INTO ${config.table} (${dbColumns.join(',')})
           SELECT ${placeholders}
           WHERE EXISTS (SELECT 1 FROM pets WHERE id = ? AND syncToken = ?)
           ON CONFLICT(id) DO UPDATE SET ${updates}`,
        ).bind(...values, petId, syncToken),
      );
    }

    const omittedIds = ids.length ? `AND id NOT IN (${ids.map(() => '?').join(',')})` : '';
    statements.push(
      env.DB.prepare(
        `DELETE FROM ${config.table}
         WHERE pet_id = ? ${omittedIds}
           AND EXISTS (SELECT 1 FROM pets WHERE id = ? AND syncToken = ?)`,
      ).bind(petId, ...ids, petId, syncToken),
    );
  }

  const ownerIds = arrayOfStrings(body.ownerIds);
  for (const ownerId of ownerIds) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO pet_owners (pet_id,owner_id)
         SELECT ?,?
         WHERE EXISTS (SELECT 1 FROM pets WHERE id = ? AND syncToken = ?)
         ON CONFLICT(pet_id,owner_id) DO NOTHING`,
      ).bind(petId, ownerId, petId, syncToken),
    );
  }
  const omittedOwnerIds = ownerIds.length
    ? `AND owner_id NOT IN (${ownerIds.map(() => '?').join(',')})`
    : '';
  statements.push(
    env.DB.prepare(
      `DELETE FROM pet_owners
       WHERE pet_id = ? ${omittedOwnerIds}
         AND EXISTS (SELECT 1 FROM pets WHERE id = ? AND syncToken = ?)`,
    ).bind(petId, ...ownerIds, petId, syncToken),
  );

  return statements;
}

async function savePetFull(env: Env, body: JsonObject): Promise<JsonObject> {
  const config = tableConfig('pets');
  const id = optionalString(body.id) ?? uid();
  const row: JsonObject = { ...body, id };
  const fields = config.columns.filter((column) => Object.hasOwn(row, column));
  const placeholders = fields.map(() => '?').join(',');
  const updates = [
    ...fields
      .filter((field) => field !== 'id')
      .map((field) => `${field}=excluded.${field}`),
    'revision=pets.revision+1',
    'syncToken=excluded.syncToken',
  ].join(',');
  const expectedRevision = revisionValue(body.revision);
  const syncToken = uid();
  const parentStatement = env.DB.prepare(
    `INSERT INTO pets (${fields.join(',')},revision,syncToken)
     VALUES (${placeholders},1,?)
     ON CONFLICT(id) DO UPDATE SET ${updates}
     WHERE pets.revision = ?`,
  ).bind(...fields.map((field) => serializeValue(row[field])), syncToken, expectedRevision);
  const statements = [
    parentStatement,
    ...gatedPetChildren(env, id, syncToken, body),
  ];
  const results = await env.DB.batch(statements);
  if (results[0]?.meta.changes !== 1) {
    throw new HttpError(
      'La ficha fue modificada en otro equipo. Recargá los datos antes de volver a guardar.',
      409,
    );
  }
  return { ...body, id, revision: expectedRevision + 1 };
}

async function deletePetFull(
  env: Env,
  id: string,
  expectedRevision: number,
): Promise<{ ok: true }> {
  const gatedDelete = (table: string, foreignKey: string): D1PreparedStatement =>
    env.DB.prepare(
      `DELETE FROM ${table}
       WHERE ${foreignKey} = ?
         AND EXISTS (SELECT 1 FROM pets WHERE id = ? AND revision = ?)`,
    ).bind(id, id, expectedRevision);
  const results = await env.DB.batch([
    gatedDelete('pet_history', 'pet_id'),
    gatedDelete('pet_vaccines', 'pet_id'),
    gatedDelete('pet_images', 'pet_id'),
    gatedDelete('pet_studies', 'pet_id'),
    gatedDelete('pet_owners', 'pet_id'),
    gatedDelete('appointments', 'petId'),
    gatedDelete('groomingAppointments', 'petId'),
    gatedDelete('reminders', 'petId'),
    env.DB.prepare(
      `UPDATE invoices SET petId = ''
       WHERE petId = ?
         AND EXISTS (SELECT 1 FROM pets WHERE id = ? AND revision = ?)`,
    ).bind(id, id, expectedRevision),
    env.DB.prepare('DELETE FROM pets WHERE id = ? AND revision = ?').bind(id, expectedRevision),
  ]);
  if (results.at(-1)?.meta.changes !== 1) {
    throw new HttpError(
      'La ficha fue modificada en otro equipo. Recargá los datos antes de eliminarla.',
      409,
    );
  }
  return { ok: true };
}

async function allocateInvoiceNumber(env: Env): Promise<string> {
  const sequence = await env.DB.prepare(
    `UPDATE invoice_sequence
     SET lastNumber = lastNumber + 1
     WHERE id = 'singleton'
     RETURNING lastNumber`,
  ).first<{ lastNumber: number }>();
  const value = sequence?.lastNumber;
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error('No se pudo asignar el número de comprobante');
  }
  return String(value).padStart(4, '0');
}

async function validateInvoiceRelations(env: Env, row: JsonObject): Promise<void> {
  const ownerId = stringValue(row.ownerId);
  const petId = stringValue(row.petId);
  const [owner, pet] = await Promise.all([
    ownerId
      ? env.DB.prepare('SELECT id FROM owners WHERE id = ?').bind(ownerId).first()
      : Promise.resolve(null),
    petId
      ? env.DB.prepare('SELECT id FROM pets WHERE id = ?').bind(petId).first()
      : Promise.resolve(null),
  ]);
  if (ownerId && !owner) throw new HttpError('El tutor seleccionado no existe');
  if (petId && !pet) throw new HttpError('El paciente seleccionado no existe');
  if (ownerId && petId) {
    const association = await env.DB.prepare(
      'SELECT 1 AS linked FROM pet_owners WHERE owner_id = ? AND pet_id = ?',
    ).bind(ownerId, petId).first();
    if (!association) {
      throw new HttpError('El paciente no está asociado al tutor seleccionado');
    }
  }
}

async function saveInvoice(env: Env, body: JsonObject): Promise<JsonObject> {
  const id = optionalString(body.id) ?? uid();
  const existing = await env.DB.prepare(
    'SELECT * FROM invoices WHERE id = ?',
  ).bind(id).first<JsonObject>();
  const row: JsonObject = { ...(existing ?? {}), ...body, id };
  await validateInvoiceRelations(env, row);
  row.number = stringValue(existing?.number) || await allocateInvoiceNumber(env);
  const config = tableConfig('invoices');
  const fields = config.columns.filter((column) => Object.hasOwn(row, column));
  const placeholders = fields.map(() => '?').join(',');
  const updates = [
    ...fields
      .filter((field) => field !== 'id' && field !== 'number')
      .map((field) => `${field}=excluded.${field}`),
    "number=CASE WHEN invoices.number='' THEN excluded.number ELSE invoices.number END",
  ].join(',');
  await env.DB.prepare(
    `INSERT INTO invoices (${fields.join(',')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`,
  ).bind(...fields.map((field) => serializeValue(row[field]))).run();

  const stored = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?')
    .bind(id)
    .first<JsonObject>();
  if (!stored) throw new Error('No se pudo guardar el comprobante');
  return deserializeRow(stored, config);
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
             'inventory', 'invoices', 'app_settings', 'invoice_sequence',
             'audit_log'
           )
       ) = 17
       AND (SELECT COUNT(*) FROM pragma_table_info('owners') WHERE name IN ('dni', 'notes')) = 2
       AND (
         SELECT COUNT(*)
         FROM pragma_table_info('groomingAppointments')
         WHERE name IN ('reminder', 'notes')
       ) = 2
       AND (SELECT COUNT(*) FROM pragma_table_info('inventory') WHERE name = 'lots') = 1
       AND (
         SELECT COUNT(*)
         FROM pragma_table_info('pet_history')
         WHERE name IN ('weight', 'temp', 'hr', 'exam', 'diagnosis', 'nextControl')
       ) = 6
       AND (
         SELECT COUNT(*)
         FROM pragma_table_info('pets')
         WHERE name IN ('revision', 'syncToken')
       ) = 2
       AND (
         SELECT COUNT(*)
         FROM pragma_table_info('audit_log')
         WHERE name IN (
           'user_id', 'user_email', 'user_name', 'action',
           'entity_type', 'entity_id', 'fields', 'created_at'
         )
       ) = 8
       AS ready`,
  ).first<{ ready: number }>();
  const ready = schema?.ready === 1;

  return {
    status: ready ? 'ok' : 'degraded',
    version: stringValue(env.APP_VERSION, 'unknown'),
    database: ready ? 'ready' : 'migrations-pending',
    schemaVersion: ready ? 6 : 0,
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
    const userCount = await env.DB.prepare('SELECT COUNT(*) AS total FROM users')
      .first<{ total: number }>();
    const role: UserRole = (userCount?.total ?? 0) === 0 ? 'admin' : 'reception';
    const id = uid();
    await env.DB.prepare(
      `INSERT INTO users (id,email,name,pass_hash,pass_salt,role,created_at)
       VALUES (?,?,?,?,?,?,?)`,
    ).bind(id, email, name, hash, salt, role, new Date().toISOString()).run();
    const registeredUser = { id, email, name, role };
    await writeAudit(env, registeredUser, 'register', 'users', id, ['email', 'name', 'role']);
    return json({ ok: true, id, role }, 201, origin, env);
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
    await writeAudit(env, user, 'login', 'sessions', stringValue(user.id));

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

  if (path === '/api/users' && request.method === 'GET') {
    requireAdmin(user);
    return json({ users: await listUsers(env) }, 200, origin, env);
  }

  const userRoleMatch = path.match(/^\/api\/users\/([^/]+)\/role$/);
  if (userRoleMatch && (request.method === 'PUT' || request.method === 'POST')) {
    return json(
      await changeUserRole(env, user, userRoleMatch[1], asObject(await request.json<unknown>())),
      200,
      origin,
      env,
    );
  }

  if (path === '/api/audit' && request.method === 'GET') {
    requireAdmin(user);
    const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 200)
      : 100;
    return json({ entries: await listAudit(env, limit) }, 200, origin, env);
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
      requireAdmin(user);
      const body = asObject(await request.json<unknown>());
      const result = await saveAppSettings(env, body);
      await writeAudit(env, user, 'update', 'settings', 'singleton', auditFields(body));
      return json(result, 200, origin, env);
    }
  }

  const match = path.match(/^\/api\/([a-zA-Z]+)(?:\/([^/]+))?$/);
  if (match) {
    const [, table, id] = match;
    if (table === 'pets') {
      if (request.method === 'GET') return json(await getPetsFull(env), 200, origin, env);
      if (request.method === 'POST' || request.method === 'PUT') {
        requireMutationPermission(user, 'pets', 'write');
        const body = asObject(await request.json<unknown>());
        if (userRole(user) === 'reception') await ensureReceptionPetUpdateAllowed(env, body);
        const existed = optionalString(body.id)
          ? await env.DB.prepare('SELECT id FROM pets WHERE id = ?').bind(body.id).first()
          : null;
        const result = await savePetFull(env, body);
        await writeAudit(
          env,
          user,
          existed ? 'update' : 'create',
          'pets',
          stringValue(result.id),
          auditFields(body),
        );
        return json(result, 200, origin, env);
      }
      if (request.method === 'DELETE' && id) {
        requireMutationPermission(user, 'pets', 'delete');
        const deleteBody = asObject(await request.json<unknown>().catch(() => ({})));
        const result = await deletePetFull(env, id, revisionValue(deleteBody.revision));
        await writeAudit(env, user, 'delete', 'pets', id);
        return json(result, 200, origin, env);
      }
    } else if (Object.hasOwn(TABLES, table)) {
      if (request.method === 'GET') return json(await listEntity(env, table), 200, origin, env);
      if (request.method === 'POST' || request.method === 'PUT') {
        requireMutationPermission(user, table, 'write');
        const body = asObject(await request.json<unknown>());
        const existed = optionalString(body.id)
          ? await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(body.id).first()
          : null;
        const result = table === 'invoices'
          ? await saveInvoice(env, body)
          : await upsertEntity(env, table, body);
        await writeAudit(
          env,
          user,
          existed ? 'update' : 'create',
          table,
          stringValue(result.id),
          auditFields(body),
        );
        return json(result, 200, origin, env);
      }
      if (request.method === 'DELETE' && id) {
        requireMutationPermission(user, table, 'delete');
        const result = await deleteEntity(env, table, id);
        await writeAudit(env, user, 'delete', table, id);
        return json(result, 200, origin, env);
      }
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
