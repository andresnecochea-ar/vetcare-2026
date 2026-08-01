function updateBadges() {
  const now = new Date(); now.setHours(0,0,0,0);
  const in7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  // Cuenta vencidos + próximos 7 días, el mismo criterio que la columna de
  // Avisos en Hoy, para que el badge y la pantalla no digan cosas distintas.
  const reminderCount = db.reminders.filter(r => !r.completed && r.date && new Date(r.date + 'T12:00:00') <= in7).length;
  const invCount = db.inventory.filter(i => invTotalStock(i) <= parseInt(i.minStock||0)).length;
  const bR = document.getElementById('badgeReminders');
  const bI = document.getElementById('badgeInventory');
  if (bR) { bR.textContent = reminderCount; bR.style.display = reminderCount > 0 ? '' : 'none'; }
  if (bI) { bI.textContent = invCount; bI.style.display = invCount > 0 ? '' : 'none'; }

  const bInv=document.getElementById('badgeInvoices');if(bInv){const pend=(db.invoices||[]).filter(i=>i.status==='pending').length;bInv.style.display=receiptsEnabled()&&pend>0?'inline':'none';bInv.textContent=pend;}
}
// limit corta el recorrido apenas hay resultados suficientes: la historia
// cl\u00ednica son 14.016 registros y el buscador se dispara mientras se escribe.
function searchInHistory(q, limit) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return [];
  const max = limit || 20;
  const results = [];
  for (const pet of db.pets) {
    if (petIsInactive(pet)) continue;
    for (const entry of pet.history || []) {
      const searchable = [
        entry.type,
        entry.title,
        entry.description,
        entry.treatment,
        entry.vet,
        pet.name
      ].filter(Boolean).join(' ').toLowerCase();
      if (searchable.includes(query)) {
        results.push({
          type: 'history',
          label: entry.title || entry.type || 'Registro cl\u00ednico',
          sub: `${petDisplayName(pet)}${entry.date ? ' \u00b7 ' + formatDate(entry.date) : ''}${entry.vet ? ' \u00b7 ' + entry.vet : ''}`,
          id: entry.id,
          petId: pet.id
        });
        if (results.length >= max) return results;
      }
    }
  }
  return results;
}

// Tope por grupo. Antes se juntaba todo en una lista y se cortaba en 10: al
// buscar un nombre frecuente los 10 lugares se los llevaban los pacientes y los
// tutores no aparecían nunca, aunque el texto buscado fuera un apellido.
const GS_PER_GROUP = 5;

let _gsTimer = null;
// Recorrer 4.734 pacientes con su historia (14.016 registros) y 3.473 tutores
// tardaba 271 ms, y se hacía en cada tecla. Con el debounce se hace una vez
// cuando la persona dejó de escribir.
function globalSearchHandler(q) {
  clearTimeout(_gsTimer);
  const dd = document.getElementById('gsDropdown');
  if (q.trim().length < 2) { dd.classList.remove('open'); return; }
  _gsTimer = setTimeout(() => _globalSearchRun(q), 180);
}

