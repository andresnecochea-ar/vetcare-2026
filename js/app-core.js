function startApp() {
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('appShell').classList.remove('is-hidden');
  document.getElementById('globalSearchWrap').style.display = 'flex';
  if(!db.invoices)db.invoices=[];
  applyTheme(); render(); updateBadges();
}


// ========================================
// [06] UTILS — helpers de uso general
// (formatDate, calcAge, cleanPhone, escapeHtml, escapeAttr están en su bloque más abajo)
// ========================================
function uid(){try{return crypto.randomUUID();}catch(e){return Date.now().toString(36)+Math.random().toString(36).substr(2,9);}}
// Devuelve YYYY-MM-DD usando el calendario local. Los campos date de la app
// representan días de la clínica, no instantes UTC.
function localDateKey(value) {
  const date = value === undefined ? new Date() : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
// Icono X (cerrar/eliminar/limpiar) del pack de iconos VetCare.
function iconX(em){ em = em || 1; return '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:'+em+'em;height:'+em+'em;vertical-align:-.12em"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>'; }

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function exportVetcare(type) {
  type = type || 'full';
  const meta = { _meta: {
    app: 'VetCare', version: '2.0',
    exportDate: new Date().toISOString(), type: type,
    structure: {
      pets: 'id, name, species, breed, sex, color, birthdate, weight, microchip, ownerIds[], allergies, conditions, notes, photo, images[], studies[], history[], vaccines[]',
      owners: 'id, name, relationship, phone, email, address, docId, notes',
      appointments: 'id, petId, date, time, type, vet, notes, status, duration, checkedInAt, startedAt, completedAt',
      groomingAppointments: 'id, petId, date, time, status, reminder, notes',
      reminders: 'id, petId, title, date, type, completed',
      inventory: 'id, name, category, stock, minStock, unit, notes',
      invoices: 'id, ownerId, petId, date, status, items[], total, notes, number',
      clinicName: 'Nombre de la clinica',
      settings: 'Preferencias de la aplicacion'
    }
  }};
  const data = (type === 'lite')
    ? { ...db, pets: db.pets.map(p => ({...p, images:[]})), ...meta }
    : { ...db, ...meta };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (db.clinicName || 'vetcare').toLowerCase().replace(/\s+/g, '-') + '-' + localDateKey() + '.vetcare';
  a.click(); URL.revokeObjectURL(url);
  toast('Archivo .vetcare exportado');
}

// ========================================
// [07] THEME
// ========================================
function applyTheme() {
  document.documentElement.setAttribute('data-theme', db.settings.theme);
  var ic = document.getElementById('themeIcon');
  var lb = document.getElementById('themeLabel');
  if (ic) ic.textContent = db.settings.theme === 'dark' ? '☀' : '☾';
  if (lb) lb.textContent = db.settings.theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro';
}
function toggleTheme() {
  db.settings.theme = db.settings.theme === 'dark' ? 'light' : 'dark';
  saveDB();
  applyTheme();
}

// ========================================
// [08] NAVIGATION / RENDER — router de vistas
// ========================================
let currentView = 'today';
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.view));
});

function render() {
  const main = document.getElementById('mainContent');
  updateBadges();
  switch (currentView) {
    case 'today': main.innerHTML = renderToday(); break;
    case 'dashboard': main.innerHTML = renderDashboard(); break;
    case 'pets': main.innerHTML = renderPets(); attachPetListeners(); break;
    case 'pet-detail': main.innerHTML = renderPetDetail(currentPetId); break;
    case 'encounter': main.innerHTML = renderEncounter(); break;
    case 'owners': main.innerHTML = renderOwners(); break;
    case 'appointments': main.innerHTML = renderAppointments(); break;
    case 'grooming': main.innerHTML = renderGrooming(); break;
    case 'calendar': main.innerHTML = renderCalendar(); attachCalendarListeners(); break;
    case 'reminders': main.innerHTML = renderReminders(); break;
    case 'birthdays': main.innerHTML = renderBirthdays(); break;
    case 'inventory': main.innerHTML = renderInventory(); break;
    case 'invoices': main.innerHTML = renderInvoices(); break;
    case 'backup': main.innerHTML = renderBackup(); break;
  }
}

// ========================================
// [09] VISTA: DASHBOARD
// ========================================
