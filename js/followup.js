// ========================================
// [11c] SEGUIMIENTO CLÍNICO — qué debe suceder después de la consulta
// Deriva pendientes del paciente (controles, estudios solicitados, vacunas,
// turnos y consultas sin cerrar) a partir de los datos que ya existen.
// ========================================

const FOLLOWUP_HORIZON_DAYS = 90;
const FOLLOWUP_SOON_DAYS = 30;

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

  (pet.vaccines || []).forEach(vaccine => {
    if (!vaccine.nextDose) return;
    const days = followUpDaysUntil(vaccine.nextDose);
    if (days === null || days > FOLLOWUP_HORIZON_DAYS) return;
    items.push({
      kind: 'vaccine',
      label: 'Próxima dosis',
      title: vaccine.name || 'Vacuna',
      detail: 'Última aplicación: ' + formatDate(vaccine.date),
      date: vaccine.nextDose,
      days,
      state: followUpState(days),
      actions: clinical ? [{ label: 'Registrar aplicación', onclick: `addVaccine('${pet.id}')` }] : []
    });
  });

  (db.appointments || [])
    .filter(a => a.petId === pet.id && a.date >= localDateKey() && !appointmentIsTerminal(a))
    .forEach(appointment => {
      const days = followUpDaysUntil(appointment.date);
      if (days === null || days > FOLLOWUP_HORIZON_DAYS) return;
      items.push({
        kind: 'appointment',
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

function followUpItemHTML(item) {
  const actions = (item.actions || [])
    .map(action => `<button class="btn btn-sm${action.primary ? ' btn-primary' : ''}" onclick="${action.onclick}">${escapeHtml(action.label)}</button>`)
    .join('');
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
        ? summary.items.map(followUpItemHTML).join('')
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

// Superficie mínima para las pruebas automatizadas del cálculo de pendientes.
globalThis.VetCareFollowUp = {
  daysUntil: followUpDaysUntil,
  state: followUpState,
  when: followUpWhen,
  items: petFollowUpItems,
  summary: petFollowUpSummary,
  headline: followUpHeadline
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