function _globalSearchRun(q) {
  const dd = document.getElementById('gsDropdown');
  if (!dd) return;
  const ql = q.trim().toLowerCase();
  if (ql.length < 2) { dd.classList.remove('open'); return; }
  const index = ownersById();

  const pets = [];
  for (const p of db.pets) {
    if (petIsInactive(p)) continue;
    if (pets.length >= GS_PER_GROUP * 4) break;
    const hay = [p.name, p.species, p.breed, ...petOwnerNames(p, index)].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes(ql)) {
      pets.push({ type: 'pet', label: petDisplayName(p), sub: petContextLine(p, index), id: p.id });
    }
  }

  const owners = [];
  for (const o of db.owners) {
    if (owners.length >= GS_PER_GROUP * 4) break;
    const hay = [o.name, o.phone, o.altPhone, o.dni, o.email].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes(ql)) {
      const petNames = db.pets.filter(p => !petIsInactive(p) && (p.ownerIds || []).includes(o.id)).map(p => petDisplayName(p));
      owners.push({
        type: 'owner',
        label: o.name,
        sub: [o.phone || o.altPhone || 'sin teléfono', petNames.slice(0, 3).join(', ') || 'sin pacientes'].join(' · '),
        id: o.id
      });
    }
  }

  const appts = [];
  for (const a of db.appointments) {
    if (appts.length >= GS_PER_GROUP * 4) break;
    const pet = db.pets.find(p => p.id === a.petId);
    const hay = [a.type, a.vet, a.date, pet ? pet.name : ''].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes(ql)) {
      appts.push({
        type: 'appt',
        label: (pet ? petDisplayName(pet) : 'Turno') + ' · ' + (a.type || 'Consulta'),
        sub: [formatDate(a.date) + (a.time ? ' ' + a.time : ''), a.vet || 'sin profesional'].join(' · '),
        id: a.id
      });
    }
  }

  const history = searchInHistory(q);

  const groups = [
    { title: 'Pacientes', rows: pets, icon: icon('paw', 'ico-sm') },
    { title: 'Tutores', rows: owners, icon: icon('users', 'ico-sm') },
    { title: 'Turnos', rows: appts, icon: icon('calendar', 'ico-sm') },
    { title: 'Historia clínica', rows: history, icon: icon('clipboard', 'ico-sm') }
  ].filter(g => g.rows.length);

  if (!groups.length) {
    dd.innerHTML = '<div class="gs-item"><span class="gs-label">Sin resultados</span></div>';
  } else {
    dd.innerHTML = groups.map(g => {
      const shown = g.rows.slice(0, GS_PER_GROUP);
      return `<div class="gs-group-label">${escapeHtml(g.title)}${g.rows.length > shown.length ? ` · ${shown.length} de ${g.rows.length}+` : ''}</div>`
        + shown.map(r => `
        <div class="gs-item" onclick="globalSearchGo('${r.type}','${r.petId || r.id}')">
          <span style="font-size:var(--fs-base)">${g.icon}</span>
          <span><span class="gs-label">${escapeHtml(r.label)}</span><br><span class="gs-sub">${escapeHtml(r.sub)}</span></span>
        </div>`).join('');
    }).join('');
  }
  dd.classList.add('open');
}

function globalSearchGo(type, id) {
  document.getElementById('gsDropdown').classList.remove('open');
  document.getElementById('globalSearch').value = '';
  if (typeof closeMobileSearch === 'function' && window.innerWidth < 769) closeMobileSearch();
  // Antes el id se descartaba y se navegaba a la lista completa: buscar
  // "PERALTA" y hacer clic dejaba al usuario arriba de 3.473 tutores.
  if (type === 'pet' || type === 'history') openPetDetail(id);
  else if (type === 'owner') openOwnerModal(id);
  else if (type === 'appt') openApptModal(id);
}

document.addEventListener('click', e => {
  if (!e.target.closest('.global-search-inner')) {
    const dd = document.getElementById('gsDropdown');
    if (dd) dd.classList.remove('open');
  }
});

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  const open = sb.classList.toggle('open');
  if (ov) ov.classList.toggle('show', open);
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const ov = document.getElementById('sidebarOverlay'); if (ov) ov.classList.remove('show');
}
function openMobileSearch() {
  document.getElementById('globalSearchWrap').classList.add('search-open');
  const inp = document.getElementById('globalSearch');
  if (inp) setTimeout(() => inp.focus(), 50);
}
function closeMobileSearch() {
  const wrap = document.getElementById('globalSearchWrap');
  wrap.classList.remove('search-open');
  const inp = document.getElementById('globalSearch');
  if (inp) inp.value = '';
  const dd = document.getElementById('gsDropdown');
  if (dd) dd.classList.remove('open');
}

