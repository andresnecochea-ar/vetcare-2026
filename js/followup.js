// ========================================
// [11c] SEGUIMIENTO CLÍNICO — qué debe suceder después de la consulta
// Deriva pendientes del paciente (controles, estudios solicitados, vacunas,
// turnos y consultas sin cerrar) a partir de los datos que ya existen.
// ========================================

const FOLLOWUP_HORIZON_DAYS = 90;
const FOLLOWUP_SOON_DAYS = 30;
// Vencido hace más de un año: en la vista "Hoy" (agregado de toda la clínica)
// ya no es "trabajo de hoy", así que se cuenta aparte y queda oculto por
// defecto para no tapar lo realmente accionable. En la ficha de cada paciente
// (renderPetFollowUp) sí se sigue mostrando todo, sin este recorte.
const FOLLOWUP_STALE_DAYS = 365;
let showStaleFollowUpAlerts = false;

// "Archivar" un pendiente de la vista Hoy no lo resuelve (sigue en la ficha
// del paciente, tal cual "Marcar hecho" no lo hace): solo deja de aparecer en
// el agregado del día. Es una preferencia de qué mostrar, no un dato clínico,
// así que se guarda local por dispositivo (no sincroniza entre equipos).
const FOLLOWUP_DISMISS_KEY = 'vetcare_dismissed_followups';

function followUpDismissKey(item) { return `${item.kind}:${item.refId}`; }

function loadDismissedFollowUps() {
  try { return new Set(JSON.parse(localStorage.getItem(FOLLOWUP_DISMISS_KEY) || '[]')); }
  catch (e) { return new Set(); }
}

function dismissFollowUp(kind, refId) {
  const set = loadDismissedFollowUps();
  set.add(`${kind}:${refId}`);
  try { localStorage.setItem(FOLLOWUP_DISMISS_KEY, JSON.stringify([...set])); } catch (e) {}
  render();
}

function petPrimaryOwner(pet) {
  const ownerId = (pet && pet.ownerIds || [])[0];
  return ownerId ? (db.owners || []).find(o => o.id === ownerId) : null;
}

function followUpReminderMessage(pet, item) {
  const when = item.date ? ` (${followUpWhen(item.days).toLowerCase()}, ${formatDate(item.date)})` : '';
  return `Hola, le escribimos de la veterinaria por ${pet.name}: ${followUpDetail(item)}${when}.`;
}

function followUpReminderButtonHTML(pet, item) {
  const owner = petPrimaryOwner(pet);
  if (!owner) return '';
  return waButtonHTML([owner.phone, owner.altPhone], {
    message: followUpReminderMessage(pet, item),
    label: 'Recordatorio WA',
    title: `Avisar a ${owner.name} por WhatsApp`,
    fixOnclick: `openOwnerModal('${owner.id}')`
  });
}

// Diferencia en días entre hoy y una fecha YYYY-MM-DD, en calendario local.
function followUpDaysUntil(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function followUpState(days) {
  if (days === null) return 'open';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= FOLLOWUP_SOON_DAYS) return 'soon';
  return 'later';
}

