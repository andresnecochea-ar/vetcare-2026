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
      version: '2.16.0',
      schemaVersion: 18,
    });

    // Los estudios cargados antes de 0011 siguen contando como resultado recibido.
    const legacyStudyId = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO pets (id, name) VALUES (?, ?)').bind('pet-legacy-study', 'Legacy').run();
    await env.DB.prepare(
      'INSERT INTO pet_studies (id, pet_id, type, title, date, url) VALUES (?,?,?,?,?,?)',
    ).bind(legacyStudyId, 'pet-legacy-study', 'Informe', 'Sin estado', '2026-01-01', 'https://example.test').run();
    const legacyStudy = await env.DB.prepare('SELECT status FROM pet_studies WHERE id = ?').bind(legacyStudyId).first();
    expect(legacyStudy.status).toBe('received');
    await env.DB.prepare('DELETE FROM pets WHERE id = ?').bind('pet-legacy-study').run();
  });

  it('ordena los pendientes clínicos del paciente por urgencia', async () => {
    const dayKey = (offset) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    globalThis.localDateKey = () => dayKey(0);
    globalThis.formatDate = (value) => value || '—';
    globalThis.canEditClinical = () => true;
    globalThis.appointmentIsTerminal = (appointment) => ['completed', 'cancelled', 'no_show'].includes(appointment.status);
    globalThis.sanitaryHasPendingDose = (record) => Boolean(record && record.nextDose && !record.cancelled);
    const pet = {
      id: 'pet-1',
      history: [
        { id: 'enc-1', date: dayKey(-40), title: 'Control anual', status: 'closed', nextControl: dayKey(-5), treatment: 'Antibiótico 7 días' },
        { id: 'enc-2', date: dayKey(-2), title: 'Herida', status: 'pending_results', nextControl: '' },
        { id: 'enc-3', date: dayKey(-90), title: 'Vacunación', status: 'closed', nextControl: dayKey(10) },
      ],
      studies: [
        { id: 'st-1', type: 'Ecografía', title: 'Abdomen', date: dayKey(3), status: 'requested' },
        { id: 'st-2', type: 'Receta', title: 'Ya cargada', date: dayKey(-1), status: 'received', url: 'https://example.test' },
      ],
      vaccines: [{ id: 'vac-1', name: 'Antirrábica', date: dayKey(-360), nextDose: dayKey(0) }],
    };
    globalThis.db = {
      pets: [pet],
      // El aviso ya creado para enc-3 no debe duplicarse con su próximo control.
      reminders: [
        { id: 'rem-1', petId: 'pet-1', title: 'Llamar al tutor', date: dayKey(-3), completed: false },
        { id: 'rem-2', petId: 'pet-1', title: 'Control: Vacunación', date: dayKey(10), completed: false },
        { id: 'rem-3', petId: 'pet-1', title: 'Ya resuelto', date: dayKey(-8), completed: true },
      ],
      appointments: [
        { id: 'apt-1', petId: 'pet-1', date: dayKey(4), time: '09:00', type: 'Control', status: 'scheduled' },
        { id: 'apt-2', petId: 'pet-1', date: dayKey(5), time: '10:00', type: 'Control', status: 'cancelled' },
      ],
    };

    await import('../../js/followup.js');
    const followUp = globalThis.VetCareFollowUp;

    expect(followUp.daysUntil(dayKey(-5))).toBe(-5);
    expect(followUp.state(0)).toBe('today');
    expect(followUp.when(-5)).toBe('Vencido hace 5 días');

    const summary = followUp.summary(pet);
    expect(summary.items.map(item => item.state)).toEqual([
      'overdue', 'overdue', 'today', 'soon', 'soon', 'soon',
    ]);
    expect(summary).toMatchObject({ overdue: 2, today: 1, soon: 3, pendingStudies: 1 });
    // La consulta sin cerrar y el turno cancelado no se mezclan con los pendientes del tutor.
    expect(summary.open.map(entry => entry.id)).toEqual(['enc-2']);
    expect(summary.items.some(item => item.kind === 'appointment' && item.title === 'Control')).toBe(true);
    expect(summary.items.filter(item => item.kind === 'appointment')).toHaveLength(1);
    // El control de enc-3 ya tiene aviso: se cuenta una sola vez.
    expect(summary.items.filter(item => item.date === dayKey(10))).toHaveLength(1);
    expect(followUp.headline(summary)).toMatchObject({ tone: 'overdue' });

    // Señal agregada de la veterinaria: solo lo vencido, lo de hoy y lo abierto,
    // con lo más urgente primero y el paciente al que pertenece.
    globalThis.encounterStatusLabel = () => 'Pendiente de resultados';
    const alDia = { id: 'pet-2', name: 'Ada', history: [], studies: [], vaccines: [] };
    globalThis.db.pets.push(alDia);
    const alerts = followUp.clinicAlerts();
    expect(alerts.map(row => [row.pet.id, row.item.state])).toEqual([
      ['pet-1', 'overdue'],
      ['pet-1', 'overdue'],
      ['pet-1', 'today'],
      ['pet-1', 'open'],
    ]);
    expect(alerts.every(row => row.item.state !== 'soon')).toBe(true);
    expect(alerts.some(row => row.pet.id === alDia.id)).toBe(false);
  });

  it('arma los documentos clínicos con los datos de la clínica y las plantillas', async () => {
    globalThis.formatDate = (value) => value || '—';
    globalThis.localDateKey = () => '2026-07-30';
    globalThis.db = {
      clinicName: 'VetCare',
      owners: [{ id: 'own-1', name: 'Ana Pérez' }],
      settings: { clinicName: 'Clínica Norte', receiptAddress: 'Calle 1', receiptPhone: '2262-000' },
    };

    await import('../../js/documents.js');
    const docs = globalThis.VetCareDocuments;

    // Las instalaciones viejas heredan dirección y teléfono de los recibos.
    expect(docs.clinicInfo()).toMatchObject({
      name: 'Clínica Norte', address: 'Calle 1', phone: '2262-000', email: '', license: '',
    });
    globalThis.db.settings.clinicAddress = 'Av. Siempreviva 742';
    globalThis.db.settings.clinicLicense = 'MP 1234';
    expect(docs.clinicInfo()).toMatchObject({ address: 'Av. Siempreviva 742', license: 'MP 1234' });

    // El certificado reemplaza los marcadores por datos reales.
    const pet = { id: 'p1', name: 'Luna', species: 'Perro', breed: 'Golden', ownerIds: ['own-1'] };
    const encounter = { date: '2026-07-28', vet: 'Dra. Test', diagnosis: 'Sano', treatment: '' };
    const text = docs.fillCertificate(pet, encounter);
    expect(text).toContain('Luna');
    expect(text).toContain('Perro');
    expect(text).toContain('Ana Pérez');
    expect(text).toContain('2026-07-28');
    expect(text).not.toMatch(/\[(paciente|especie|raza|tutor|fecha)\]/);

    // Un texto propio con marcadores desconocidos no se rompe.
    globalThis.db.settings.certificateTemplate = '[paciente] atendido por [profesional]. [inventado]';
    expect(docs.fillCertificate(pet, encounter)).toBe('Luna atendido por Dra. Test. [inventado]');
    delete globalThis.db.settings.certificateTemplate;

    // Plantillas: vienen las de fábrica hasta que se guarden otras.
    expect(docs.templates().map(t => t.id)).toEqual(['general', 'postquirurgico', 'sano']);
    globalThis.db.settings.examTemplates = [{ id: 'x', name: 'Propia', text: 'Peso:' }];
    expect(docs.templates()).toHaveLength(1);
    globalThis.db.settings.examTemplates = [];
    expect(docs.templates().map(t => t.id)).toEqual(['general', 'postquirurgico', 'sano']);
  });

  it('compara resultados de laboratorio contra los valores de referencia', async () => {
    globalThis.db = { settings: {} };
    await import('../../js/labs.js');
    const labs = globalThis.VetCareLabs;

    expect(labs.species({ species: 'Perro' })).toBe('dog');
    expect(labs.species({ species: 'Felino común' })).toBe('cat');
    expect(labs.species({ species: 'Conejo' })).toBe('');

    // Canino: hematocrito bajo, leucocitos altos, glucosa normal.
    const rows = labs.evaluate('hemogram', { hto: '30', wbc: '21000', hb: '' }, 'dog');
    const byKey = Object.fromEntries(rows.map(row => [row.key, row]));
    expect(byKey.hto).toMatchObject({ status: 'low', filled: true });
    expect(byKey.wbc).toMatchObject({ status: 'high' });
    expect(byKey.hb).toMatchObject({ filled: false, status: '' });

    // El mismo hematocrito es normal en un felino.
    expect(labs.evaluate('hemogram', { hto: '30' }, 'cat').find(r => r.key === 'hto').status).toBe('normal');
    // Sin especie conocida no se compara nada.
    expect(labs.evaluate('hemogram', { hto: '30' }, '').find(r => r.key === 'hto').status).toBe('');
    // Los campos de texto y de cruces nunca se marcan.
    expect(labs.evaluate('urine', { color: 'Ámbar', proteinas: '++' }, 'dog')
      .filter(row => row.filled).every(row => row.status === '')).toBe(true);

    const study = { panel: 'hemogram', results: { hto: '30', wbc: '21000' } };
    expect(labs.hasResults(study)).toBe(true);
    expect(labs.outOfRange(study, 'dog').map(row => row.key)).toEqual(['hto', 'wbc']);
    expect(labs.hasResults({ panel: 'hemogram', results: {} })).toBe(false);

    // Un rango editado en Opciones pisa al orientativo.
    globalThis.db.settings.labRanges = { 'hemogram.hto.dog': [25, 60] };
    expect(labs.evaluate('hemogram', { hto: '30' }, 'dog').find(r => r.key === 'hto').status).toBe('normal');
    globalThis.db.settings = {};
  });

  it('calcula el plan sanitario y sus vencimientos', async () => {
    const dayKey = (offset) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    globalThis.localDateKey = (value) => {
      if (!value) return dayKey(0);
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    };
    globalThis.followUpDaysUntil = () => 0;

    const pet = {
      id: 'pet-san',
      name: 'Tita',
      vaccines: [
        { id: 'vac-1', name: 'Antirrábica', date: dayKey(-360), nextDose: dayKey(5), lot: 'A-1', cancelled: '' },
        { id: 'vac-2', name: 'Séxtuple', date: dayKey(-400), nextDose: dayKey(-30), cancelled: '1' },
      ],
      dewormings: [
        { id: 'atp-1', name: 'Pipeta', date: dayKey(-30), nextDose: dayKey(1), cancelled: '' },
      ],
    };
    globalThis.db = { pets: [pet], reminders: [], owners: [] };

    await import('../../js/sanitary.js');
    const sanitary = globalThis.VetCareSanitary;

    // El intervalo calcula la próxima dosis sobre el calendario local.
    expect(sanitary.addDays('2026-07-29', 365)).toBe('2027-07-29');
    expect(sanitary.addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(sanitary.addDays('', 30)).toBe('');

    // Una dosis anulada deja de contar como pendiente pero no se pierde.
    expect(sanitary.hasPendingDose(pet.vaccines[0])).toBe(true);
    expect(sanitary.hasPendingDose(pet.vaccines[1])).toBe(false);
    expect(sanitary.records(pet).map(record => record.kind)).toEqual(['deworming', 'vaccine', 'vaccine']);

    sanitary.setRange(dayKey(-7), dayKey(30));
    expect(sanitary.due().map(row => row.record.id)).toEqual(['atp-1', 'vac-1']);
    sanitary.setRange(dayKey(-7), dayKey(2));
    expect(sanitary.due().map(row => row.record.id)).toEqual(['atp-1']);

    // El aviso de la próxima dosis sigue al registro: se crea, se actualiza y se
    // da por cumplido al anular.
    sanitary.syncReminder('pet-san', 'vaccine', pet.vaccines[0]);
    const reminderId = sanitary.reminderId('vac-1');
    expect(globalThis.db.reminders).toHaveLength(1);
    expect(globalThis.db.reminders[0]).toMatchObject({ id: reminderId, date: dayKey(5), completed: false });
    pet.vaccines[0].cancelled = '1';
    sanitary.syncReminder('pet-san', 'vaccine', pet.vaccines[0]);
    expect(globalThis.db.reminders).toHaveLength(1);
    expect(globalThis.db.reminders[0].completed).toBe(true);
  });

  it('arma la historia clínica como línea de tiempo y compara consultas', async () => {
    globalThis.formatDate = (value) => value || '—';
    globalThis.encounterStatusLabel = (status) => status || 'closed';
    globalThis.encounterStatusClass = (status) => 'encounter-status-' + (status || 'closed');
    globalThis.studyIsPending = (study) => (study && study.status) === 'requested';
    globalThis.followUpDaysUntil = () => 0;
    globalThis.followUpWhen = () => 'Hoy';
    globalThis.labSpecies = () => 'dog';
    globalThis.labSummaryHTML = () => '';
    globalThis.LAB_PANELS = globalThis.VetCareLabs?.panels || {};
    const pet = {
      id: 'pet-tl',
      name: 'Nube',
      history: [
        {
          id: 'enc-a', date: '2026-03-10', type: 'Consulta general', title: 'Control anual',
          status: 'closed', vet: 'Dra. Test', weight: '9.4', temp: '38.2', hr: '88',
          diagnosis: 'Estable', treatment: 'Plan vacunal', exam: 'Sin hallazgos', description: '',
        },
        {
          id: 'enc-b', date: '2026-07-02', type: 'Urgencia', title: 'Decaimiento',
          status: 'pending_results', vet: 'Dr. Prueba', weight: '8.1', temp: '39.4', hr: '104',
          diagnosis: 'A confirmar', treatment: 'Fluidos', exam: 'Mucosas pálidas', description: 'Controlar',
        },
      ],
      vaccines: [{ id: 'vac-a', name: 'Séxtuple', date: '2026-03-10', nextDose: '2027-03-10' }],
      studies: [{ id: 'std-a', type: 'Radiografía', title: 'Rx tórax', date: '2026-07-03', status: 'requested' }],
    };
    globalThis.db = {
      pets: [pet],
      reminders: [{ id: 'rem-a', petId: 'pet-tl', title: 'Control post urgencia', date: '2026-07-12', completed: true }],
      appointments: [],
    };

    await import('../../js/timeline.js');
    const timeline = globalThis.VetCareTimeline;

    const events = timeline.events(pet);
    // Un solo hilo cronológico, del más reciente al más viejo.
    expect(events.map(event => [event.date, event.kind])).toEqual([
      ['2026-07-12', 'control'],
      ['2026-07-03', 'study'],
      ['2026-07-02', 'encounter'],
      ['2026-03-10', 'encounter'],
      ['2026-03-10', 'vaccine'],
    ]);
    expect(events.find(event => event.kind === 'study')).toMatchObject({ status: 'pending' });
    expect(events.find(event => event.id === 'enc-b')).toMatchObject({ status: 'open' });

    timeline.setFilters({ kind: 'encounter' });
    expect(events.filter(timeline.matches).map(event => event.id)).toEqual(['enc-b', 'enc-a']);
    timeline.setFilters({ status: 'pending' });
    expect(events.filter(timeline.matches).map(event => event.id)).toEqual(['std-a', 'enc-b']);
    timeline.setFilters({ query: 'fluidos' });
    expect(events.filter(timeline.matches).map(event => event.id)).toEqual(['enc-b']);
    timeline.setFilters({});

    // La comparación ordena por fecha y calcula la diferencia numérica.
    const rows = timeline.comparison(pet.history[0], pet.history[1]);
    expect(rows.find(row => row.label === 'Peso')).toMatchObject({
      older: '9.4 kg', newer: '8.1 kg', delta: -1.3, deltaLabel: '-1.3 kg',
    });
    expect(rows.find(row => row.label === 'Temperatura')).toMatchObject({ delta: 1.2, deltaLabel: '+1.2 °C' });
    expect(rows.find(row => row.label === 'Diagnóstico')).toMatchObject({ older: 'Estable', newer: 'A confirmar' });
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
        vetUserId: login.body.user.id,
        weight: '28.4',
        temp: '38.6',
        hr: '92',
        exam: 'Mucosas rosadas, abdomen blando',
        diagnosis: 'Paciente clínicamente estable',
        nextControl: '2026-08-01',
        status: 'closed',
        startedAt: '2026-07-01T14:00:00.000Z',
        closedAt: '2026-07-01T14:30:00.000Z',
        reopenedReason: '',
        appointmentId: '',
      }],
      vaccines: [{
        id: crypto.randomUUID(),
        name: 'Antirrábica',
        date: '2026-07-02',
        nextDose: '2027-07-02',
        lot: 'L-2026-14',
        vet: 'Dra. Test',
        vetUserId: login.body.user.id,
        vaccineType: 'Antirrábica',
        productId: 'product-vaccine',
        intervalDays: '365',
        cancelled: '',
        notifiedAt: '',
      }],
      dewormings: [{
        id: crypto.randomUUID(),
        name: 'Pipeta antiparasitaria',
        date: '2026-07-02',
        nextDose: '2026-08-02',
        lot: '',
        vet: 'Dra. Test',
        vetUserId: login.body.user.id,
        productId: 'product-deworming',
        intervalDays: '31',
        cancelled: '',
        notifiedAt: '',
      }],
      images: [{ id: crypto.randomUUID(), data: 'data:image/png;base64,dGVzdA==', caption: 'Foto' }],
      studies: [{
        id: crypto.randomUUID(),
        type: 'Ecografía',
        title: 'Control abdominal',
        date: '2026-07-03',
        url: 'https://drive.google.com/example',
        status: 'received',
        panel: 'hemogram',
        results: { hto: '30', wbc: '21000' },
      }, {
        id: crypto.randomUUID(),
        type: 'Análisis de laboratorio',
        title: 'Hemograma de control',
        date: '2026-08-05',
        url: '',
        status: 'requested',
        panel: '',
        results: {},
      }],
    };
    const savedPet = await jsonResponse('/api/pets', {
      method: 'POST',
      headers: authenticated,
      body: pet,
    });
    expect(savedPet.response.status).toBe(200);
    expect(savedPet.body.revision).toBe(1);

    const appointment = {
      id: crypto.randomUUID(),
      petId: pet.id,
      date: '2026-07-29',
      time: '10:30',
      type: 'Control',
      vet: 'Dra. Test',
      vetUserId: login.body.user.id,
      notes: 'Control programado',
      status: 'waiting',
      duration: '30',
      checkedInAt: '2026-07-29T13:20:00.000Z',
      startedAt: '',
      completedAt: '',
    };
    expect((await request('/api/appointments', {
      method: 'POST',
      headers: authenticated,
      body: appointment,
    })).status).toBe(200);
    const invalidAppointment = await jsonResponse('/api/appointments', {
      method: 'POST',
      headers: authenticated,
      body: { ...appointment, id: crypto.randomUUID(), status: 'invented' },
    });
    expect(invalidAppointment.response.status).toBe(400);


    const grooming = {
      id: crypto.randomUUID(),
      petId: pet.id,
      date: '2026-08-01',
      time: '10:00',
      service: 'Baño',
      groomer: 'Pablo',
      groomerUserId: login.body.user.id,
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
      encounterId: pet.history[0].id,
      items: [{ desc: 'Consulta', qty: 1, price: 15000 }],
      total: 15000,
      status: 'paid',
      paymentMethod: 'cash',
      amountPaid: 15000,
      stockAppliedAt: '2026-07-28T12:00:00.000Z',
      notes: 'Pagado en efectivo',
    };
    const savedInvoice = await jsonResponse('/api/invoices', {
      method: 'POST',
      headers: authenticated,
      body: invoice,
    });
    expect(savedInvoice.response.status).toBe(200);
    expect(savedInvoice.body.number).toBe('0001');
    const duplicateEncounter = await jsonResponse('/api/invoices', {
      method: 'POST',
      headers: authenticated,
      body: { ...invoice, id: crypto.randomUUID(), number: '9999' },
    });
    expect(duplicateEncounter.response.status).toBe(409);
    expect(duplicateEncounter.body.error).toContain('ya tiene un recibo');

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

    const followupAction = {
      id: `appointment:${appointment.id}`,
      kind: 'appointment',
      refId: appointment.id,
      action: 'snooze',
      untilDate: '2026-08-05',
      userId: 'forged-user',
      userName: 'Nombre adulterado',
      createdAt: '2000-01-01T00:00:00.000Z',
    };
    const savedFollowup = await jsonResponse('/api/followupActions', {
      method: 'POST',
      headers: authenticated,
      body: followupAction,
    });
    expect(savedFollowup.response.status).toBe(200);
    expect(savedFollowup.body).toMatchObject({
      id: followupAction.id,
      action: 'snooze',
      userId: login.body.user.id,
      userName: 'Veterinaria Test',
    });
    expect(savedFollowup.body.createdAt).not.toBe(followupAction.createdAt);

    const coreSnapshot = await jsonResponse('/api/data?scope=core&date=2026-08-01', { headers: authenticated });
    expect(coreSnapshot.response.status).toBe(200);
    expect(coreSnapshot.body.partial).toBe(true);
    expect(coreSnapshot.body.groomingAppointments).toEqual([
      expect.objectContaining({ id: grooming.id, petId: pet.id }),
    ]);
    expect(coreSnapshot.body.pets).toEqual([
      expect.objectContaining({
        id: pet.id,
        history: [],
        vaccines: [],
        dewormings: [expect.objectContaining({ id: pet.dewormings[0].id })],
        studies: [expect.objectContaining({ id: pet.studies[1].id, status: 'requested' })],
      }),
    ]);
    expect(coreSnapshot.body.owners).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: owner.id }),
    ]));
    expect(coreSnapshot.body.inventory).toEqual([]);
    expect(coreSnapshot.body.invoices).toEqual([]);
    expect(coreSnapshot.body.followupActions).toEqual([
      expect.objectContaining({ id: followupAction.id, userId: login.body.user.id }),
    ]);

    const directorySnapshot = await jsonResponse('/api/data?scope=directory', { headers: authenticated });
    expect(directorySnapshot.response.status).toBe(200);
    expect(directorySnapshot.body.directory).toBe(true);
    const petSummary = directorySnapshot.body.pets.find((item) => item.id === pet.id);
    expect(petSummary).toMatchObject({
      id: pet.id,
      lastVisit: '2026-07-01',
      _summaryOnly: true,
      history: [expect.objectContaining({ id: pet.history[0].id, date: pet.history[0].date })],
      vaccines: [],
      dewormings: [],
      images: [],
      studies: [],
      ownerIds: [owner.id],
    });
    expect(directorySnapshot.body.inventory).toEqual([
      expect.objectContaining({ id: inventory.id }),
    ]);

    const singlePet = await jsonResponse(`/api/pets/${pet.id}`, { headers: authenticated });
    expect(singlePet.response.status).toBe(200);
    expect(singlePet.body).toMatchObject({ id: pet.id, ownerIds: [owner.id] });
    expect(singlePet.body.history).toEqual(pet.history);
    expect(singlePet.body.vaccines).toEqual(pet.vaccines);
    expect(singlePet.body.studies).toEqual(pet.studies);

    const snapshot = await jsonResponse('/api/data', { headers: authenticated });
    expect(snapshot.response.status).toBe(200);

    expect(snapshot.body.owners[0]).toMatchObject({ dni: owner.dni, notes: owner.notes });
    expect(snapshot.body.pets[0].history).toEqual(pet.history);
    expect(snapshot.body.appointments[0]).toMatchObject(appointment);
    expect(snapshot.body.pets[0].studies).toEqual(pet.studies);
    expect(snapshot.body.pets[0].vaccines).toEqual(pet.vaccines);
    expect(snapshot.body.pets[0].dewormings).toEqual(pet.dewormings);
    expect(snapshot.body.pets[0].ownerIds).toEqual([owner.id]);
    expect(snapshot.body.groomingAppointments[0]).toMatchObject({
      reminder: grooming.reminder,
      notes: grooming.notes,
      groomerUserId: login.body.user.id,
    });
    expect(snapshot.body.inventory[0].lots).toEqual(inventory.lots);
    expect(snapshot.body.invoices[0].items).toEqual(invoice.items);
    expect(snapshot.body.invoices[0].encounterId).toBe(pet.history[0].id);
    expect(snapshot.body.invoices[0]).toMatchObject({
      paymentMethod: invoice.paymentMethod,
      amountPaid: invoice.amountPaid,
      stockAppliedAt: invoice.stockAppliedAt,
    });
    expect(snapshot.body.followupActions[0]).toMatchObject({
      id: followupAction.id,
      userId: login.body.user.id,
    });
    expect(snapshot.body).toMatchObject({
      clinicName: 'VetCare Test',
      settings: { theme: 'dark', receiptTaxId: '20-12345678-9' },
    });

    const databaseInvoice = await env.DB.prepare('SELECT items, encounterId FROM invoices WHERE id = ?')
      .bind(invoice.id)
      .first();
    expect(typeof databaseInvoice.items).toBe('string');
    expect(databaseInvoice.encounterId).toBe(pet.history[0].id);

    const databaseHistory = await env.DB.prepare(
      `SELECT weight, temp, hr, exam, diagnosis, nextControl,
              status, startedAt, closedAt, reopenedReason, appointmentId FROM pet_history WHERE id = ?`,
    ).bind(pet.history[0].id).first();
    expect(databaseHistory).toMatchObject({
      weight: '28.4',
      temp: '38.6',
      hr: '92',
      exam: 'Mucosas rosadas, abdomen blando',
      diagnosis: 'Paciente clínicamente estable',
      nextControl: '2026-08-01',
      status: 'closed',
      startedAt: '2026-07-01T14:00:00.000Z',
      closedAt: '2026-07-01T14:30:00.000Z',
      reopenedReason: '',
      appointmentId: '',
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
    const withoutBilledHistory = structuredClone(firstUpdate.body);
    withoutBilledHistory.history = [];
    const billedHistoryRemoval = await jsonResponse('/api/pets', {
      method: 'POST',
      headers: authenticated,
      body: withoutBilledHistory,
    });
    expect(billedHistoryRemoval.response.status).toBe(409);
    expect(billedHistoryRemoval.body.error).toContain('vinculada a un recibo');
    const billedPetRemoval = await jsonResponse(`/api/pets/${pet.id}`, {
      method: 'DELETE',
      headers: authenticated,
      body: { revision: firstUpdate.body.revision },
    });
    expect(billedPetRemoval.response.status).toBe(409);
    expect(billedPetRemoval.body.error).toContain('consultas facturadas');

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

    const atomicPet = {
      id: crypto.randomUUID(),
      name: 'Paciente atómico',
      species: 'Perro',
      ownerIds: [owner.id],
      history: [],
      vaccines: [],
      images: [],
      studies: [],
    };
    const savedAtomicPet = await jsonResponse('/api/pets', {
      method: 'POST',
      headers: authenticated,
      body: atomicPet,
    });
    expect(savedAtomicPet.response.status).toBe(200);
    const atomicAppointment = {
      id: crypto.randomUUID(),
      petId: atomicPet.id,
      date: '2026-07-29',
      time: '15:00',
      type: 'Control',
      status: 'in_consultation',
      startedAt: '2026-07-29T18:00:00.000Z',
      completedAt: '',
    };
    expect((await request('/api/appointments', {
      method: 'POST',
      headers: authenticated,
      body: atomicAppointment,
    })).status).toBe(200);

    const atomicEncounterId = crypto.randomUUID();
    const atomicReminderId = crypto.randomUUID();
    const atomicClose = {
      idempotencyKey: `close-${crypto.randomUUID()}`,
      petId: atomicPet.id,
      expectedRevision: 1,
      petWeight: '12.4',
      encounter: {
        id: atomicEncounterId,
        date: '2026-07-29',
        type: 'Consulta general',
        title: 'Control atómico',
        description: '',
        treatment: 'Continuar plan',
        vet: 'Dra. Test',
        vetUserId: login.body.user.id,
        weight: '12.4',
        temp: '38.5',
        hr: '90',
        exam: 'Sin particularidades',
        diagnosis: 'Estable',
        nextControl: '2026-08-29',
        status: 'closed',
        startedAt: '2026-07-29T18:00:00.000Z',
        closedAt: '2026-07-29T18:30:00.000Z',
        reopenedReason: '',
        appointmentId: atomicAppointment.id,
      },
      appointment: {
        ...atomicAppointment,
        status: 'completed',
        completedAt: '2026-07-29T18:30:00.000Z',
      },
      reminder: {
        id: atomicReminderId,
        title: 'Control: Control atómico',
        petId: atomicPet.id,
        date: '2026-08-29',
        completed: false,
      },
      invoice: null,
    };
    const firstAtomicClose = await jsonResponse('/api/clinical-close', {
      method: 'POST',
      headers: authenticated,
      body: atomicClose,
    });
    expect(firstAtomicClose.response.status).toBe(200);
    expect(firstAtomicClose.body).toMatchObject({
      petRevision: 2,
      encounterId: atomicEncounterId,
      reminderId: atomicReminderId,
      invoiceId: '',
      replayed: false,
    });
    const replayedAtomicClose = await jsonResponse('/api/clinical-close', {
      method: 'POST',
      headers: authenticated,
      body: atomicClose,
    });
    expect(replayedAtomicClose.response.status).toBe(200);
    expect(replayedAtomicClose.body).toMatchObject({
      petRevision: 2,
      encounterId: atomicEncounterId,
      replayed: true,
    });
    const reusedKeyWithOtherData = await jsonResponse('/api/clinical-close', {
      method: 'POST',
      headers: authenticated,
      body: {
        ...atomicClose,
        encounter: { ...atomicClose.encounter, title: 'Datos diferentes' },
      },
    });
    expect(reusedKeyWithOtherData.response.status).toBe(409);
    expect(reusedKeyWithOtherData.body.error).toContain('usada con otros datos');
    expect((await env.DB.prepare('SELECT COUNT(*) AS total FROM pet_history WHERE id = ?')
      .bind(atomicEncounterId).first()).total).toBe(1);
    expect((await env.DB.prepare('SELECT vetUserId FROM pet_history WHERE id = ?')
      .bind(atomicEncounterId).first()).vetUserId).toBe(login.body.user.id);
    expect((await env.DB.prepare('SELECT COUNT(*) AS total FROM reminders WHERE id = ?')
      .bind(atomicReminderId).first()).total).toBe(1);
    expect((await env.DB.prepare('SELECT status FROM appointments WHERE id = ?')
      .bind(atomicAppointment.id).first()).status).toBe('completed');

    const rejectedEncounterId = crypto.randomUUID();
    const rejectedClose = await jsonResponse('/api/clinical-close', {
      method: 'POST',
      headers: authenticated,
      body: {
        ...atomicClose,
        idempotencyKey: `close-${crypto.randomUUID()}`,
        expectedRevision: 1,
        encounter: { ...atomicClose.encounter, id: rejectedEncounterId },
        appointment: null,
        reminder: null,
      },
    });
    expect(rejectedClose.response.status).toBe(409);
    expect((await env.DB.prepare('SELECT COUNT(*) AS total FROM pet_history WHERE id = ?')
      .bind(rejectedEncounterId).first()).total).toBe(0);

    const invoicedEncounterId = crypto.randomUUID();
    const atomicInvoiceId = crypto.randomUUID();
    const invoicedClose = {
      ...atomicClose,
      idempotencyKey: `close-${crypto.randomUUID()}`,
      expectedRevision: 2,
      encounter: {
        ...atomicClose.encounter,
        id: invoicedEncounterId,
        appointmentId: '',
        title: 'Consulta con recibo opcional',
      },
      appointment: null,
      reminder: null,
      invoice: {
        id: atomicInvoiceId,
        date: '2026-07-29',
        ownerId: owner.id,
        petId: atomicPet.id,
        encounterId: invoicedEncounterId,
        items: [{ desc: 'Consulta', qty: 1, price: 2000 }],
        total: 2000,
        status: 'pending',
        notes: 'Recibo opcional',
      },
    };
    const firstInvoicedClose = await jsonResponse('/api/clinical-close', {
      method: 'POST',
      headers: authenticated,
      body: invoicedClose,
    });
    expect(firstInvoicedClose.response.status).toBe(200);
    expect(firstInvoicedClose.body).toMatchObject({
      petRevision: 3,
      invoiceId: atomicInvoiceId,
      invoiceNumber: '0006',
      replayed: false,
    });
    const replayedInvoicedClose = await jsonResponse('/api/clinical-close', {
      method: 'POST',
      headers: authenticated,
      body: invoicedClose,
    });
    expect(replayedInvoicedClose.response.status).toBe(200);
    expect(replayedInvoicedClose.body).toMatchObject({
      invoiceId: atomicInvoiceId,
      invoiceNumber: '0006',
      replayed: true,
    });
    expect((await env.DB.prepare('SELECT COUNT(*) AS total FROM invoices WHERE encounterId = ?')
      .bind(invoicedEncounterId).first()).total).toBe(1);

    // El cierre puede dejar estudios pedidos: entran en la misma transacción y
    // el reintento no los duplica.
    const studyEncounterId = crypto.randomUUID();
    const requestedStudyId = crypto.randomUUID();
    const closeWithStudies = {
      ...atomicClose,
      idempotencyKey: `close-${crypto.randomUUID()}`,
      expectedRevision: 3,
      encounter: {
        ...atomicClose.encounter,
        id: studyEncounterId,
        appointmentId: '',
        title: 'Consulta que deja estudios pedidos',
      },
      appointment: null,
      reminder: null,
      invoice: null,
      studies: [{
        id: requestedStudyId,
        type: 'Ecografía',
        title: 'Ecografía abdominal de control',
        date: '2026-08-10',
        url: '',
        status: 'requested',
      }],
    };
    const closedWithStudies = await jsonResponse('/api/clinical-close', {
      method: 'POST',
      headers: authenticated,
      body: closeWithStudies,
    });
    expect(closedWithStudies.response.status).toBe(200);
    expect(closedWithStudies.body).toMatchObject({ petRevision: 4, replayed: false });
    const storedStudy = await env.DB.prepare('SELECT pet_id, status, url, title FROM pet_studies WHERE id = ?')
      .bind(requestedStudyId).first();
    expect(storedStudy).toMatchObject({
      pet_id: atomicPet.id,
      status: 'requested',
      url: '',
      title: 'Ecografía abdominal de control',
    });
    const replayedWithStudies = await jsonResponse('/api/clinical-close', {
      method: 'POST',
      headers: authenticated,
      body: closeWithStudies,
    });
    expect(replayedWithStudies.response.status).toBe(200);
    expect(replayedWithStudies.body).toMatchObject({ petRevision: 4, replayed: true });
    expect((await env.DB.prepare('SELECT COUNT(*) AS total FROM pet_studies WHERE pet_id = ? AND status = ?')
      .bind(atomicPet.id, 'requested').first()).total).toBe(1);

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

    const forbiddenPasswordReset = await jsonResponse(`/api/users/${login.body.user.id}/password`, {
      method: 'PUT',
      headers: receptionAuth,
      body: { password: 'no-deberia-poder-1234' },
    });
    expect(forbiddenPasswordReset.response.status).toBe(403);

    const tooShortPasswordReset = await jsonResponse(`/api/users/${receptionRegistration.body.id}/password`, {
      method: 'PUT',
      headers: authenticated,
      body: { password: 'corta' },
    });
    expect(tooShortPasswordReset.response.status).toBe(400);

    const newReceptionPassword = 'clave-restablecida-9999';
    const passwordReset = await jsonResponse(`/api/users/${receptionRegistration.body.id}/password`, {
      method: 'PUT',
      headers: authenticated,
      body: { password: newReceptionPassword },
    });
    expect(passwordReset.response.status).toBe(200);
    expect(passwordReset.body.ok).toBe(true);

    // El reset revoca las sesiones activas de esa persona.
    expect((await request('/api/me', { headers: receptionAuth })).status).toBe(401);

    const oldPasswordLogin = await jsonResponse('/api/login', {
      method: 'POST',
      body: { email: receptionEmail, password: receptionPassword },
    });
    expect(oldPasswordLogin.response.status).toBe(401);

    const newPasswordLogin = await jsonResponse('/api/login', {
      method: 'POST',
      body: { email: receptionEmail, password: newReceptionPassword },
    });
    expect(newPasswordLogin.response.status).toBe(200);
    expect(newPasswordLogin.body.user.role).toBe('veterinarian');

    const lastAdminDemotion = await jsonResponse(`/api/users/${login.body.user.id}/role`, {
      method: 'PUT',
      headers: authenticated,
      body: { role: 'reception' },
    });
    expect(lastAdminDemotion.response.status).toBe(409);
    expect(lastAdminDemotion.body.error).toContain('al menos un administrador');

    const invitedEmail = `invitada-${crypto.randomUUID()}@example.com`;
    const invitation = await jsonResponse('/api/invitations', {
      method: 'POST',
      headers: authenticated,
      body: { email: invitedEmail, role: 'veterinarian' },
    });
    expect(invitation.response.status).toBe(201);
    expect(invitation.body).toMatchObject({ email: invitedEmail, role: 'veterinarian' });
    expect(invitation.body.code).toMatch(/^[A-Z0-9]{12}$/);

    const wrongInvitationEmail = await jsonResponse('/api/register', {
      method: 'POST',
      body: {
        email: `otra-${crypto.randomUUID()}@example.com`,
        password: 'clave-invitada-1234',
        name: 'Otra persona',
        inviteCode: invitation.body.code,
      },
    });
    expect(wrongInvitationEmail.response.status).toBe(403);

    const invitedRegistration = await jsonResponse('/api/register', {
      method: 'POST',
      body: {
        email: invitedEmail,
        password: 'clave-invitada-1234',
        name: 'Veterinaria Invitada',
        inviteCode: invitation.body.code,
      },
    });
    expect(invitedRegistration.response.status).toBe(201);
    expect(invitedRegistration.body.role).toBe('veterinarian');

    const reusedInvitation = await jsonResponse('/api/register', {
      method: 'POST',
      body: {
        email: `reuso-${crypto.randomUUID()}@example.com`,
        password: 'clave-invitada-1234',
        name: 'Intento de reuso',
        inviteCode: invitation.body.code,
      },
    });
    expect(reusedInvitation.response.status).toBe(403);

    const invitedProfile = await jsonResponse(`/api/users/${invitedRegistration.body.id}/profile`, {
      method: 'PUT',
      headers: authenticated,
      body: { active: true, license: 'MP 12345' },
    });
    expect(invitedProfile.response.status).toBe(200);
    expect(invitedProfile.body).toMatchObject({ active: 1, license: 'MP 12345' });

    const invitedLogin = await jsonResponse('/api/login', {
      method: 'POST',
      body: { email: invitedEmail, password: 'clave-invitada-1234' },
    });
    expect(invitedLogin.response.status).toBe(200);
    expect(invitedLogin.body.user).toMatchObject({ role: 'veterinarian', license: 'MP 12345' });

    const activeStaff = await jsonResponse('/api/staff', { headers: authenticated });
    expect(activeStaff.body.staff).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: invitedRegistration.body.id, license: 'MP 12345' }),
    ]));

    const deactivatedInvitee = await jsonResponse(`/api/users/${invitedRegistration.body.id}/profile`, {
      method: 'PUT',
      headers: authenticated,
      body: { active: false, license: 'MP 12345' },
    });
    expect(deactivatedInvitee.response.status).toBe(200);
    expect(deactivatedInvitee.body.active).toBe(0);
    expect((await request('/api/me', {
      headers: { Authorization: `Bearer ${invitedLogin.body.token}` },
    })).status).toBe(401);
    expect((await request('/api/login', {
      method: 'POST',
      body: { email: invitedEmail, password: 'clave-invitada-1234' },
    })).status).toBe(403);
    const staffWithHistoricalLicense = await jsonResponse('/api/staff', { headers: authenticated });
    expect(staffWithHistoricalLicense.body.staff).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: invitedRegistration.body.id, active: 0, license: 'MP 12345' }),
    ]));

    const rotatedAccess = await jsonResponse('/api/access/invite-code', {
      method: 'POST',
      headers: authenticated,
    });
    expect(rotatedAccess.response.status).toBe(200);
    expect(rotatedAccess.body.code).toMatch(/^[A-Z0-9]{12}$/);
    const oldGeneralCode = await jsonResponse('/api/register', {
      method: 'POST',
      body: {
        email: `codigo-viejo-${crypto.randomUUID()}@example.com`,
        password: 'clave-general-1234',
        name: 'Código viejo',
        inviteCode: 'test-invite-code',
      },
    });
    expect(oldGeneralCode.response.status).toBe(403);
    const generalRegistration = await jsonResponse('/api/register', {
      method: 'POST',
      body: {
        email: `codigo-nuevo-${crypto.randomUUID()}@example.com`,
        password: 'clave-general-1234',
        name: 'Código renovado',
        inviteCode: rotatedAccess.body.code,
      },
    });
    expect(generalRegistration.response.status).toBe(201);
    expect(generalRegistration.body.role).toBe('reception');

    const deletedReceptionPet = await jsonResponse(`/api/pets/${receptionPet.id}`, {
      method: 'DELETE',
      headers: authenticated,
      body: { revision: 2 },
    });
    expect(deletedReceptionPet.response.status).toBe(200);

    const audit = await jsonResponse('/api/audit?limit=200', { headers: authenticated });
    expect(audit.response.status).toBe(200);
    expect(audit.body.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'role_change',
        entity_type: 'users',
        entity_id: receptionRegistration.body.id,
        fields: ['role'],
        target_label: 'Recepción Test',
      }),
      expect.objectContaining({
        action: 'password_reset',
        entity_type: 'users',
        entity_id: receptionRegistration.body.id,
        target_label: 'Recepción Test',
      }),
      expect.objectContaining({
        action: 'invite',
        entity_type: 'users',
        target_label: invitedEmail,
      }),
      expect.objectContaining({
        action: 'deactivate',
        entity_type: 'users',
        entity_id: invitedRegistration.body.id,
      }),
      expect.objectContaining({
        action: 'invite_code_rotate',
        entity_type: 'settings',
      }),
      expect.objectContaining({
        action: 'update',
        entity_type: 'pets',
        entity_id: receptionPet.id,
      }),
      expect.objectContaining({
        action: 'delete',
        entity_type: 'pets',
        entity_id: receptionPet.id,
        target_label: 'Paciente Paciente Recepción · Tutor Tutor Recepción',
      }),
    ]));
    expect(JSON.stringify(audit.body.entries)).not.toContain('Paciente estable');
    expect(JSON.stringify(audit.body.entries)).not.toContain(newReceptionPassword);

    const roleAudit = audit.body.entries.find(entry => entry.action === 'role_change' && entry.entity_id === receptionRegistration.body.id);
    const filteredAudit = await jsonResponse(`/api/audit?from=${encodeURIComponent(roleAudit.created_at)}&to=${encodeURIComponent(new Date(Date.parse(roleAudit.created_at) + 1).toISOString())}`, { headers: authenticated });
    expect(filteredAudit.response.status).toBe(200);
    expect(filteredAudit.body.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: roleAudit.id }),
    ]));

    // Una edición masiva hecha desde el directorio resumido no debe interpretar
    // los arrays vacíos como una orden de borrar la historia clínica.
    const latestDirectory = await jsonResponse('/api/data?scope=directory', { headers: authenticated });
    const summaryToArchive = latestDirectory.body.pets.find((item) => item.id === pet.id);
    const historyCountBefore = (await env.DB.prepare('SELECT COUNT(*) AS total FROM pet_history WHERE pet_id = ?')
      .bind(pet.id).first()).total;
    const archivedSummary = await jsonResponse('/api/pets', {
      method: 'POST',
      headers: authenticated,
      body: {
        ...summaryToArchive,
        inactiveAt: '2026-08-01',
        inactiveReason: 'Prueba de archivado masivo',
      },
    });
    expect(archivedSummary.response.status).toBe(200);
    const historyCountAfter = (await env.DB.prepare('SELECT COUNT(*) AS total FROM pet_history WHERE pet_id = ?')
      .bind(pet.id).first()).total;
    expect(historyCountAfter).toBe(historyCountBefore);
    expect((await jsonResponse(`/api/pets/${pet.id}`, { headers: authenticated })).body.history.length).toBe(historyCountBefore);

    // La carga inicial debe dividir los IN extensos para no superar el límite
    // de parámetros de D1 cuando producción acumula muchos pendientes.
    const bulkPetIds = Array.from({ length: 85 }, (_, index) => `pet-core-bulk-${index}`);
    const bulkStatements = bulkPetIds.flatMap((id, index) => [
      env.DB.prepare('INSERT INTO pets (id, name) VALUES (?, ?)').bind(id, `Paciente masivo ${index}`),
      env.DB.prepare('INSERT INTO reminders (id, title, petId, date) VALUES (?, ?, ?, ?)')
        .bind(`reminder-core-bulk-${index}`, 'Control pendiente', id, '2026-08-01'),
    ]);
    for (let offset = 0; offset < bulkStatements.length; offset += 50) {
      await env.DB.batch(bulkStatements.slice(offset, offset + 50));
    }
    const largeCoreSnapshot = await jsonResponse('/api/data?scope=core&date=2026-08-01', { headers: authenticated });
    expect(largeCoreSnapshot.response.status).toBe(200);
    expect(largeCoreSnapshot.body.pets.filter(item => item.id.startsWith('pet-core-bulk-'))).toHaveLength(85);
  });

  it('prefiere el celular sobre el fijo cuando hay varios números pegados', async () => {
    await import('../../js/phone.js');
    const cleanPhone = globalThis.cleanPhone;

    // Caso normal: un solo número, con o sin formato.
    expect(cleanPhone('5491123456789')).toBe('5491123456789');
    expect(cleanPhone('43-1032')).toBe('431032');

    // Datos migrados: fijo + celular pegados con espacio. El útil es el celular
    // (el que empieza con 15), no el primero de la lista.
    expect(cleanPhone('43-8745 15352493')).toBe('15352493');
    expect(cleanPhone('15509680 15561417')).toBe('15509680');
    // Con iniciales de personas mezcladas: se ignoran los tokens sin dígitos.
    expect(cleanPhone('45-0717 SRA 15636877 JL 15591887')).toBe('15636877');
    // Sin ningún celular queda el fijo, que sirve para llamar.
    expect(cleanPhone('42-5132 T 42-2392')).toBe('425132');

    expect(cleanPhone('')).toBe('');
    expect(cleanPhone(null)).toBe('');

    const isLikelyFullPhone = globalThis.isLikelyFullPhone;
    expect(isLikelyFullPhone('+5492262649798')).toBe(true);
    expect(isLikelyFullPhone('5492262649798')).toBe(true);
    // Formato viejo, local: falta código de país y área.
    expect(isLikelyFullPhone('15649798')).toBe(false);
    expect(isLikelyFullPhone('43-8745 15352493')).toBe(false);
    expect(isLikelyFullPhone('')).toBe(false);
  });

  it('arma el número internacional de WhatsApp con el área configurada', async () => {
    await import('../../js/phone.js');
    const { waPhone, telPhone, phoneIssue } = globalThis;

    // Sin área configurada no se adivina nada: no hay WhatsApp posible.
    globalThis.db = { settings: {} };
    expect(waPhone('15649798')).toBe('');
    expect(phoneIssue('15649798')).toBe('no-area');

    globalThis.db = { settings: { phoneCountryCode: '54', phoneAreaCode: '2262' } };

    // Celular local del formato viejo: se saca el 15 y se antepone 54 9 + área.
    expect(waPhone('15649798')).toBe('5492262649798');
    // Fijo primero, celular después: gana el celular.
    expect(waPhone('42-5132 T 42-2392 15657545')).toBe('5492262657545');
    expect(waPhone('MARCELA 15406287 15507188')).toBe('5492262406287');
    // Ya internacional: se respeta tal cual.
    expect(waPhone('+54 9 2262 64-9798')).toBe('5492262649798');
    expect(waPhone('5492262649798')).toBe('5492262649798');

    // Sólo fijo local: se puede llamar pero no mandar WhatsApp.
    expect(waPhone('43-0781')).toBe('');
    expect(phoneIssue('43-0781')).toBe('landline-only');
    expect(telPhone('43-0781')).toBe('542262430781');

    // Número nacional de 10 dígitos: se asume celular y se le agrega el 9.
    // Casi siempre es el celular de alguien de otra localidad.
    expect(waPhone('45-2121 1121608026')).toBe('5491121608026');
    expect(waPhone('2983500364')).toBe('5492983500364');
    // Con el 0 nacional adelante.
    expect(waPhone('01144440947')).toBe('5491144440947');
    // Área local + 15 + número, todo pegado.
    expect(waPhone('226215556326')).toBe('5492262556326');

    // Celular de otra área en formato viejo: no se le inventa el área local,
    // porque el mensaje terminaría en el teléfono de un vecino.
    expect(waPhone('0341-153520058 43-0826')).toBe('');

    expect(waPhone('')).toBe('');
    expect(phoneIssue('')).toBe('empty');
    expect(phoneIssue('15649798')).toBe(null);

    delete globalThis.db;
  });
});
