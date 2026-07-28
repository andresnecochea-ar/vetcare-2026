import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

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
  it('expone un health check que valida las migraciones', async () => {
    const { response, body } = await jsonResponse('/api/health');
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      database: 'ready',
      version: '2.1.0',
      schemaVersion: 2,
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
      history: [{ id: crypto.randomUUID(), date: '2026-07-01', title: 'Control', type: 'Consulta' }],
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
    expect((await request('/api/pets', { method: 'POST', headers: authenticated, body: pet })).status).toBe(200);

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
      number: '0001',
      date: '2026-07-28',
      ownerId: owner.id,
      petId: pet.id,
      items: [{ desc: 'Consulta', qty: 1, price: 15000 }],
      total: 15000,
      status: 'paid',
      notes: 'Pagado en efectivo',
    };
    expect((await request('/api/invoices', {
      method: 'POST',
      headers: authenticated,
      body: invoice,
    })).status).toBe(200);

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
  });
});