function followUpWhen(days) {
  if (days === null) return 'Sin fecha';
  if (days < 0) return `Vencido hace ${-days} día${days === -1 ? '' : 's'}`;
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

function studyIsPending(study) { return (study && study.status) === 'requested'; }

function encounterIsOpen(entry) { return (entry.status || 'closed') !== 'closed'; }

// Devuelve los pendientes con fecha del paciente, ordenados del más urgente al
// más lejano. Cada item describe qué falta y con qué acción se resuelve.
function petFollowUpItems(pet) {
  if (!pet) return [];
  const items = [];
  const clinical = typeof canEditClinical === 'function' ? canEditClinical() : true;
  const pendingReminders = (db.reminders || []).filter(r => r.petId === pet.id && !r.completed);

  pendingReminders.forEach(reminder => {
    const days = followUpDaysUntil(reminder.date);
    items.push({
      kind: 'control',
      refId: reminder.id,
      label: 'Control',
      title: reminder.title || 'Control',
      detail: reminder.notes || '',
      date: reminder.date,
      days,
      state: followUpState(days),
      actions: [{ label: 'Marcar hecho', onclick: `completeReminder('${reminder.id}')` }]
    });
  });

  // Próximos controles indicados en una consulta que todavía no tienen aviso.
  (pet.history || []).forEach(entry => {
    if (!entry.nextControl || encounterIsOpen(entry)) return;
    const alreadyNotified = pendingReminders.some(r =>
      r.date === entry.nextControl && (r.type === 'control' || /^control/i.test(r.title || '')));
    if (alreadyNotified) return;
    const days = followUpDaysUntil(entry.nextControl);
    if (days === null || days > FOLLOWUP_HORIZON_DAYS) return;
    items.push({
      kind: 'control',
      refId: entry.id,
      label: 'Control indicado',
      title: entry.title || 'Próximo control',
      detail: 'Indicado en la consulta del ' + formatDate(entry.date) + ' · sin aviso creado',
      date: entry.nextControl,
      days,
      state: followUpState(days),
      actions: [{ label: 'Crear aviso', onclick: `createControlReminder('${pet.id}','${entry.id}')` }]
    });
  });

  (pet.studies || []).filter(studyIsPending).forEach(study => {
    const days = followUpDaysUntil(study.date);
    items.push({
      kind: 'study',
      refId: study.id,
      label: 'Estudio solicitado',
      title: study.title || study.type || 'Estudio',
      detail: study.type || '',
      date: study.date,
      days,
      state: days === null ? 'open' : followUpState(days),
      actions: clinical ? [
        { label: 'Cargar resultado', onclick: `editStudyLink('${pet.id}','${study.id}')`, primary: true },
        { label: 'Marcar recibido', onclick: `markStudyReceived('${pet.id}','${study.id}')` }
      ] : []
    });
  });

  [['vaccine', pet.vaccines], ['deworming', pet.dewormings]].forEach(([kind, collection]) => {
    (collection || []).forEach(record => {
      if (!sanitaryHasPendingDose(record)) return;
      const days = followUpDaysUntil(record.nextDose);
      if (days === null || days > FOLLOWUP_HORIZON_DAYS) return;
      items.push({
        kind,
        refId: record.id,
        label: kind === 'vaccine' ? 'Próxima dosis' : 'Próxima desparasitación',
        title: record.name || (kind === 'vaccine' ? 'Vacuna' : 'Antiparasitario'),
        detail: 'Última aplicación: ' + formatDate(record.date),
        date: record.nextDose,
        days,
        state: followUpState(days),
        actions: clinical ? [{ label: 'Registrar aplicación', onclick: `openSanitaryModal('${pet.id}','${kind}')` }] : []
      });
    });
  });

  (db.appointments || [])
    .filter(a => a.petId === pet.id && a.date >= localDateKey() && !appointmentIsTerminal(a))
    .forEach(appointment => {
      const days = followUpDaysUntil(appointment.date);
      if (days === null || days > FOLLOWUP_HORIZON_DAYS) return;
      items.push({
        kind: 'appointment',
        refId: appointment.id,
        label: 'Turno programado',
        title: appointment.type || 'Consulta',
        detail: [appointment.time, appointment.vet].filter(Boolean).join(' · '),
        date: appointment.date,
        days,
        state: followUpState(days),
        actions: [{ label: 'Ver turno', onclick: `openApptModal('${appointment.id}')` }]
      });
    });

  const weight = { overdue: 0, today: 1, soon: 2, open: 3, later: 4 };
  return items.sort((a, b) => (weight[a.state] - weight[b.state]) || String(a.date || '').localeCompare(String(b.date || '')));
}

// Consultas que quedaron abiertas: son trabajo pendiente del equipo, no del tutor.
function petOpenEncounters(pet) {
  return [...((pet && pet.history) || [])]
    .filter(encounterIsOpen)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

// Tratamiento e indicaciones de la última consulta cerrada.
function petActiveTreatment(pet) {
  return [...((pet && pet.history) || [])]
    .filter(entry => !encounterIsOpen(entry) && (entry.treatment || '').trim())
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null;
}

function petFollowUpSummary(pet) {
  const items = petFollowUpItems(pet);
  const open = petOpenEncounters(pet);
  const count = state => items.filter(item => item.state === state).length;
  const overdue = count('overdue');
  const today = count('today');
  return {
    items,
    open,
    overdue,
    today,
    soon: count('soon'),
    pendingStudies: items.filter(item => item.kind === 'study').length,
    alerts: overdue + today + open.length,
    total: items.length + open.length
  };
}

// Evita repetir el tipo cuando el título ya lo nombra ("Control: Control anual").
function followUpDetail(item) {
  if (!item) return '';
  const title = String(item.title || '');
  const label = String(item.label || '');
  return title.toLowerCase().startsWith(label.toLowerCase()) ? title : `${label}: ${title}`;
}

function followUpHeadline(summary) {
  if (summary.overdue) {
    const first = summary.items.find(item => item.state === 'overdue');
    return { tone: 'overdue', text: `${summary.overdue} pendiente${summary.overdue === 1 ? '' : 's'} vencido${summary.overdue === 1 ? '' : 's'}`, detail: followUpDetail(first) };
  }
  if (summary.today) {
    const first = summary.items.find(item => item.state === 'today');
    return { tone: 'today', text: 'Hay pendientes para hoy', detail: followUpDetail(first) };
  }
  if (summary.open.length) {
    return { tone: 'open', text: `${summary.open.length} consulta${summary.open.length === 1 ? '' : 's'} sin cerrar`, detail: 'Completar la atención para dejar la historia al día' };
  }
  const next = summary.items[0];
  if (next) return { tone: 'clear', text: 'Sin pendientes vencidos', detail: `Sigue: ${next.label.toLowerCase()} · ${followUpWhen(next.days).toLowerCase()}` };
  return { tone: 'clear', text: 'Sin pendientes registrados', detail: 'No hay controles, estudios ni turnos por delante' };
}

// Marca en la pestaña lo que necesita acción hoy o quedó vencido.
function followUpTabBadge(pet) {
  const summary = petFollowUpSummary(pet);
  if (!summary.alerts) return '';
  const tone = summary.overdue ? ' is-overdue' : '';
  return `<span class="followup-tab-badge${tone}" title="Pendientes que requieren acción">${summary.alerts}</span>`;
}

function followUpItemHTML(item, pet) {
  const actions = (item.actions || [])
    .map(action => `<button class="btn btn-sm${action.primary ? ' btn-primary' : ''}" onclick="${action.onclick}">${escapeHtml(action.label)}</button>`)
    .join('') + followUpReminderButtonHTML(pet, item);
  return `
    <div class="followup-item followup-${item.state}">
      <div class="followup-when">
        <strong>${escapeHtml(followUpWhen(item.days))}</strong>
        <small>${item.date ? formatDate(item.date) : 'A definir'}</small>
      </div>
      <div class="followup-body">
        <span class="followup-kind">${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        ${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ''}
      </div>
      ${actions ? `<div class="followup-actions">${actions}</div>` : ''}
    </div>`;
}

function renderPetFollowUp(pet) {
  const summary = petFollowUpSummary(pet);
  const headline = followUpHeadline(summary);
  const clinical = typeof canEditClinical === 'function' ? canEditClinical() : true;
  const treatment = petActiveTreatment(pet);

  return `
    <div class="followup-panel">
      <div class="followup-headline is-${headline.tone}">
        <div><strong>${escapeHtml(headline.text)}</strong>${headline.detail ? `<small>${escapeHtml(headline.detail)}</small>` : ''}</div>
        <div class="followup-chips">
          <span class="followup-chip${summary.overdue ? ' is-overdue' : ''}">${summary.overdue} vencido${summary.overdue === 1 ? '' : 's'}</span>
          <span class="followup-chip${summary.today ? ' is-today' : ''}">${summary.today} hoy</span>
          <span class="followup-chip">${summary.soon} próximo${summary.soon === 1 ? '' : 's'}</span>
        </div>
      </div>

      ${summary.open.length ? `
        <div class="section-title"><h3>Consultas sin cerrar</h3></div>
        ${summary.open.map(entry => `
          <div class="followup-item followup-open">
            <div class="followup-when"><strong>${escapeHtml(encounterStatusLabel(entry.status))}</strong><small>${formatDate(entry.date)}</small></div>
            <div class="followup-body">
              <span class="followup-kind">Consulta</span>
              <strong>${escapeHtml(entry.title || 'Sin motivo registrado')}</strong>
              ${entry.vet ? `<small>${escapeHtml(entry.vet)}</small>` : ''}
            </div>
            ${clinical ? `<div class="followup-actions"><button class="btn btn-sm btn-primary" onclick="addHistoryEntry('${pet.id}','${entry.id}')">Abrir consulta</button></div>` : ''}
          </div>`).join('')}
      ` : ''}

      <div class="section-title">
        <h3>Pendientes del paciente</h3>
        ${clinical ? `<button class="btn btn-sm" onclick="requestStudy('${pet.id}')">+ Solicitar estudio</button>` : '<span class="tag">Solo lectura</span>'}
      </div>
      ${summary.items.length
        ? summary.items.map(item => followUpItemHTML(item, pet)).join('')
        : '<div class="empty-state">No hay controles, estudios ni turnos pendientes para este paciente.</div>'}

      ${treatment ? `
        <div class="section-title" style="margin-top:18px"><h3>Indicaciones vigentes</h3></div>
        <div class="followup-treatment">
          <small>Consulta del ${formatDate(treatment.date)}${treatment.vet ? ' · ' + escapeHtml(treatment.vet) : ''}</small>
          <p>${escapeHtml(treatment.treatment).replace(/\n/g, '<br>')}</p>
          ${treatment.diagnosis ? `<small><strong>Diagnóstico:</strong> ${escapeHtml(treatment.diagnosis)}</small>` : ''}
        </div>` : ''}
    </div>`;
}

// ----------------------------------------
// Señal agregada: los pendientes de toda la veterinaria, no de un paciente.
// ----------------------------------------

// Pendientes que ya requieren acción, ordenados por urgencia y con el paciente
// al que pertenecen. Alimenta la vista Hoy.
function clinicFollowUpAlerts() {
  const rows = [];
  (db.pets || []).filter(pet => !pet.deceasedAt).forEach(pet => {
    const summary = petFollowUpSummary(pet);
    summary.items
      .filter(item => item.state === 'overdue' || item.state === 'today')
      .forEach(item => rows.push({ pet, item }));
    summary.open.forEach(entry => rows.push({
      pet,
      item: {
        kind: 'encounter',
        refId: entry.id,
        label: 'Consulta sin cerrar',
        title: entry.title || 'Sin motivo registrado',
        detail: encounterStatusLabel(entry.status),
        date: entry.date,
        days: followUpDaysUntil(entry.date),
        state: 'open'
      }
    }));
  });
  const weight = { overdue: 0, today: 1, open: 2 };
  return rows.sort((a, b) =>
    (weight[a.item.state] - weight[b.item.state]) ||
    ((a.item.days ?? 0) - (b.item.days ?? 0)) ||
    String(a.pet.name || '').localeCompare(String(b.pet.name || '')));
}

function toggleStaleFollowUpAlerts() {
  showStaleFollowUpAlerts = !showStaleFollowUpAlerts;
  render();
}

function followUpAlertItemHTML({ pet, item }) {
  // Las consultas sin cerrar no se pueden archivar: es trabajo pendiente real
  // del equipo, no un aviso vencido que se pueda decidir posponer.
  const canArchive = item.kind !== 'encounter' && item.refId;
  return `
    <div class="followup-item followup-${item.state}">
      <div class="followup-when">
        <strong>${escapeHtml(item.state === 'open' ? (item.detail || 'Sin cerrar') : followUpWhen(item.days))}</strong>
        <small>${item.date ? formatDate(item.date) : 'Sin fecha'}</small>
      </div>
      <div class="followup-body">
        <span class="followup-kind"><button type="button" class="link-inline" onclick="openPetDetail('${pet.id}')">${escapeHtml(pet.name)}</button> &middot; ${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.title)}</strong>
      </div>
      <div class="followup-actions">
        <button class="btn btn-sm" onclick="openPetDetail('${pet.id}')">Abrir ficha</button>
        ${followUpReminderButtonHTML(pet, item)}
        ${canArchive ? `<button class="btn btn-sm" title="Dejar de mostrar en Hoy; sigue en la ficha" onclick="dismissFollowUp('${item.kind}','${item.refId}')">Archivar</button>` : ''}
      </div>
    </div>`;
}

function renderTodayFollowUp(limit = 6) {
  const dismissed = loadDismissedFollowUps();
  const allRows = clinicFollowUpAlerts().filter(r => !dismissed.has(followUpDismissKey(r.item)));
  // Un vencido de hace años (típicamente historial migrado) no es "trabajo de
  // hoy": se separa para no tapar lo reciente, pero sigue disponible atrás del botón.
  const rows = allRows.filter(r => !(r.item.state === 'overdue' && -r.item.days > FOLLOWUP_STALE_DAYS));
  const staleRows = allRows.filter(r => r.item.state === 'overdue' && -r.item.days > FOLLOWUP_STALE_DAYS);

  const overdue = rows.filter(r => r.item.state === 'overdue').length;
  const today = rows.filter(r => r.item.state === 'today').length;
  const open = rows.filter(r => r.item.state === 'open').length;
  const visible = rows.slice(0, limit);
  const rest = rows.length - visible.length;

  const staleVisible = staleRows.slice(0, 20);
  const staleRest = staleRows.length - staleVisible.length;

  return `
    <div class="today-followup${rows.length ? '' : ' is-clear'}">
      <div class="today-col-head">
        <svg class="ico" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10Z"/><path d="M5.5 12.4h3l1.6-2.6 1.8 4.2 1.5-2.4h5.1"/></svg>
        <h3>Continuidad cl&iacute;nica</h3>
        <div class="followup-chips">
          <span class="followup-chip${overdue ? ' is-overdue' : ''}">${overdue} vencido${overdue === 1 ? '' : 's'}</span>
          <span class="followup-chip${today ? ' is-today' : ''}">${today} hoy</span>
          <span class="followup-chip">${open} sin cerrar</span>
        </div>
      </div>
      ${rows.length === 0
        ? '<div class="empty-state">Nada vencido ni pendiente para hoy. La continuidad cl&iacute;nica est&aacute; al d&iacute;a.</div>'
        : `<div class="today-followup-list">
            ${visible.map(followUpAlertItemHTML).join('')}
          </div>
          ${rest > 0 ? `<div class="today-followup-rest">y ${rest} pendiente${rest === 1 ? '' : 's'} m&aacute;s en las fichas</div>` : ''}`}
      ${staleRows.length > 0 ? `
        <div class="today-followup-stale">
          <button class="btn btn-sm" onclick="toggleStaleFollowUpAlerts()">
            ${showStaleFollowUpAlerts ? 'Ocultar' : 'Revisar'} ${staleRows.length} pendiente${staleRows.length === 1 ? '' : 's'} antiguo${staleRows.length === 1 ? '' : 's'} (vencido${staleRows.length === 1 ? '' : 's'} hace m&aacute;s de un a&ntilde;o)
          </button>
          ${showStaleFollowUpAlerts ? `
            <div class="today-followup-list">
              ${staleVisible.map(followUpAlertItemHTML).join('')}
            </div>
            ${staleRest > 0 ? `<div class="today-followup-rest">y ${staleRest} m&aacute;s &mdash; abr&iacute; la ficha del paciente para verlos todos</div>` : ''}
          ` : ''}
        </div>` : ''}
    </div>`;
}

// Marca compacta para el listado de pacientes.
function petAlertBadgeHTML(pet, compact) {
  const summary = petFollowUpSummary(pet);
  if (summary.overdue) {
    return `<span class="tag danger pet-alert" title="Pendientes vencidos">${summary.overdue} vencido${summary.overdue === 1 ? '' : 's'}</span>`;
  }
  if (summary.today) return '<span class="tag warning pet-alert" title="Pendientes de hoy">Hoy</span>';
  if (summary.open.length) {
    return `<span class="tag pet-alert" title="Consultas sin cerrar">${compact ? 'Sin cerrar' : summary.open.length + ' sin cerrar'}</span>`;
  }
  return '';
}

// Superficie mínima para las pruebas automatizadas del cálculo de pendientes.
globalThis.VetCareFollowUp = {
  daysUntil: followUpDaysUntil,
  state: followUpState,
  when: followUpWhen,
  items: petFollowUpItems,
  summary: petFollowUpSummary,
  headline: followUpHeadline,
  clinicAlerts: clinicFollowUpAlerts
};

// Crea el aviso del próximo control indicado en una consulta.
function createControlReminder(petId, encounterId) {
  const pet = db.pets.find(p => p.id === petId);
  const entry = pet ? (pet.history || []).find(h => h.id === encounterId) : null;
  if (!entry || !entry.nextControl) return;
  db.reminders.push({
    id: uid(),
    title: 'Control: ' + (entry.title || 'seguimiento'),
    petId,
    date: entry.nextControl,
    type: 'control',
    completed: false
  });
  saveDB('Aviso de control creado');
  render();
}
