function updateBadges() {
  const now = new Date(); now.setHours(0,0,0,0);
  const in7 = new Date(now.getTime() + 7*24*60*60*1000);
  const reminderCount = db.reminders.filter(r => !r.completed && new Date(r.date) <= in7).length;
  const invCount = db.inventory.filter(i => invTotalStock(i) <= parseInt(i.minStock||0)).length;
  const bR = document.getElementById('badgeReminders');
  const bI = document.getElementById('badgeInventory');
  if (bR) { bR.textContent = reminderCount; bR.style.display = reminderCount > 0 ? '' : 'none'; }
  if (bI) { bI.textContent = invCount; bI.style.display = invCount > 0 ? '' : 'none'; }

  const bInv=document.getElementById('badgeInvoices');if(bInv){const pend=(db.invoices||[]).filter(i=>i.status==='pending').length;bInv.style.display=pend>0?'inline':'none';bInv.textContent=pend;}
}
function globalSearchHandler(q) {
  const dd = document.getElementById('gsDropdown');
  if (q.length < 2) { dd.classList.remove('open'); return; }
  const ql = q.toLowerCase();
  const results = [];
  db.pets.forEach(p => {
    if (p.name.toLowerCase().includes(ql) || (p.species||'').toLowerCase().includes(ql) || (p.breed||'').toLowerCase().includes(ql)) {
      results.push({ type:'pet', label: p.name, sub: (p.species||'') + (p.breed ? ' · '+p.breed : ''), id: p.id });
    }
  });
  db.owners.forEach(o => {
    if (o.name.toLowerCase().includes(ql) || (o.phone||'').includes(ql)) {
      results.push({ type:'owner', label: o.name, sub: o.phone||'', id: o.id });
    }
  });
  searchInHistory(q).slice(0,5).forEach(r => results.push(r));
  db.appointments.forEach(a => {
    const pet = db.pets.find(p=>p.id===a.petId);
    const petName = pet ? pet.name : '';
    if ((a.type||'').toLowerCase().includes(ql) || petName.toLowerCase().includes(ql) || (a.date||'').includes(ql)) {
      results.push({ type:'appt', label: 'Turno: '+petName, sub: formatDate(a.date)+(a.time?' '+a.time:''), id: a.id });
    }
  });
  if (results.length === 0) {
    dd.innerHTML = '<div class="gs-item"><span class="gs-label">Sin resultados</span></div>';
  } else {
    const icons = { pet:'◉', owner:'◐', appt:'◰', history:'📋' };
    dd.innerHTML = results.slice(0,10).map(r => `
      <div class="gs-item" onclick="globalSearchGo('${r.type}','${r.petId||r.id}')">
        <span style="font-size:var(--fs-base)">${icons[r.type]}</span>
        <span><span class="gs-label">${escapeHtml(r.label)}</span><br><span class="gs-sub">${escapeHtml(r.sub)}</span></span>
      </div>`).join('');
  }
  dd.classList.add('open');
}

function globalSearchGo(type, id) {
  document.getElementById('gsDropdown').classList.remove('open');
  document.getElementById('globalSearch').value = '';
  if (type === 'pet' || type === 'history') { navigateTo('pets'); setTimeout(()=>openPetDetail(id), 50); }
  else if (type === 'owner') { navigateTo('owners'); }
  else if (type === 'appt') { navigateTo('appointments'); }
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
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.querySelector(`[data-view="${view}"]`);
  if (el) el.classList.add('active');
  currentView = view;
  render();
  if(window.innerWidth<769) closeSidebar();
}

// ========================================
// [10] VISTA: HOY (TODAY)  ·  NOTA: ubicada al final del archivo por historia del proyecto
// ========================================
function renderToday() {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const dayAppts = db.appointments.filter(a => a.date === today)
    .sort((a,b) => (a.time||'00:00').localeCompare(b.time||'00:00'));
  const dayGroom = db.groomingAppointments.filter(a => a.date === today)
    .sort((a,b) => (a.time||'00:00').localeCompare(b.time||'00:00'));
  const in7 = new Date(now.getTime() + 7*24*60*60*1000);
  const dayReminders = db.reminders.filter(r => !r.completed && new Date(r.date) <= in7)
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  function apptSlot(a, cls) {
    const slotTime = new Date(a.date + 'T' + (a.time || '00:00'));
    const diff = Math.abs(now - slotTime) / 60000;
    const isCurrent = diff <= 30;
    if (isCurrent) cls += ' current';
    const pet = db.pets.find(p=>p.id===a.petId);
    return `<div class="today-slot ${cls}">
      <div class="ts-info">
        <strong>${escapeHtml(pet ? pet.name : '—')}${isCurrent ? '<span class="current-badge">En curso</span>' : ''}</strong>
        <small>${a.time||'Sin hora'} · ${escapeHtml(a.type||a.service||'—')}</small>
      </div>
      ${pet ? `<button class="btn btn-sm" onclick="openPetDetail('${pet.id}')">Ver</button>` : ''}
    </div>`;
  }

  function reminderSlot(r) {
    const pet = r.petId ? db.pets.find(p=>p.id===r.petId) : null;
    const isToday = r.date === today;
    return `<div class="today-slot reminder">
      <div class="ts-info">
        <strong>${escapeHtml(r.title)}</strong>
        <small>${isToday ? 'Hoy' : formatDate(r.date)}${pet ? ' · '+escapeHtml(pet.name) : ''}</small>
      </div>
      ${pet ? `<button class="btn btn-sm" onclick="openPetDetail('${pet.id}')">Ver</button>` : ''}
    </div>`;  }

  return `
    <div class="page-header">
      <div class="title"><small>${new Date().toLocaleDateString('es-ES',{weekday:'long'})}</small><h1>Hoy</h1></div>
      <div style="font-size:var(--fs-sm);color:var(--text-soft)">${new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
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
        <div class="today-col-head"><svg class="ico" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"> <path d="M18 10.5c0-3.5-2.2-6-6-6s-6 2.5-6 6v3.3l-1.7 2.8h15.4L18 13.8v-3.3Z"/> <path d="M10 19c.4 1 1.1 1.5 2 1.5s1.6-.5 2-1.5"/> <circle cx="18.5" cy="5.2" r="1.4"/> </svg><h3>Avisos</h3><span class="count">${dayReminders.length}</span></div>
        ${dayReminders.length === 0 ? '<div class="empty-state">Sin avisos en los próximos 7 días</div>' : dayReminders.map(r=>reminderSlot(r)).join('')}
      </div>
    </div>
  `;
}
// Fin del script principal de VetCare
