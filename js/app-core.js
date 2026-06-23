function startApp() {
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('appShell').classList.remove('is-hidden');
  document.getElementById('globalSearchWrap').style.display = 'flex';
  if(!db.invoices)db.invoices=[];
  applyTheme(); render(); updateBadges();
  saveDB();
}


// ========================================
// [06] UTILS — helpers de uso general
// (formatDate, calcAge, cleanPhone, escapeHtml, escapeAttr están en su bloque más abajo)
// ========================================
function uid(){try{return crypto.randomUUID();}catch(e){return Date.now().toString(36)+Math.random().toString(36).substr(2,9);}}

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
      appointments: 'id, petId, date, time, type, vet, notes',
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
  a.download = (db.clinicName || 'vetcare').toLowerCase().replace(/\s+/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.vetcare';
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
