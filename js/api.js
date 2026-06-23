/* =====================================================================
   ÍNDICE DEL JAVASCRIPT
   Buscá "[NN]" para saltar a cada sección.
   ---------------------------------------------------------------------
   [01] DATA STORE ............ modelo de datos en memoria (defaultData, db)
   [02] PALETA JS ............. colores para los gráficos (Chart.js)
   [03] PERSISTENCIA .......... IndexedDB: openIDB, saveDB, loadIDB
   [04] IMPORT / EXPORT ....... archivo .vetcare (loadFromFile, exportVetcare)
   [05] BOOT .................. arranque de la app (startApp, createNewDB)
   [06] UTILS ................. helpers: uid, toast, formatDate, escapeHtml…
   [07] THEME ................. modo claro / oscuro
   [08] NAVIGATION / RENDER ... navigateTo, render (router de vistas)
   [09] VISTA: DASHBOARD
   [10] VISTA: HOY (TODAY)
   [11] VISTA: PACIENTES (PETS) + FICHA (PET DETAIL)
   [12] VISTA: TUTORES (OWNERS)
   [13] VISTA: TURNOS (APPOINTMENTS)
   [14] VISTA: PELUQUERÍA (GROOMING)
   [15] VISTA: CALENDARIO (CALENDAR)
   [16] VISTA: AVISOS (REMINDERS)
   [17] VISTA: CUMPLEAÑOS (BIRTHDAYS)
   [18] VISTA: INVENTARIO (INVENTORY)
   [19] VISTA: FACTURACIÓN (INVOICES)
   [20] VISTA: RESPALDO (BACKUP)
   [21] BÚSQUEDA GLOBAL + BADGES
   [22] MODAL HELPERS ......... showModal, closeModal
   [23] SEED DEMO ............. datos de ejemplo (solo primer arranque)
   [24] INIT .................. punto de entrada (initApp)
   ===================================================================== */

// ========================================
// [01] DATA STORE - en memoria (sin localStorage)
// ========================================

const defaultData = {
  pets: [],
  owners: [],
  appointments: [],
  groomingAppointments: [],
  reminders: [],
  inventory: [],
  invoices: [],
  clinicName: 'VetCare',
  settings: { theme: 'light', clinicName: '', receiptAddress: '', receiptPhone: '', receiptTaxId: '' }
};

let db = JSON.parse(JSON.stringify(defaultData));


// ========================================
// [02] PALETA JS (sincronizada con las variables CSS) — violeta cálida
// Colores usados por los gráficos. La paleta visual está en el <style> (:root).
// ========================================
const PALETTE = { navy:'#6F2DBD', lilac:'#A663CC', mint:'#F4B860', coral:'#e5484d' };


