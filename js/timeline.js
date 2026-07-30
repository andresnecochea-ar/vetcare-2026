// ========================================
// [11d] HISTORIA CLÍNICA COMO LÍNEA DE TIEMPO
// Une consultas, vacunas, estudios y controles en una sola lectura
// cronológica, con filtros y comparación entre consultas.
// ========================================

let timelineFilters = { kind: '', status: '', query: '' };
let timelineCompare = [];

function resetTimelineState() {
  timelineFilters = { kind: '', status: '', query: '' };
  timelineCompare = [];
}

const TIMELINE_KINDS = {
  encounter: 'Consulta',
  vaccine: 'Vacuna',
  study: 'Estudio',
  control: 'Control'
};

function timelineNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Un solo hilo cronológico con todo lo que le pasó al paciente.
function petTimelineEvents(pet) {
  if (!pet) return [];
  const events = [];

  (pet.history || []).forEach(entry => {
    const closed = (entry.status || 'closed') === 'closed';
    events.push({
      id: entry.id,
      kind: 'encounter',
      date: entry.date,
      title: entry.title || 'Consulta sin motivo registrado',
      subtitle: entry.type || 'Consulta',
      status: closed ? 'done' : 'open',
      statusLabel: encounterStatusLabel(entry.status),
      statusClass: encounterStatusClass(entry.status),
      diagnosis: entry.diagnosis || '',
      treatment: entry.treatment || '',
      vet: entry.vet || '',
      vitals: {
        weight: timelineNumber(entry.weight),
        temp: timelineNumber(entry.temp),
        hr: timelineNumber(entry.hr)
      },
      nextControl: entry.nextControl || '',
      comparable: true,
      source: entry
    });
  });

  (pet.vaccines || []).forEach(vaccine => {
    events.push({
      id: vaccine.id,
      kind: 'vaccine',
      date: vaccine.date,
      title: vaccine.name || 'Vacuna',
      subtitle: vaccine.nextDose ? 'Próxima dosis: ' + formatDate(vaccine.nextDose) : 'Sin próxima dosis registrada',
      status: 'done',
      statusLabel: 'Aplicada',
      statusClass: 'encounter-status-closed'
    });
  });

  (pet.studies || []).forEach(study => {
    const pending = studyIsPending(study);
    events.push({
      id: study.id,
      kind: 'study',
      date: study.date,
      title: study.title || study.type || 'Estudio',
      subtitle: study.type || 'Estudio',
      status: pending ? 'pending' : 'done',
      statusLabel: pending ? 'Pendiente' : 'Resultado disponible',
      statusClass: pending ? 'encounter-status-pending-results' : 'encounter-status-closed',
      url: study.url || ''
    });
  });

  (db.reminders || []).filter(reminder => reminder.petId === pet.id).forEach(reminder => {
    events.push({
      id: reminder.id,
      kind: 'control',
      date: reminder.date,
      title: reminder.title || 'Control',
      subtitle: reminder.notes || 'Aviso al tutor',
      status: reminder.completed ? 'done' : 'pending',
      statusLabel: reminder.completed ? 'Hecho' : followUpWhen(followUpDaysUntil(reminder.date)),
      statusClass: reminder.completed ? 'encounter-status-closed' : 'encounter-status-pending-results'
    });
  });

  return events.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function timelineMatches(event) {
  if (timelineFilters.kind && event.kind !== timelineFilters.kind) return false;
  if (timelineFilters.status === 'done' && event.status !== 'done') return false;
  if (timelineFilters.status === 'pending' && event.status === 'done') return false;
  const query = timelineFilters.query.trim().toLowerCase();
  if (query) {
    const haystack = [event.title, event.subtitle, event.diagnosis, event.treatment, event.vet]
      .filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

// Evolución del peso: la comparación más usada entre consultas.
function vitalsTrendHTML(pet) {
  const points = (pet.history || [])
    .map(entry => ({ date: entry.date, weight: timelineNumber(entry.weight) }))
    .filter(point => point.date && point.weight !== null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (points.length < 2) return '';

  const weights = points.map(p => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;
  const width = 100;
  const height = 28;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
    const y = height - ((point.weight - min) / span) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const delta = last.weight - first.weight;
  const deltaLabel = delta === 0
    ? 'sin cambios'
    : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg desde ${formatDate(first.date)}`;

  return `
    <div class="timeline-trend">
      <div class="timeline-trend-head">
        <span>Evoluci&oacute;n del peso</span>
        <strong>${last.weight} kg</strong>
        <small class="${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}">${escapeHtml(deltaLabel)}</small>
      </div>
      <svg class="timeline-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Evoluci&oacute;n del peso del paciente">
        <polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <div class="timeline-trend-foot"><span>${escapeHtml(String(min))} kg</span><span>${points.length} registros</span><span>${escapeHtml(String(max))} kg</span></div>
    </div>`;
}

function timelineEventHTML(pet, event) {
  const selected = timelineCompare.includes(event.id);
  const details = [];
  if (event.kind === 'encounter') {
    const vitals = [
      event.vitals.weight !== null ? `${event.vitals.weight} kg` : '',
      event.vitals.temp !== null ? `${event.vitals.temp} °C` : '',
      event.vitals.hr !== null ? `${event.vitals.hr} lpm` : ''
    ].filter(Boolean);
    if (vitals.length) details.push(`<div class="history-vitals">${vitals.map(v => `<span>${escapeHtml(v)}</span>`).join('')}</div>`);
    if (event.diagnosis) details.push(`<p><strong>Diagn&oacute;stico:</strong> ${escapeHtml(event.diagnosis)}</p>`);
    if (event.treatment) details.push(`<p><strong>Tratamiento:</strong> ${escapeHtml(event.treatment)}</p>`);
    if (event.nextControl) details.push(`<p class="tl-next">Pr&oacute;ximo control: ${formatDate(event.nextControl)}</p>`);
    if (event.vet) details.push(`<p class="tl-vet">${escapeHtml(event.vet)}</p>`);
  }
  if (event.kind === 'study' && event.url) {
    details.push(`<p><a href="${escapeAttr(event.url)}" target="_blank" rel="noopener">Ver resultado</a></p>`);
  }

  const actions = [];
  if (event.kind === 'encounter') {
    const receipt = encounterInvoiceActionHTML(event.id);
    if (receipt) actions.push(receipt);
    if (canEditClinical()) {
      actions.push(`<button class="btn btn-sm" onclick="addHistoryEntry('${pet.id}','${event.id}')">Abrir</button>`);
      actions.push(`<button class="btn btn-sm" onclick="printHistEntry('${pet.id}','${event.id}')">Imprimir</button>`);
      actions.push(`<button class="btn btn-sm btn-danger" onclick="deleteHistory('${pet.id}','${event.id}')" title="Eliminar consulta">${iconX()}</button>`);
    }
  }
  if (event.kind === 'study' && canEditClinical()) {
    actions.push(`<button class="btn btn-sm" onclick="editStudyLink('${pet.id}','${event.id}')">Editar</button>`);
  }

  return `
    <div class="tl-event tl-${event.kind}${selected ? ' is-selected' : ''}" data-event-id="${escapeAttr(event.id)}">
      <div class="tl-marker" aria-hidden="true"></div>
      <div class="tl-card">
        <div class="tl-head">
          <div class="tl-head-main">
            <span class="tl-kind">${escapeHtml(TIMELINE_KINDS[event.kind] || 'Registro')}</span>
            <span class="tl-date">${event.date ? formatDate(event.date) : 'Sin fecha'}</span>
          </div>
          <span class="encounter-status ${event.statusClass}">${escapeHtml(event.statusLabel)}</span>
        </div>
        <h4>${escapeHtml(event.title)}</h4>
        <div class="tl-subtitle">${escapeHtml(event.subtitle || '')}</div>
        ${details.length ? `<div class="tl-details">${details.join('')}</div>` : ''}
        ${(actions.length || event.comparable) ? `<div class="tl-actions">
          ${event.comparable ? `<label class="tl-compare"><input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleTimelineCompare('${pet.id}','${event.id}')"> Comparar</label>` : ''}
          ${actions.join('')}
        </div>` : ''}
      </div>
    </div>`;
}

function renderPetTimelineList(pet) {
  const events = petTimelineEvents(pet).filter(timelineMatches);
  if (!events.length) {
    return '<div class="empty-state">No hay registros que coincidan con el filtro.</div>';
  }
  const groups = new Map();
  events.forEach(event => {
    const year = String(event.date || '').slice(0, 4) || 'Sin fecha';
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(event);
  });
  return [...groups.entries()].map(([year, list]) => `
    <div class="tl-group">
      <div class="tl-year">${escapeHtml(year)}<span>${list.length} registro${list.length === 1 ? '' : 's'}</span></div>
      ${list.map(event => timelineEventHTML(pet, event)).join('')}
    </div>`).join('');
}

function renderPetTimeline(pet) {
  const total = petTimelineEvents(pet).length;
  const chip = (value, label) => `<button class="tl-chip${timelineFilters.kind === value ? ' is-active' : ''}" onclick="setTimelineFilter('kind','${value}')">${label}</button>`;

  return `
    <div class="section-title">
      <h3>Historia cl&iacute;nica</h3>
      ${canEditClinical() ? `<button class="btn btn-sm btn-primary" onclick="addHistoryEntry('${pet.id}')">+ Nueva consulta</button>` : '<span class="tag">Solo lectura</span>'}
    </div>
    ${total === 0
      ? '<div class="empty-state">Sin registros a&uacute;n</div>'
      : `${vitalsTrendHTML(pet)}
        <div class="timeline-toolbar">
          <div class="tl-chips">
            ${chip('', 'Todo')}
            ${chip('encounter', 'Consultas')}
            ${chip('vaccine', 'Vacunas')}
            ${chip('study', 'Estudios')}
            ${chip('control', 'Controles')}
          </div>
          <div class="tl-filters">
            <select aria-label="Estado" onchange="setTimelineFilter('status',this.value)">
              <option value="" ${timelineFilters.status === '' ? 'selected' : ''}>Todos los estados</option>
              <option value="done" ${timelineFilters.status === 'done' ? 'selected' : ''}>Resueltos</option>
              <option value="pending" ${timelineFilters.status === 'pending' ? 'selected' : ''}>Abiertos o pendientes</option>
            </select>
            <input type="search" placeholder="Buscar en la historia" value="${escapeAttr(timelineFilters.query)}" oninput="setTimelineFilter('query',this.value)" aria-label="Buscar en la historia">
          </div>
        </div>
        <div id="timelineCompareBar">${timelineCompareBarHTML(pet)}</div>
        <div class="timeline" id="petTimeline">${renderPetTimelineList(pet)}</div>`}
  `;
}

function timelineCompareBarHTML(pet) {
  if (!timelineCompare.length) return '';
  const ready = timelineCompare.length === 2;
  return `
    <div class="tl-compare-bar">
      <span>${timelineCompare.length} consulta${timelineCompare.length === 1 ? '' : 's'} seleccionada${timelineCompare.length === 1 ? '' : 's'}${ready ? '' : ' · eleg&iacute; otra para comparar'}</span>
      <div>
        <button class="btn btn-sm" onclick="clearTimelineCompare('${pet.id}')">Limpiar</button>
        <button class="btn btn-sm btn-primary" ${ready ? '' : 'disabled'} onclick="openEncounterComparison('${pet.id}')">Comparar</button>
      </div>
    </div>`;
}

function refreshTimeline(petId) {
  const pet = db.pets.find(p => p.id === petId);
  if (!pet) return;
  const list = document.getElementById('petTimeline');
  if (list) list.innerHTML = renderPetTimelineList(pet);
  const bar = document.getElementById('timelineCompareBar');
  if (bar) bar.innerHTML = timelineCompareBarHTML(pet);
  document.querySelectorAll('.tl-chip').forEach(chip => {
    const value = (chip.getAttribute('onclick') || '').match(/'kind','([^']*)'/)?.[1] ?? '';
    chip.classList.toggle('is-active', value === timelineFilters.kind);
  });
}

function setTimelineFilter(kind, value) {
  timelineFilters[kind] = value;
  refreshTimeline(currentPetId);
}

// Marca la selección sin rearmar la lista: comparar dos consultas lejanas no
// debe mover el scroll.
function syncTimelineSelection(petId) {
  document.querySelectorAll('.tl-event[data-event-id]').forEach(element => {
    const selected = timelineCompare.includes(element.getAttribute('data-event-id'));
    element.classList.toggle('is-selected', selected);
    const box = element.querySelector('.tl-compare input');
    if (box) box.checked = selected;
  });
  const bar = document.getElementById('timelineCompareBar');
  const pet = db.pets.find(p => p.id === petId);
  if (bar && pet) bar.innerHTML = timelineCompareBarHTML(pet);
}

function toggleTimelineCompare(petId, encounterId) {
  const index = timelineCompare.indexOf(encounterId);
  if (index > -1) timelineCompare.splice(index, 1);
  else {
    timelineCompare.push(encounterId);
    // Comparamos de a dos: la selección más vieja deja lugar a la nueva.
    if (timelineCompare.length > 2) timelineCompare.shift();
  }
  syncTimelineSelection(petId);
}

function clearTimelineCompare(petId) {
  timelineCompare = [];
  syncTimelineSelection(petId);
}

// Filas de la comparación, con la diferencia numérica ya calculada.
function encounterComparisonRows(older, newer) {
  const numeric = (entry, field) => timelineNumber(entry[field]);
  const rows = [
    { label: 'Fecha', older: older.date ? formatDate(older.date) : '—', newer: newer.date ? formatDate(newer.date) : '—' },
    { label: 'Tipo', older: older.type || '—', newer: newer.type || '—' },
    { label: 'Motivo', older: older.title || '—', newer: newer.title || '—' },
    { label: 'Profesional', older: older.vet || '—', newer: newer.vet || '—' },
  ];
  [['Peso', 'weight', 'kg'], ['Temperatura', 'temp', '°C'], ['FC', 'hr', 'lpm']].forEach(([label, field, unit]) => {
    const a = numeric(older, field);
    const b = numeric(newer, field);
    const delta = (a !== null && b !== null) ? Number((b - a).toFixed(2)) : null;
    rows.push({
      label,
      older: a !== null ? `${a} ${unit}` : '—',
      newer: b !== null ? `${b} ${unit}` : '—',
      delta,
      deltaLabel: delta === null ? '' : delta === 0 ? 'sin cambios' : `${delta > 0 ? '+' : ''}${delta} ${unit}`
    });
  });
  [['Diagnóstico', 'diagnosis'], ['Tratamiento', 'treatment'], ['Examen físico', 'exam'], ['Observaciones', 'description']].forEach(([label, field]) => {
    rows.push({ label, older: older[field] || '—', newer: newer[field] || '—', long: true });
  });
  return rows;
}

function openEncounterComparison(petId) {
  const pet = db.pets.find(p => p.id === petId);
  if (!pet || timelineCompare.length !== 2) return;
  const selected = timelineCompare
    .map(id => (pet.history || []).find(entry => entry.id === id))
    .filter(Boolean)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  if (selected.length !== 2) { toast('No se encontraron las consultas a comparar', 'error'); return; }
  const [older, newer] = selected;
  const rows = encounterComparisonRows(older, newer);

  showModal(`
    <div class="modal-header">
      <div><div class="page-eyebrow">Historia cl&iacute;nica</div><h2>Comparar consultas de ${escapeHtml(pet.name)}</h2></div>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="table-wrap comparison-table">
        <table>
          <thead><tr><th>Dato</th><th>${escapeHtml(older.date ? formatDate(older.date) : 'Anterior')}</th><th>${escapeHtml(newer.date ? formatDate(newer.date) : 'Posterior')}</th><th>Cambio</th></tr></thead>
          <tbody>
            ${rows.map(row => `
              <tr class="${row.long ? 'is-long' : ''}">
                <th scope="row">${escapeHtml(row.label)}</th>
                <td>${escapeHtml(String(row.older))}</td>
                <td>${escapeHtml(String(row.newer))}</td>
                <td class="${row.delta > 0 ? 'is-up' : row.delta < 0 ? 'is-down' : ''}">${escapeHtml(row.deltaLabel || '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cerrar</button>
    </div>
  `, true);
}

// Superficie mínima para las pruebas automatizadas de la línea de tiempo.
globalThis.VetCareTimeline = {
  events: petTimelineEvents,
  comparison: encounterComparisonRows,
  setFilters: (filters) => { timelineFilters = { kind: '', status: '', query: '', ...filters }; },
  matches: timelineMatches
};
