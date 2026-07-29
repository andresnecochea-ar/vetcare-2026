import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import '../../js/finance.js';
import '../../js/sync-state.js';

const API_ORIGIN = 'https://vetcare-api.test';

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return exports.default.fetch(new Request(`${API_ORIGIN}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }));
}

async function jsonResponse(path, options) {
  const response = await request(path, options);
  return { response, body: await response.json() };
}

describe('VetCare Worker', () => {
  it('describe estados de sincronización y reintentos sin ocultar conflictos', () => {
    expect(globalThis.VetCareSync.retryDelay(0)).toBe(3000);
    expect(globalThis.VetCareSync.retryDelay(1)).toBe(10000);
    expect(globalThis.VetCareSync.retryDelay(8)).toBe(30000);
    expect(globalThis.VetCareSync.isRetryableStatus(0)).toBe(true);
    expect(globalThis.VetCareSync.isRetryableStatus(429)).toBe(true);
    expect(globalThis.VetCareSync.isRetryableStatus(503)).toBe(true);
    expect(globalThis.VetCareSync.isRetryableStatus(403)).toBe(false);

    expect(globalThis.VetCareSync.view('offline')).toMatchObject({
      label: 'Sin conexión',
      retryable: true,
    });
    expect(globalThis.VetCareSync.view('error', {
      context: { table: 'invoices', operation: 'update' },
      retryDelayMs: 10000,
    }).detail).toContain('Reintento automático en 10 s');

    const conflict = globalThis.VetCareSync.view('conflict', {
      context: { table: 'pets', operation: 'update' },
    });
    expect(conflict).toMatchObject({ label: 'Conflicto', retryable: false });
    expect(conflict.detail).toContain('paciente');
  });

  it('calcula cobrado y pendiente sin incluir comprobantes cancelados', () => {
    const summary = globalThis.VetCareFinance.summarize([
      { status: 'paid', total: 15000 },
      { status: 'pending', total: '7000' },
      { status: 'cancelled', total: 30000 },
      { status: 'paid', total: '2500.50' },
    ]);
    expect(summary).toEqual({
      paidTotal: 17500.5,
      pendingTotal: 7000,
      paidCount: 2,
      invoiceCount: 4,
    });
  });

  it('expone un health check que valida las migraciones', async () => {
    const { response, body } = await jsonResponse('/api/health');
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      database: 'ready',
      version: '2.3.0',
      schemaVersion: 6,
    });
  });

  it('acepta localhost con cualquier puerto y bloquea otros orígenes', async () => {
    const local = await request('/api/me', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:8765',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(local.status).toBe(204);
    expect(local.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:8765');

    const disallowed = await request('/api/me', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.invalid',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(disallowed.status).toBe(403);
    expect(disallowed.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('conserva todos los campos del frontend al guardar y volver a leer', async () => {
    const email = `test-${crypto.randomUUID()}@example.com`;
    const password = 'una-clave-segura';

    const registration = await jsonResponse('/api/register', {
      method: 'POST',
      body: { email, password, name: 'Veterinaria Test', inviteCode: 'test-invite-code' },
    });
    expect(registration.response.status).toBe(201);

    const login = await jsonResponse('/api/login', {
      method: 'POST',
      body: { email, password },
    });
    expect(login.response.status).toBe(200);
    expect(login.body.user.role).toBe('admin');
    const authorization = `Bearer ${login.body.token}`;
    const authenticated = { Authorization: authorization };

    const owner = {
      id: crypto.randomUUID(),
      name: 'Ana Pérez',
      phone: '2262123456',
      email: 'ana@example.com',
      address: 'Calle 1',
      relationship: 'Tutora',
      dni: '30111222',
      notes: 'Prefiere WhatsApp',
    };
    expect((await request('/api/owners', { method: 'POST', headers: authenticated, body: owner })).status).toBe(200);

    const pet = {
      id: crypto.randomUUID(),
      name: 'Luna',
      species: 'Perro',
      ownerIds: [owner.id],
      history: [{
        id: crypto.randomUUID(),
        date: '2026-07-01',
        title: 'Control',
        type: 'Consulta',
        description: 'Paciente activo',
        treatment: 'Continuar tratamiento',
        vet: 'Dra. Test',
        weight: '28.4',
        temp: '38.6',
        hr: '92',
        exam: 'Mucosas rosadas, abdomen blando',
        diagnosis: 'Paciente clínicamente estable',
        nextControl: '2026-08-01',
      }],
      vaccines: [{ id: crypto.randomUUID(), name: 'Antirrábica', date: '2026-07-02', nextDose: '2027-07-02' }],
      images: [{ id: crypto.randomUUID(), data: 'data:image/png;base64,dGVzdA==', caption: 'Foto' }],
      studies: [{
        id: crypto.randomUUID(),
        type: 'Ecografía',
        title: 'Control abdominal',
        date: '2026-07-03',
        url: 'https://drive.google.com/example',
      }],
    };
    const savedPet = await jsonResponse('/api/pets', {
      method: 'POST',
      headers: authenticated,
      body: pet,
    });
    expect(savedPet.response.status).toBe(200);
    expect(savedPet.body.revision).toBe(1);

    const grooming = {
      id: crypto.randomUUID(),
      petId: pet.id,
      date: '2026-08-01',
      time: '10:00',
      service: 'Baño',
      groomer: 'Pablo',
      price: '5000',
      status: 'Pendiente',
      reminder: '24h',
      notes: 'Usar shampoo hipoalergénico',
    };
    expect((await request('/api/groomingAppointments', {
      method: 'POST',
      headers: authenticated,
      body: grooming,
    })).status).toBe(200);

    const inventory = {
      id: crypto.randomUUID(),
      name: 'Vacuna',
      category: 'Farmacia',
      minStock: '2',
      price: '1000',
      notes: 'Refrigerada',
      lots: [{ id: crypto.randomUUID(), qty: 5, expiry: '2027-01-01' }],
    };
    expect((await request('/api/inventory', {
      method: 'POST',
      headers: authenticated,
      body: inventory,
    })).status).toBe(200);

    const invoice = {
      id: crypto.randomUUID(),
      date: '2026-07-28',
      ownerId: owner.id,
      petId: pet.id,
      items: [{ desc: 'Consulta', qty: 1, price: 15000 }],
      total: 15000,
      status: 'paid',
      notes: 'Pagado en efectivo',
    };
    const savedInvoice = await jsonResponse('/api/invoices', {
      method: 'POST',
      headers: authenticated,
      body: invoice,
    });
    expect(savedInvoice.response.status).toBe(200);
    expect(savedInvoice.body.number).toBe('0001');

    const unrelatedOwner = {
      id: crypto.randomUUID(),
      name: 'Tutor no asociado',
      phone: '2262000000',
    };
    expect((await request('/api/owners', {
      method: 'POST',
      headers: authenticated,
      body: unrelatedOwner,
    })).status).toBe(200);
    const invalidRelation = await jsonResponse('/api/invoices', {
      method: 'POST',
      headers: authenticated,
      body: {
        id: crypto.randomUUID(),
        ownerId: unrelatedOwner.id,
        petId: pet.id,
        date: '2026-07-28',
        items: [{ desc: 'Consulta inválida', qty: 1, price: 1000 }],
        total: 1000,
        status: 'paid',
      },
    });
    expect(invalidRelation.response.status).toBe(400);
    expect(invalidRelation.body.error).toContain('no está asociado');

    expect((await request('/api/settings', {
      method: 'POST',
      headers: authenticated,
      body: {
        clinicName: 'VetCare Test',
        settings: { theme: 'dark', receiptTaxId: '20-12345678-9' },
      },
    })).status).toBe(200);

    const snapshot = await jsonResponse('/api/data', { headers: authenticated });
    expect(snapshot.response.status).toBe(200);

    expect(snapshot.body.owners[0]).toMatchObject({ dni: owner.dni, notes: owner.notes });
    expect(snapshot.body.pets[0].history).toEqual(pet.history);
    expect(snapshot.body.pets[0].studies).toEqual(pet.studies);
    expect(snapshot.body.pets[0].ownerIds).toEqual([owner.id]);
    expect(snapshot.body.groomingAppointments[0]).toMatchObject({
      reminder: grooming.reminder,
      notes: grooming.notes,
    });
    expect(snapshot.body.inventory[0].lots).toEqual(inventory.lots);
    expect(snapshot.body.invoices[0].items).toEqual(invoice.items);
    expect(snapshot.body).toMatchObject({
      clinicName: 'VetCare Test',
      settings: { theme: 'dark', receiptTaxId: '20-12345678-9' },
    });

    const databaseInvoice = await env.DB.prepare('SELECT items FROM invoices WHERE id = ?')
      .bind(invoice.id)
      .first();
    expect(typeof databaseInvoice.items).toBe('string');

    const databaseHistory = await env.DB.prepare(
      'SELECT weight, temp, hr, exam, diagnosis, nextControl FROM pet_history WHERE id = ?',
    ).bind(pet.history[0].id).first();
    expect(databaseHistory).toMatchObject({
      weight: '28.4',
      temp: '38.6',
      hr: '92',
      exam: 'Mucosas rosadas, abdomen blando',
      diagnosis: 'Paciente clínicamente estable',
      nextControl: '2026-08-01',
    });

    const firstEditor = structuredClone(snapshot.body.pets[0]);
    const staleEditor = structuredClone(snapshot.body.pets[0]);
    firstEditor.history[0].diagnosis = 'Actualizado por el primer equipo';
    const firstUpdate = await jsonResponse('/api/pets', {
      method: 'POST',
      headers: authenticated,
      body: firstEditor,
    });
    expect(firstUpdate.response.status).toBe(200);
    expect(firstUpdate.body.revision).toBe(2);

    staleEditor.history[0].diagnosis = 'Cambio basado en una ficha desactualizada';
    const staleUpdate = await jsonResponse('/api/pets', {
      method: 'POST',
      headers: authenticated,
      body: staleEditor,
    });
    expect(staleUpdate.response.status).toBe(409);
    expect(staleUpdate.body.error).toContain('modificada en otro equipo');

    const staleDelete = await jsonResponse(`/api/pets/${pet.id}`, {
      method: 'DELETE',
      headers: authenticated,
      body: { revision: staleEditor.revision },
    });
    expect(staleDelete.response.status).toBe(409);
    expect(staleDelete.body.error).toContain('antes de eliminarla');

    const afterConflict = await jsonResponse('/api/data', { headers: authenticated });
    const protectedPet = afterConflict.body.pets.find((item) => item.id === pet.id);
    expect(protectedPet.revision).toBe(2);
    expect(protectedPet.history[0].diagnosis).toBe('Actualizado por el primer equipo');

    const concurrentInvoices = await Promise.all(
      ['Consulta A', 'Consulta B'].map((description) => jsonResponse('/api/invoices', {
        method: 'POST',
        headers: authenticated,
        body: {
          id: crypto.randomUUID(),
          number: '0001',
          date: '2026-07-28',
          items: [{ desc: description, qty: 1, price: 1000 }],
          total: 1000,
          status: 'paid',
        },
      })),
    );
    expect(concurrentInvoices.every(({ response }) => response.status === 200)).toBe(true);
    expect(concurrentInvoices.map(({ body }) => body.number).sort()).toEqual(['0002', '0003']);

    expect((await request(`/api/invoices/${concurrentInvoices[0].body.id}`, {
      method: 'DELETE',
      headers: authenticated,
    })).status).toBe(200);
    const afterDelete = await jsonResponse('/api/invoices', {
      method: 'POST',
      headers: authenticated,
      body: {
        id: crypto.randomUUID(),
        date: '2026-07-28',
        items: [{ desc: 'Control', qty: 1, price: 1000 }],
        total: 1000,
        status: 'pending',
      },
    });
    expect(afterDelete.response.status).toBe(200);
    expect(afterDelete.body.number).toBe('0004');

    const ownerOnlyInvoice = await jsonResponse('/api/invoices', {
      method: 'POST',
      headers: authenticated,
      body: {
        id: crypto.randomUUID(),
        ownerId: unrelatedOwner.id,
        petId: '',
        date: '2026-07-28',
        items: [{ desc: 'Venta mostrador', qty: 1, price: 500 }],
        total: 500,
        status: 'paid',
      },
    });
    expect(ownerOnlyInvoice.response.status).toBe(200);
    expect(ownerOnlyInvoice.body.number).toBe('0005');
    expect((await request(`/api/owners/${unrelatedOwner.id}`, {
      method: 'DELETE',
      headers: authenticated,
    })).status).toBe(200);
    const invoiceAfterOwnerDelete = await env.DB.prepare(
      'SELECT ownerId FROM invoices WHERE id = ?',
    ).bind(ownerOnlyInvoice.body.id).first();
    expect(invoiceAfterOwnerDelete.ownerId).toBe('');

    const receptionEmail = `recepcion-${crypto.randomUUID()}@example.com`;
    const receptionPassword = 'otra-clave-segura';
    const receptionRegistration = await jsonResponse('/api/register', {
      method: 'POST',
      body: {
        email: receptionEmail,
        password: receptionPassword,
        name: 'Recepción Test',
        inviteCode: 'test-invite-code',
      },
    });
    expect(receptionRegistration.response.status).toBe(201);
    expect(receptionRegistration.body.role).toBe('reception');

    const receptionLogin = await jsonResponse('/api/login', {
      method: 'POST',
      body: { email: receptionEmail, password: receptionPassword },
    });
    const receptionAuth = { Authorization: `Bearer ${receptionLogin.body.token}` };
    expect(receptionLogin.body.user.role).toBe('reception');

    expect((await request('/api/audit', { headers: receptionAuth })).status).toBe(403);
    expect((await request('/api/settings', {
      method: 'POST',
      headers: receptionAuth,
      body: { clinicName: 'No autorizado', settings: {} },
    })).status).toBe(403);
    expect((await request('/api/inventory', {
      method: 'POST',
      headers: receptionAuth,
      body: { id: crypto.randomUUID(), name: 'No autorizado', lots: [] },
    })).status).toBe(403);

    const receptionOwner = { id: crypto.randomUUID(), name: 'Tutor Recepción' };
    expect((await request('/api/owners', {
      method: 'POST',
      headers: receptionAuth,
      body: receptionOwner,
    })).status).toBe(200);
    expect((await request(`/api/owners/${receptionOwner.id}`, {
      method: 'DELETE',
      headers: receptionAuth,
    })).status).toBe(403);

    const receptionPet = {
      id: crypto.randomUUID(),
      name: 'Paciente Recepción',
      species: 'Gato',
      ownerIds: [receptionOwner.id],
    };
    const receptionPetCreate = await jsonResponse('/api/pets', {
      method: 'POST',
      headers: receptionAuth,
      body: receptionPet,
    });
    expect(receptionPetCreate.response.status).toBe(200);
    expect(receptionPetCreate.body.revision).toBe(1);

    const forbiddenClinicalUpdate = await jsonResponse('/api/pets', {
      method: 'POST',
      headers: receptionAuth,
      body: {
        ...receptionPet,
        revision: 1,
        history: [{
          id: crypto.randomUUID(),
          date: '2026-07-28',
          title: 'Dato clínico secreto',
          diagnosis: 'No debe aparecer en auditoría',
        }],
      },
    });
    expect(forbiddenClinicalUpdate.response.status).toBe(403);
    expect(forbiddenClinicalUpdate.body.error).toContain('información clínica');

    const users = await jsonResponse('/api/users', { headers: authenticated });
    expect(users.response.status).toBe(200);
    expect(users.body.users).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: receptionRegistration.body.id, role: 'reception' }),
    ]));

    const promoted = await jsonResponse(`/api/users/${receptionRegistration.body.id}/role`, {
      method: 'PUT',
      headers: authenticated,
      body: { role: 'veterinarian' },
    });
    expect(promoted.response.status).toBe(200);
    expect(promoted.body.role).toBe('veterinarian');

    const veterinarianUpdate = await jsonResponse('/api/pets', {
      method: 'POST',
      headers: receptionAuth,
      body: {
        ...receptionPet,
        revision: 1,
        history: [{
          id: crypto.randomUUID(),
          date: '2026-07-28',
          title: 'Control veterinario',
          diagnosis: 'Paciente estable',
        }],
      },
    });
    expect(veterinarianUpdate.response.status).toBe(200);
    expect(veterinarianUpdate.body.revision).toBe(2);

    const lastAdminDemotion = await jsonResponse(`/api/users/${login.body.user.id}/role`, {
      method: 'PUT',
      headers: authenticated,
      body: { role: 'reception' },
    });
    expect(lastAdminDemotion.response.status).toBe(409);
    expect(lastAdminDemotion.body.error).toContain('al menos un administrador');

    const audit = await jsonResponse('/api/audit?limit=200', { headers: authenticated });
    expect(audit.response.status).toBe(200);
    expect(audit.body.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'role_change',
        entity_type: 'users',
        entity_id: receptionRegistration.body.id,
        fields: ['role'],
      }),
      expect.objectContaining({
        action: 'update',
        entity_type: 'pets',
        entity_id: receptionPet.id,
      }),
    ]));
    expect(JSON.stringify(audit.body.entries)).not.toContain('Paciente estable');
  });
});