// ========================================
// [03-API] BACKEND — Cloudflare Worker + D1 (fuente de verdad central)
// ========================================
const API_BASE = 'https://vetcare-api.vetcare-neco.workers.dev';
let authToken = null;
let currentUser = null;
try { authToken = localStorage.getItem('vetcare_token') || null; } catch(e){}
function apiConfigured(){ return API_BASE && !API_BASE.startsWith('PEGAR_AQUI'); }
async function api(path, opts){
  opts = opts || {};
  const headers = { 'Content-Type':'application/json' };
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
  const res = await fetch(API_BASE + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let data = null; try { data = await res.json(); } catch(e){}
  if (res.status === 401) { clearSession(); showLogin(); throw new Error('Sesion expirada'); }
  if (!res.ok) throw new Error((data && data.error) || ('Error ' + res.status));
  return data;
}
function setSession(token, user){ authToken = token; currentUser = user; try { localStorage.setItem('vetcare_token', token); } catch(e){} }
function clearSession(){ authToken = null; currentUser = null; try { localStorage.removeItem('vetcare_token'); } catch(e){} }
async function apiLogin(email, password){ const d = await api('/api/login', { method:'POST', body:{ email, password } }); setSession(d.token, d.user); return d.user; }
async function apiRegister(email, password, name, inviteCode){ return api('/api/register', { method:'POST', body:{ email, password, name, inviteCode } }); }
async function apiLogout(){ try { await api('/api/logout', { method:'POST' }); } catch(e){} clearSession(); }
async function loadFromAPI(){ const d = await api('/api/data'); db = Object.assign(JSON.parse(JSON.stringify(defaultData)), d); if (!db.invoices) db.invoices = []; return true; }
// ========================================
// [03] PERSISTENCIA — IndexedDB (respaldo offline local)
// ========================================
const IDB_NAME='vetcare',IDB_VER=1;let idb=null;
function openIDB(){return new Promise(res=>{
  try {
    const r=indexedDB.open(IDB_NAME,IDB_VER);
    r.onupgradeneeded=e=>{const d=e.target.result;
      ['pets','owners','appointments','groomingAppointments','reminders','inventory','invoices']
      .forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'});});
      if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'});};
    r.onsuccess=e=>{idb=e.target.result;res(idb);};
    r.onerror=()=>{idb=null;res(null);};
    r.onblocked=()=>{idb=null;res(null);};
  } catch(e){idb=null;res(null);}
})}

async function idbAll(s){return new Promise(res=>{
  if(!idb){res([]);return;}
  const r=idb.transaction(s,'readonly').objectStore(s).getAll();
  r.onsuccess=()=>res(r.result||[]);r.onerror=()=>res([]);});}

let _syncTimer=null,_syncing=false,_syncAgain=false,_lastSnapshot={};
const _ENTITY_TABLES=['owners','pets','appointments','groomingAppointments','reminders','inventory','invoices'];
function _snap(){return JSON.parse(JSON.stringify({owners:db.owners,pets:db.pets,appointments:db.appointments,groomingAppointments:db.groomingAppointments,reminders:db.reminders,inventory:db.inventory,invoices:db.invoices}));}
async function syncToAPI(){
  if(!apiConfigured()||!authToken)return;
  if(_syncing){_syncAgain=true;return;}
  _syncing=true;
  try{
    for(const t of _ENTITY_TABLES){
      const cur=db[t]||[]; const prev=_lastSnapshot[t]||[]; const curIds=new Set(cur.map(x=>x.id));
      for(const item of cur){ if(item&&item.id) await api('/api/'+t,{method:'POST',body:item}); }
      for(const old of prev){ if(old&&old.id&&!curIds.has(old.id)) await api('/api/'+t+'/'+old.id,{method:'DELETE'}); }
    }
    _lastSnapshot=_snap();
  }catch(e){ console.warn('Sync API fallo:',e); toast('⚠ No se pudo guardar en el servidor'); }
  finally{ _syncing=false; if(_syncAgain){_syncAgain=false;syncToAPI();} }
}
async function saveDB(){
  saveIDB();
  if(!apiConfigured()||!authToken)return;
  clearTimeout(_syncTimer); _syncTimer=setTimeout(syncToAPI,600);
}
async function saveIDB(){
  if(!idb)return;
  try {
    const stores=['pets','owners','appointments','groomingAppointments','reminders','inventory','invoices'];
    for(const s of stores){
      try {
        const arr=db[s]||[];const tx=idb.transaction(s,'readwrite');const os=tx.objectStore(s);
        os.clear();for(const item of arr){if(item&&item.id)os.put(item);}
        await new Promise(r=>{tx.oncomplete=r;tx.onerror=r;});
      } catch(e){}
    }
    try {
      const mt=idb.transaction('meta','readwrite');
      mt.objectStore('meta').put({key:'clinicName',value:db.clinicName||'VetCare'});
      mt.objectStore('meta').put({key:'settings',value:db.settings||{theme:'light'}});
      await new Promise(r=>{mt.oncomplete=r;mt.onerror=r;});
    } catch(e){}
  } catch(e){}
}

async function loadIDB(){
  if(!idb)return false;
  try {
    const stores=['pets','owners','appointments','groomingAppointments','reminders','inventory','invoices'];
    let has=false;
    for(const s of stores){
      try {const items=await idbAll(s);db[s]=items;if(items.length)has=true;}
      catch(e){db[s]=db[s]||[];}
    }
    try {
      const meta=await idbAll('meta');
      meta.forEach(m=>{if(m.key==='clinicName')db.clinicName=m.value;
        if(m.key==='settings')db.settings=m.value;});
    } catch(e){}
    return has;
  } catch(e){return false;}
}


// ========================================
// [04] IMPORT / EXPORT — archivo .vetcare
// ========================================
function loadFromFile(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      delete imported._meta;
      db = { ...JSON.parse(JSON.stringify(defaultData)), ...imported };
      if (!db.invoices) db.invoices = [];
      startApp();
      await saveDB();
      toast('Archivo .vetcare cargado y guardado en IndexedDB ✓');
    } catch(err) {
      alert('El archivo no es un .vetcare válido. Verificalo.');
    }
  };
  reader.readAsText(file);
}

// ========================================
// [05] BOOT — arranque de la app
// ========================================
async function createNewDB() {
  db = JSON.parse(JSON.stringify(defaultData));
  // Limpiar IDB si existe
  if (idb) {
    try {
      const stores = ['pets','owners','appointments','groomingAppointments','reminders','inventory','invoices','meta'];
      for (const s of stores) {
        try { const tx=idb.transaction(s,'readwrite'); tx.objectStore(s).clear(); await new Promise(r=>{tx.oncomplete=r;tx.onerror=r;}); } catch(e){}
      }
    } catch(e){}
  }
  startApp();
  toast('Nueva base de datos creada ✓');
}