function navigateTo(view) {
  if (view === 'invoices' && !receiptsEnabled()) view = 'today';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.querySelector(`[data-view="${view}"]`);
  if (el) el.classList.add('active');
  if (!['pet-detail', 'encounter'].includes(view) && typeof currentPetId !== 'undefined') currentPetId = null;
  if (view !== 'encounter' && typeof currentEncounterPetId !== 'undefined') {
    currentEncounterPetId = null;
    currentEncounterId = null;
    currentEncounterAppointmentId = null;
  }
  currentView = view;
  render();
  if(window.innerWidth<769) closeSidebar();
}

// ========================================
// [10] VISTA: HOY (TODAY)  ·  NOTA: ubicada al final del archivo por historia del proyecto
// ========================================
let todayMineOnly = false;
function toggleTodayMine(){ todayMineOnly = !todayMineOnly; render(); }

function renderToday() {
  const today = localDateKey();
  const now = new Date();
  const dayAppts = db.appointments.filter(a => a.date === today && (!todayMineOnly || appointmentMatchesCurrentUser(a)))
    .sort((a,b) => (a.time||'00:00').localeCompare(b.time||'00:00'));
  const dayGroom = db.groomingAppointments.filter(a => a.date === today)
    .sort((a,b) => (a.time||'00:00').localeCompare(b.time||'00:00'));
  const in7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  // Antes faltaba la cota inferior: un aviso sin completar de 2024 aparecía en
  // la columna rotulada "próximos 7 días". Se separan los vencidos, que no son
  // lo mismo y piden otra acción.
  const pendingReminders = db.reminders.filter(r => !r.completed);
  const overdueReminders = pendingReminders.filter(r => r.date && r.date < today)
    .sort((a,b) => String(b.date).localeCompare(String(a.date)));
  const dayReminders = pendingReminders
    .filter(r => r.date && r.date >= today && new Date(r.date + 'T12:00:00') <= in7)
    .sort((a,b) => String(a.date).localeCompare(String(b.date)));

  function apptSlot(a, cls) {
    const isClinical = !String(cls || '').includes('grooming');
    const status = isClinical ? appointmentStatusValue(a) : '';
    if (status === 'in_consultation') cls += ' current';
    const pet = db.pets.find(p=>p.id===a.petId);
    const owner = pet ? petOwners(pet)[0] : null;
    // Con dos veterinarias rotando, saber de quién es el turno es lo primero
    // que se necesita; y si el paciente no llega, hay que poder llamar al
    // tutor sin salir de la pantalla.
    const who = isClinical ? (a.vet || '') : (a.groomer || '');
    const overlaps = isClinical && typeof appointmentOverlaps === 'function' ? appointmentOverlaps(a) : [];
    if (overlaps.length) cls += ' appointment-overlap';
    const meta = [a.time || 'Sin hora', escapeHtml(a.type || a.service || 'Sin tipo'), who ? escapeHtml(who) : '']
      .filter(Boolean).join(' &middot; ');
    return `<div class="today-slot ${cls}">
      <div class="ts-info">
        <strong>${pet ? `<button type="button" class="link-inline" onclick="openPetDetail('${pet.id}')">${escapeHtml(petDisplayName(pet))}</button>` : escapeHtml('Paciente')}${isClinical ? `<span class="appointment-status ${appointmentStatusClass(status)}">${appointmentStatusLabel(status)}</span>` : ''}</strong>
        <small>${meta}${overlaps.length?' · <span class="tag danger">Superpuesto</span>':''}</small>
        ${owner ? `<small class="ts-owner"><button type="button" class="link-inline" onclick="openOwnerModal('${owner.id}')">${escapeHtml(owner.name)}</button>${owner.phone||owner.altPhone ? ` · <a class="link-inline" href="tel:${escapeAttr(telPhone(owner.phone||owner.altPhone))}">Llamar</a>` : ''}${waPhone([owner.phone, owner.altPhone]) ? ` · <a class="link-inline" href="https://wa.me/${waPhone([owner.phone, owner.altPhone])}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</small>` : ''}
      </div>
      <div class="today-slot-actions">
        ${isClinical ? appointmentPrimaryActionHTML(a, true) : ''}
        ${pet ? `<button class="btn btn-sm" onclick="openPetDetail('${pet.id}')">Ver</button>` : ''}
      </div>
    </div>`;
  }

  function reminderSlot(r, overdue) {
    const pet = r.petId ? db.pets.find(p=>p.id===r.petId) : null;
    const isToday = r.date === today;
    const days = followUpDaysUntil(r.date);
    const when = overdue ? `Vencido hace ${-days} d&iacute;a${days === -1 ? '' : 's'}` : (isToday ? 'Hoy' : formatDate(r.date));
    return `<div class="today-slot reminder${overdue ? ' is-overdue' : ''}">
      <div class="ts-info">
        <strong>${escapeHtml(r.title)}</strong>
        <small>${when}${pet ? ` · <button type="button" class="link-inline" onclick="openPetDetail('${pet.id}')">${escapeHtml(petDisplayName(pet))}</button>` : ''}</small>
      </div>
      <div class="today-slot-actions">
        <button class="btn btn-sm" onclick="completeReminder('${r.id}')" title="Marcar como hecho" aria-label="Marcar como hecho">${icon('check','ico-sm')}</button>
        ${pet ? `<button class="btn btn-sm" onclick="openPetDetail('${pet.id}')">Ver</button>` : ''}
      </div>
    </div>`;  }

  return `
    <div class="page-header">
      <div class="title"><small>${new Date().toLocaleDateString('es-ES',{weekday:'long'})}</small><h1>Hoy</h1></div>
      <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;justify-content:flex-end">
        ${defaultAttendingUserId() ? `<button class="btn btn-sm ${todayMineOnly?'btn-primary':''}" onclick="toggleTodayMine()" aria-pressed="${todayMineOnly?'true':'false'}">Mis turnos</button>` : ''}
        <div style="font-size:var(--fs-sm);color:var(--text-soft)">${new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
    </div>
    <div class="today-grid">
      <div class="today-col">
        <div class="today-col-head"><svg class="ico" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"> <rect x="4" y="4.5" width="16" height="15.5" rx="3"/> <path d="M8 3v3M16 3v3M4 8.5h16"/> <path d="M8.2 14l2.2 2.2 5.2-5.2"/> </svg><h3>Turnos clínicos</h3><span class="count">${dayAppts.length}</span></div>
        ${dayAppts.length === 0 ? '<div class="empty-state">Sin turnos para hoy</div>' : dayAppts.map(a=>apptSlot(a,'')).join('')}
      </div>
      <div class="today-col">
        <div class="today-col-head"><svg class="ico" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"> <circle cx="6.2" cy="7.4" r="2.1"/> <circle cx="6.2" cy="16.6" r="2.1"/> <path d="M8 8.6l9.8 8M8 15.4l9.8-8"/> <path d="M17.8 7.4l2.2-1.6M17.8 16.6l2.2 1.6"/> </svg><h3>Peluquería</h3><span class="count">${dayGroom.length}</span></div>
        ${dayGroom.length === 0 ? '<div class="empty-state">Sin turnos para hoy</div>' : dayGroom.map(a=>apptSlot(a,'grooming')).join('')}
      </div>
      <div class="today-col">
        <div class="today-col-head"><svg class="ico" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"> <path d="M18 10.5c0-3.5-2.2-6-6-6s-6 2.5-6 6v3.3l-1.7 2.8h15.4L18 13.8v-3.3Z"/> <path d="M10 19c.4 1 1.1 1.5 2 1.5s1.6-.5 2-1.5"/> <circle cx="18.5" cy="5.2" r="1.4"/> </svg><h3>Avisos</h3><span class="count">${dayReminders.length + overdueReminders.length}</span></div>
        ${overdueReminders.map(r=>reminderSlot(r, true)).join('')}
        ${dayReminders.map(r=>reminderSlot(r, false)).join('')}
        ${dayReminders.length + overdueReminders.length === 0 ? '<div class="empty-state">Sin avisos vencidos ni en los próximos 7 días</div>' : ''}
      </div>
    </div>
    ${renderTodayFollowUp()}
  `;
}
// Fin del script principal de VetCare
