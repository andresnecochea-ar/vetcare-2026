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
  settings: { theme: 'light', clinicName: '', receiptsEnabled: true, receiptAddress: '', receiptPhone: '', receiptTaxId: '' }
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
const API_BASE = String(window.VETCARE_CONFIG?.apiBase || '').replace(/\/+$/, '');
let authToken = null;
let currentUser = null;
try { authToken = localStorage.getItem('vetcare_token') || null; } catch(e){}
function apiConfigured(){ return API_BASE && !API_BASE.startsWith('PEGAR_AQUI'); }
const ROLE_LABELS = { admin:'Administrador', veterinarian:'Veterinario/a', reception:'Recepción' };
function currentRole(){ return currentUser&&currentUser.role ? currentUser.role : (apiConfigured()?'reception':'admin'); }
function roleLabel(role){ return ROLE_LABELS[role] || 'Recepción'; }
function isAdmin(){ return !apiConfigured() || currentRole()==='admin'; }
function canWriteEntity(entity){
  if(!apiConfigured()||currentRole()==='admin')return true;
  const allowed=currentRole()==='veterinarian'
    ?['owners','pets','appointments','groomingAppointments','reminders','inventory','invoices']
    :['owners','pets','appointments','groomingAppointments','reminders','invoices'];
  return allowed.includes(entity);
}
function canDeleteEntity(entity){
  return !apiConfigured()||currentRole()==='admin'
    ||['appointments','groomingAppointments','reminders'].includes(entity);
}
function canEditClinical(){ return !apiConfigured()||currentRole()==='admin'||currentRole()==='veterinarian'; }
function canManageSettings(){ return !apiConfigured()||currentRole()==='admin'; }
async function api(path, opts){
  opts = opts || {};
  const headers = { 'Content-Type':'application/json' };
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
  const res = await fetch(API_BASE + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let data = null; try { data = await res.json(); } catch(e){}
  if (res.status === 401) { clearSession(); showLogin(); throw new Error('Sesion expirada'); }
  if (!res.ok) {
    const error = new Error((data && data.error) || ('Error ' + res.status));
    error.status = res.status;
    error.details = data;
    throw error;
  }
  return data;
}
function setSession(token, user){ authToken = token; currentUser = user; try { localStorage.setItem('vetcare_token', token); } catch(e){} }
function clearSession(){
  authToken = null;
  currentUser = null;
  try { localStorage.removeItem('vetcare_token'); } catch(e){}
  if(typeof _clearRetryTimer==='function')_clearRetryTimer();
  if(typeof _syncTimer!=='undefined')clearTimeout(_syncTimer);
}
async function apiLogin(email, password){ const d = await api('/api/login', { method:'POST', body:{ email, password } }); setSession(d.token, d.user); return d.user; }
async function apiRegister(email, password, name, inviteCode){ return api('/api/register', { method:'POST', body:{ email, password, name, inviteCode } }); }
async function apiLogout(){ try { await api('/api/logout', { method:'POST' }); } catch(e){} clearSession(); }
function restoreDerivedVitals(pet) {
  const byDate = new Map();
  for (const entry of pet.history || []) {
    if (!entry.date || (!entry.weight && !entry.temp)) continue;
    const current = byDate.get(entry.date) || { date: entry.date, weight: null, temp: null };
    const weight = Number.parseFloat(entry.weight);
    const temp = Number.parseFloat(entry.temp);
    if (Number.isFinite(weight)) current.weight = weight;
    if (Number.isFinite(temp)) current.temp = temp;
    byDate.set(entry.date, current);
  }
  pet.vitals = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
async function loadFromAPI(){
  const d = await api('/api/data');
  db = Object.assign(JSON.parse(JSON.stringify(defaultData)), d);
  if (!db.invoices) db.invoices = [];
  for (const pet of db.pets || []) restoreDerivedVitals(pet);
  _lastSnapshot = _snap();
  _markSyncConfirmed();
  return true;
}
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
let _syncRetryTimer=null,_syncRetryAttempt=0,_syncContext=null,_syncError=null;
let _syncState=apiConfigured()?'saved':'local';
let _lastSyncAt=null;
let _pendingSaveMessages=[];
try { _lastSyncAt=localStorage.getItem('vetcare_last_sync')||null; } catch(e){}
const _ENTITY_TABLES=['owners','pets','appointments','groomingAppointments','reminders','inventory','invoices'];
function _snap(){return JSON.parse(JSON.stringify({owners:db.owners,pets:db.pets,appointments:db.appointments,groomingAppointments:db.groomingAppointments,reminders:db.reminders,inventory:db.inventory,invoices:db.invoices,clinicName:db.clinicName,settings:db.settings}));}
function _sameSnapshotValue(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function _cloneSyncValue(value){return JSON.parse(JSON.stringify(value));}
function _browserOnline(){return typeof navigator==='undefined'||navigator.onLine!==false;}
function _syncView(retryDelayMs){return VetCareSync.view(_syncState,{context:_syncContext,retryDelayMs:retryDelayMs||0,lastSyncAt:_lastSyncAt});}
function _syncTimeLabel(){
  if(!_lastSyncAt)return '';
  const value=new Date(_lastSyncAt);
  return Number.isNaN(value.getTime())?'':'· '+value.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
}
function _renderSyncState(retryDelayMs){
  const view=_syncView(retryDelayMs);
  const status=document.getElementById('syncStatus');
  if(status){
    status.className='sync-status sync-status-'+_syncState;
    status.title=view.detail+(_lastSyncAt?' Última sincronización: '+new Date(_lastSyncAt).toLocaleString('es-AR')+'.':'');
    status.setAttribute('aria-label',view.label+'. '+status.title);
  }
  const label=document.getElementById('syncStatusLabel');
  if(label)label.textContent=view.label;
  const time=document.getElementById('syncStatusTime');
  if(time)time.textContent=_syncTimeLabel();
  const summary=document.getElementById('syncSummary');
  if(summary){summary.className='sync-summary sync-summary-'+_syncState;summary.textContent=view.label;}
  const detail=document.getElementById('syncSummaryDetail');
  if(detail)detail.textContent=view.detail;
  const last=document.getElementById('syncSummaryLast');
  if(last)last.textContent=_lastSyncAt?'Última sincronización confirmada: '+new Date(_lastSyncAt).toLocaleString('es-AR'):'Todavía no hay una sincronización confirmada.';
}
function _setSyncState(state,context,retryDelayMs){
  _syncState=state;
  if(context!==undefined)_syncContext=context;
  _renderSyncState(retryDelayMs);
}
function getSyncStatus(){
  const view=_syncView();
  return {state:_syncState,label:view.label,detail:view.detail,lastSyncAt:_lastSyncAt,retryable:view.retryable,context:_syncContext};
}
function _markSyncConfirmed(){
  _lastSyncAt=new Date().toISOString();
  try { localStorage.setItem('vetcare_last_sync',_lastSyncAt); } catch(e){}
  _syncRetryAttempt=0;_syncError=null;_syncContext=null;
  _setSyncState('saved',null);
}
function _queueSaveMessage(message){
  if(message&&!_pendingSaveMessages.includes(message))_pendingSaveMessages.push(message);
}
function _flushSaveMessages(target){
  if(!_pendingSaveMessages.length)return;
  const messages=_pendingSaveMessages.splice(0);
  const suffix=target==='cloud'?' · Guardado en la nube':' · Guardado local';
  toast(messages.length===1?messages[0]+suffix:messages.length+' cambios guardados'+(target==='cloud'?' en la nube':' en este equipo'));
}
function _snapshotUpsert(table,item){
  const items=_lastSnapshot[table]||[];
  const index=items.findIndex(existing=>existing&&existing.id===item.id);
  if(index===-1)items.push(_cloneSyncValue(item));else items[index]=_cloneSyncValue(item);
  _lastSnapshot[table]=items;
}
function _snapshotDelete(table,id){_lastSnapshot[table]=(_lastSnapshot[table]||[]).filter(item=>item&&item.id!==id);}
function _hasPendingChanges(){
  for(const table of _ENTITY_TABLES){
    if(!_sameSnapshotValue(db[table]||[],_lastSnapshot[table]||[]))return true;
  }
  if(canManageSettings()){
    const next={clinicName:db.clinicName||'VetCare',settings:db.settings||{}};
    const prev={clinicName:_lastSnapshot.clinicName||'VetCare',settings:_lastSnapshot.settings||{}};
    if(!_sameSnapshotValue(next,prev))return true;
  }
  return false;
}
function _clearRetryTimer(){if(_syncRetryTimer){clearTimeout(_syncRetryTimer);_syncRetryTimer=null;}}
function _scheduleSyncRetry(){
  _clearRetryTimer();
  const delay=VetCareSync.retryDelay(_syncRetryAttempt++);
  _setSyncState(_browserOnline()?'error':'offline',_syncContext,delay);
  _syncRetryTimer=setTimeout(()=>{_syncRetryTimer=null;syncToAPI();},delay);
}
async function syncToAPI(){
  if(!apiConfigured()||!authToken){_setSyncState('local',null);return true;}
  if(!_browserOnline()){_setSyncState('offline',_syncContext);return false;}
  if(_syncing){_syncAgain=true;return false;}
  _clearRetryTimer();
  _syncing=true;
  _setSyncState('saving',_syncContext);
  let canonicalDataChanged=false;
  let succeeded=false;
  try{
    for(const t of _ENTITY_TABLES){
      const cur=db[t]||[];const prev=_lastSnapshot[t]||[];const curIds=new Set(cur.map(x=>x.id));
      const prevById=new Map(prev.filter(x=>x&&x.id).map(x=>[x.id,x]));
      for(const item of cur){
        if(!item||!item.id||_sameSnapshotValue(item,prevById.get(item.id)))continue;
        const payload=_cloneSyncValue(item);
        _syncContext={table:t,id:item.id,operation:prevById.has(item.id)?'update':'create'};
        _setSyncState('saving',_syncContext);
        const saved=await api('/api/'+t,{method:'POST',body:payload});
        if(t==='pets'&&saved&&Number.isInteger(saved.revision)){
          item.revision=saved.revision;payload.revision=saved.revision;canonicalDataChanged=true;
        }
        if(t==='invoices'&&saved&&saved.number&&item.number!==saved.number){
          item.number=saved.number;payload.number=saved.number;canonicalDataChanged=true;
        }
        _snapshotUpsert(t,payload);
      }
      for(const old of prev){
        if(!old||!old.id||curIds.has(old.id))continue;
        _syncContext={table:t,id:old.id,operation:'delete'};
        _setSyncState('saving',_syncContext);
        await api('/api/'+t+'/'+old.id,{method:'DELETE',body:t==='pets'?{revision:Number.isInteger(old.revision)?old.revision:0}:undefined});
        _snapshotDelete(t,old.id);
      }
    }
    const nextSettings={clinicName:db.clinicName||'VetCare',settings:db.settings||{}};
    const prevSettings={clinicName:_lastSnapshot.clinicName||'VetCare',settings:_lastSnapshot.settings||{}};
    if(canManageSettings()&&!_sameSnapshotValue(nextSettings,prevSettings)){
      _syncContext={table:'settings',id:'singleton',operation:'update'};
      _setSyncState('saving',_syncContext);
      await api('/api/settings',{method:'POST',body:nextSettings});
      _lastSnapshot.clinicName=nextSettings.clinicName;
      _lastSnapshot.settings=_cloneSyncValue(nextSettings.settings);
    }
    if(canonicalDataChanged&&!(await saveIDB())){
      toast('⚠ Guardado en la nube, pero no se pudo actualizar la copia local.');
    }
    succeeded=true;
  }catch(e){
    _syncError=e;
    console.warn('Sync API falló:',e);
    if(e&&e.status===409){
      _setSyncState('conflict',_syncContext);
      toast('⚠ Conflicto detectado. Tus cambios siguen en este equipo.');
    }else if(VetCareSync.isRetryableStatus(e&&e.status)){
      _scheduleSyncRetry();
      toast(_browserOnline()
        ? '⚠ No se pudo guardar en la nube. VetCare reintentará automáticamente.'
        : '⚠ Sin conexión. Los cambios siguen guardados en este equipo.');
    }else{
      _clearRetryTimer();
      _setSyncState('error',_syncContext);
      toast('⚠ El servidor rechazó el cambio. Revisá tus permisos o los datos antes de reintentar.');
    }
  }finally{
    _syncing=false;
    const pendingRun=_syncAgain||_hasPendingChanges();
    _syncAgain=false;
    if(succeeded&&pendingRun){
      _setSyncState('queued',null);
      setTimeout(syncToAPI,0);
    }else if(succeeded){
      _markSyncConfirmed();
      _flushSaveMessages('cloud');
    }
  }
  return succeeded;
}
async function saveDB(successMessage){
  _queueSaveMessage(successMessage);
  const remote=apiConfigured()&&authToken;
  _setSyncState(remote?'queued':'saving',null);
  const localSaved=await saveIDB();
  if(!remote){
    if(localSaved){_setSyncState('local',null);_flushSaveMessages('local');}
    else{_setSyncState('error',{table:'local',operation:'write'});toast('⚠ No se pudo guardar en este dispositivo.');}
    return localSaved;
  }
  if(!localSaved)toast('⚠ No se pudo actualizar la copia local. VetCare espera la confirmación de la nube.');
  clearTimeout(_syncTimer);
  _syncTimer=setTimeout(syncToAPI,600);
  return localSaved;
}
async function saveIDB(){
  if(!idb)return false;
  try {
    let saved=true;
    const stores=['pets','owners','appointments','groomingAppointments','reminders','inventory','invoices'];
    for(const s of stores){
      try {
        const arr=db[s]||[];const tx=idb.transaction(s,'readwrite');const os=tx.objectStore(s);
        os.clear();for(const item of arr){if(item&&item.id)os.put(item);}
        const complete=await new Promise(r=>{
          tx.oncomplete=()=>r(true);tx.onerror=()=>r(false);tx.onabort=()=>r(false);
        });
        if(!complete)saved=false;
      } catch(e){saved=false;}
    }
    try {
      const mt=idb.transaction('meta','readwrite');
      mt.objectStore('meta').put({key:'clinicName',value:db.clinicName||'VetCare'});
      mt.objectStore('meta').put({key:'settings',value:db.settings||{theme:'light'}});
      const complete=await new Promise(r=>{
        mt.oncomplete=()=>r(true);mt.onerror=()=>r(false);mt.onabort=()=>r(false);
      });
      if(!complete)saved=false;
    } catch(e){saved=false;}
    return saved;
  } catch(e){return false;}
}

function retrySync(){
  if(_syncState==='conflict'){handleSyncStatusAction();return Promise.resolve(false);}
  _clearRetryTimer();
  clearTimeout(_syncTimer);
  if(!_browserOnline()){_setSyncState('offline',_syncContext);return Promise.resolve(false);}
  _setSyncState('queued',_syncContext);
  return syncToAPI();
}

function handleSyncStatusAction(){
  if(_syncState==='conflict'){
    const status=getSyncStatus();
    showModal(
      '<div class="modal-header"><h3>Conflicto de sincronización</h3><button class="close-btn" onclick="closeModal()">&times;</button></div>'
      +'<div class="modal-body"><p>'+escapeHtml(status.detail)+'</p>'
      +'<p style="color:var(--text-soft);margin-top:10px">Tus cambios locales no se eliminaron. Podés descargar una copia antes de recargar la versión confirmada por el servidor.</p></div>'
      +'<div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button>'
      +'<button class="btn btn-secondary" onclick="exportVetcare(\'full\')">Descargar copia</button>'
      +'<button class="btn btn-danger" onclick="reloadServerData()">Recargar servidor</button></div>'
    );
    return;
  }
  if(_syncState==='error'||_syncState==='offline')retrySync();
}

function reloadServerData(){
  closeModal();
  showConfirm('Se reemplazarán los cambios locales pendientes por la última versión confirmada en la nube. ¿Continuar?',async()=>{
    _pendingSaveMessages=[];
    _setSyncState('saving',null);
    try{
      await loadFromAPI();
      await saveIDB();
      closeModal();
      render();
      toast('Datos recargados desde la nube');
    }catch(e){
      _syncError=e;
      _scheduleSyncRetry();
      toast('No se pudieron recargar los datos');
    }
  });
}

if(typeof window!=='undefined'){
  window.addEventListener('offline',()=>{
    if(apiConfigured()&&authToken)_setSyncState('offline',_syncContext);
  });
  window.addEventListener('online',()=>{
    if(apiConfigured()&&authToken&&(_syncState==='offline'||_hasPendingChanges()))retrySync();
  });
  window.addEventListener('beforeunload',event=>{
    if(apiConfigured()&&authToken&&(_syncState!=='saved'||_hasPendingChanges())){
      event.preventDefault();
      event.returnValue='';
    }
  });
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
      await saveDB('Archivo .vetcare importado');
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
  saveDB('Nueva base de datos creada');
}
