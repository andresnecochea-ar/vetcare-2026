/* =====================================================================
   OPCIONES / CONFIGURACION
   Modal con: tema, version + buscar actualizaciones, datos de la clinica
   y de los recibos, y acceso al respaldo.
   ===================================================================== */

var APP_VERSION = '5.0';

function _ensureSettings(){
  if(!db.settings) db.settings = {};
  if(!db.settings.theme) db.settings.theme = 'light';
  if(db.settings.clinicName === undefined) db.settings.clinicName = '';
  if(db.settings.receiptAddress === undefined) db.settings.receiptAddress = '';
  if(db.settings.receiptPhone === undefined) db.settings.receiptPhone = '';
  if(db.settings.receiptTaxId === undefined) db.settings.receiptTaxId = '';
}

function openSettings(){
  _ensureSettings();
  var s = db.settings;
  var dark = s.theme === 'dark';
  showModal(
    '<div class="modal-header"><h3>Opciones</h3>'
    + '<button class="close-btn" onclick="closeModal()">&times;</button></div>'
    + '<div class="modal-body">'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Apariencia</div>'
    + '  <button class="btn btn-secondary" style="width:100%" onclick="toggleTheme();openSettings()">'
    +      (dark ? '☀ Cambiar a modo claro' : '☾ Cambiar a modo oscuro') + '</button>'
    + '</div>'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Datos de la clinica</div>'
    + '  <input class="input" id="setClinicName" placeholder="Nombre de la clinica" value="' + escapeAttr(s.clinicName) + '">'
    + '</div>'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Datos para recibos</div>'
    + '  <input class="input" id="setRecAddr" placeholder="Direccion" value="' + escapeAttr(s.receiptAddress) + '" style="margin-bottom:8px">'
    + '  <input class="input" id="setRecPhone" placeholder="Telefono" value="' + escapeAttr(s.receiptPhone) + '" style="margin-bottom:8px">'
    + '  <input class="input" id="setRecTax" placeholder="CUIT" value="' + escapeAttr(s.receiptTaxId) + '">'
    + '  <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="saveSettings()">Guardar datos</button>'
    + '</div>'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Respaldo</div>'
    + '  <button class="btn btn-secondary" style="width:100%" onclick="closeModal();navigateTo(\'backup\')">Ir a Respaldo</button>'
    + '</div>'

    + '<div class="settings-section settings-version">'
    + '  <div class="settings-label">Version</div>'
    + '  <div class="settings-version-row"><span>VetCare v' + APP_VERSION + '</span></div>'
    + '  <button class="btn btn-secondary" style="width:100%;margin-top:8px;display:flex;align-items:center;justify-content:center" onclick="forceUpdate()"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:1.05em;height:1.05em;vertical-align:-.16em;margin-right:7px"><path d="M20 11a8 8 0 1 0-.9 4.5"/><path d="M20 5v6h-6"/></svg>Buscar actualizaciones</button>'
    + '</div>'

    + '</div>'
  );
}

function saveSettings(){
  _ensureSettings();
  var byId = function(id){ return document.getElementById(id); };
  if(byId('setClinicName')) db.settings.clinicName = byId('setClinicName').value.trim();
  if(byId('setRecAddr')) db.settings.receiptAddress = byId('setRecAddr').value.trim();
  if(byId('setRecPhone')) db.settings.receiptPhone = byId('setRecPhone').value.trim();
  if(byId('setRecTax')) db.settings.receiptTaxId = byId('setRecTax').value.trim();
  saveDB();
  toast('Datos guardados');
}

// Recarga forzada sin cache: desregistra service workers, borra caches y recarga.
async function forceUpdate(){
  toast('Buscando actualizaciones...');
  try{
    if('serviceWorker' in navigator){
      var regs = await navigator.serviceWorker.getRegistrations();
      for(var i=0;i<regs.length;i++){ await regs[i].unregister(); }
    }
    if(window.caches && caches.keys){
      var keys = await caches.keys();
      for(var j=0;j<keys.length;j++){ await caches.delete(keys[j]); }
    }
  }catch(e){}
  // Romper cache de la URL agregando un parametro y recargar.
  var u = new URL(window.location.href);
  u.searchParams.set('_r', Date.now().toString());
  window.location.replace(u.toString());
}
