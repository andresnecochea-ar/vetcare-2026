/* =====================================================================
   OPCIONES / CONFIGURACION
   Modal con: tema, version + buscar actualizaciones, datos de la clinica
   y de los recibos, y acceso al respaldo.
   ===================================================================== */

var APP_VERSION = '2.14.0';

function _ensureSettings(){
  if(!db.settings) db.settings = {};
  if(!db.settings.theme) db.settings.theme = 'light';
  if(db.settings.clinicName === undefined) db.settings.clinicName = '';
  if(db.settings.receiptsEnabled === undefined) db.settings.receiptsEnabled = true;
  if(db.settings.receiptAddress === undefined) db.settings.receiptAddress = '';
  if(db.settings.receiptPhone === undefined) db.settings.receiptPhone = '';
  if(db.settings.receiptTaxId === undefined) db.settings.receiptTaxId = '';
  // Los datos de la clinica encabezan todos los impresos; las instalaciones que
  // ya tenian direccion y telefono de recibos los heredan.
  if(db.settings.clinicAddress === undefined) db.settings.clinicAddress = db.settings.receiptAddress || '';
  if(db.settings.clinicPhone === undefined) db.settings.clinicPhone = db.settings.receiptPhone || '';
  if(db.settings.clinicEmail === undefined) db.settings.clinicEmail = '';
  if(db.settings.clinicLicense === undefined) db.settings.clinicLicense = '';
}

function openSettings(){
  _ensureSettings();
  var s = db.settings;
  var dark = s.theme === 'dark';
  var admin = canManageSettings();
  var userSummary = currentUser
    ? escapeHtml(currentUser.name||currentUser.email||'Usuario') + ' · ' + escapeHtml(roleLabel(currentUser.role))
    : 'Modo local · Administrador';
  showModal(
    '<div class="modal-header"><h3>Opciones</h3>'
    + '<button class="close-btn" onclick="closeModal()">&times;</button></div>'
    + '<div class="modal-body">'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Sesión actual</div>'
    + '  <div style="font-weight:600">' + userSummary + '</div>'
    + (currentUser&&currentUser.email ? '  <small style="color:var(--text-mute)">' + escapeHtml(currentUser.email) + '</small>' : '')
    + '</div>'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Apariencia</div>'
    + '  <button class="btn btn-secondary" style="width:100%;display:flex;align-items:center;justify-content:center" onclick="toggleTheme();openSettings()">'
    +      '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:1.05em;height:1.05em;vertical-align:-.16em;margin-right:8px"><path d="M19.4 15.2A7.2 7.2 0 0 1 8.8 4.6 8.2 8.2 0 1 0 19.4 15.2Z"/></svg>' + (dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro') + '</button>'
    + '</div>'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Datos de la clinica</div>'
    + '  <input class="input" id="setClinicName" placeholder="Nombre de la clinica" value="' + escapeAttr(s.clinicName) + '" style="margin-bottom:8px"' + (admin?'':' disabled') + '>'
    + '  <input class="input" id="setClinicAddress" placeholder="Direccion" value="' + escapeAttr(s.clinicAddress) + '" style="margin-bottom:8px"' + (admin?'':' disabled') + '>'
    + '  <input class="input" id="setClinicPhone" placeholder="Telefono" value="' + escapeAttr(s.clinicPhone) + '" style="margin-bottom:8px"' + (admin?'':' disabled') + '>'
    + '  <input class="input" id="setClinicEmail" placeholder="Email" value="' + escapeAttr(s.clinicEmail) + '" style="margin-bottom:8px"' + (admin?'':' disabled') + '>'
    + '  <input class="input" id="setClinicLicense" placeholder="Matricula profesional" value="' + escapeAttr(s.clinicLicense) + '"' + (admin?'':' disabled') + '>'
    + '  <small style="color:var(--text-mute);display:block;margin-top:6px">Encabezan la historia clinica, los certificados, el plan sanitario, los resultados de laboratorio y los recibos.</small>'
    + (admin ? '  <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="saveSettings()">Guardar datos</button>' : '')
    + '</div>'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Documentos clinicos</div>'
    + '  <button class="btn btn-secondary" style="width:100%;margin-bottom:8px" onclick="openCertificateTemplate()">Texto del certificado medico</button>'
    + '  <button class="btn btn-secondary" style="width:100%" onclick="openExamTemplates()">Plantillas de examen fisico</button>'
    + '</div>'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Recibos (opcional)</div>'
    + '  <label class="settings-toggle"><input type="checkbox" id="setReceiptsEnabled"' + (s.receiptsEnabled?' checked':'') + (admin?'':' disabled') + ' onchange="toggleReceiptSettingsFields(this.checked)"><span><strong>Mostrar módulo de recibos</strong><small>La atención clínica funciona normalmente aunque esté desactivado.</small></span></label>'
    + '  <div id="receiptSettingsFields"' + (s.receiptsEnabled?'':' hidden') + '>'
    + '    <input class="input" id="setRecTax" placeholder="CUIT" value="' + escapeAttr(s.receiptTaxId) + '"' + (admin?'':' disabled') + '>'
    + '    <small style="color:var(--text-mute);display:block;margin-top:6px">La direccion y el telefono del recibo salen de los datos de la clinica.</small>'
    + '  </div>'
    + (admin
      ? '  <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="saveSettings()">Guardar datos</button>'
      : '  <small style="color:var(--text-mute);display:block;margin-top:8px">Solo una persona administradora puede modificar estos datos.</small>')
    + '</div>'

    + (canWriteEntity('inventory') ? '<div class="settings-section">'
    + '  <div class="settings-label">Catálogo de productos</div>'
    + '  <button class="btn btn-secondary" style="width:100%" onclick="openCatalog()">Gestionar productos</button>'
    + '  <small style="color:var(--text-mute);display:block;margin-top:6px">Definí acá la lista de productos. El stock se carga desde la sección Inventario.</small>'
    + '</div>' : '')

    + (admin&&apiConfigured() ? '<div class="settings-section">'
    + '  <div class="settings-label">Accesos y auditoría</div>'
    + '  <button class="btn btn-secondary" style="width:100%" onclick="openAccessManagement()">Gestionar usuarios y actividad</button>'
    + '  <small style="color:var(--text-mute);display:block;margin-top:6px">Asigná roles y revisá las operaciones realizadas.</small>'
    + '</div>' : '')

    + '<div class="settings-section">'
    + '  <div class="settings-label">Laboratorio</div>'
    + '  <button class="btn btn-secondary" style="width:100%" onclick="openLabRanges()">Valores de referencia</button>'
    + '  <small style="color:var(--text-mute);display:block;margin-top:6px">Rangos por especie para marcar resultados altos y bajos. Los que vienen cargados son orientativos.</small>'
    + '</div>'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Respaldo</div>'
    + '  <button class="btn btn-secondary" style="width:100%" onclick="closeModal();navigateTo(\'backup\')">Ir a Respaldo</button>'
    + '</div>'

    + '<div class="settings-section settings-version">'
    + '  <div class="settings-label">Version</div>'
    + '  <div class="settings-version-row"><span>VetCare v' + APP_VERSION + '</span></div>'
    + '  <button class="btn btn-secondary" style="width:100%;margin-top:8px;display:flex;align-items:center;justify-content:center" onclick="forceUpdate()"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:1.05em;height:1.05em;vertical-align:-.16em;margin-right:8px"><circle cx="10.5" cy="10.5" r="5.8"/><path d="M15 15l4.5 4.5"/></svg>Buscar actualizaciones</button>'
    + '</div>'

    + '</div>'
  );
}

function saveSettings(){
  if(!canManageSettings()){ toast('Solo una persona administradora puede modificar estos datos'); return; }
  _ensureSettings();
  var byId = function(id){ return document.getElementById(id); };
  if(byId('setClinicName')) db.settings.clinicName = byId('setClinicName').value.trim();
  if(byId('setClinicAddress')) db.settings.clinicAddress = byId('setClinicAddress').value.trim();
  if(byId('setClinicPhone')) db.settings.clinicPhone = byId('setClinicPhone').value.trim();
  if(byId('setClinicEmail')) db.settings.clinicEmail = byId('setClinicEmail').value.trim();
  if(byId('setClinicLicense')) db.settings.clinicLicense = byId('setClinicLicense').value.trim();
  if(byId('setReceiptsEnabled')) db.settings.receiptsEnabled = byId('setReceiptsEnabled').checked;
  if(byId('setRecAddr')) db.settings.receiptAddress = byId('setRecAddr').value.trim();
  if(byId('setRecPhone')) db.settings.receiptPhone = byId('setRecPhone').value.trim();
  if(byId('setRecTax')) db.settings.receiptTaxId = byId('setRecTax').value.trim();
  updateReceiptModuleVisibility();
  render();
  saveDB('Opciones actualizadas');
}

function toggleReceiptSettingsFields(enabled){
  var fields = document.getElementById('receiptSettingsFields');
  if(fields) fields.hidden = !enabled;
}

function _auditLabel(action){
  return ({register:'Alta de usuario',login:'Inicio de sesión',create:'Creación',update:'Modificación',delete:'Eliminación',role_change:'Cambio de rol'})[action] || action;
}

async function openAccessManagement(){
  if(!isAdmin()){ toast('Acceso reservado a administradores'); return; }
  showModal('<div class="modal-header"><h3>Accesos y auditoría</h3><button class="close-btn" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="empty-state">Cargando…</div></div>',true);
  try{
    var results=await Promise.all([api('/api/users'),api('/api/audit?limit=100')]);
    var users=results[0].users||[];
    var entries=results[1].entries||[];
    var userRows=users.map(function(user){
      var own=currentUser&&currentUser.id===user.id;
      return '<tr><td><strong>'+escapeHtml(user.name||'Sin nombre')+'</strong><br><small>'+escapeHtml(user.email||'')+(own?' · Vos':'')+'</small></td>'
        +'<td><select class="input" aria-label="Rol de '+escapeAttr(user.name||user.email||'usuario')+'" onchange="changeUserRole(\''+user.id+'\',this.value)">'
        +['admin','veterinarian','reception'].map(function(role){return '<option value="'+role+'" '+(user.role===role?'selected':'')+'>'+escapeHtml(roleLabel(role))+'</option>';}).join('')
        +'</select></td>'
        +'<td><button class="btn btn-secondary" style="white-space:nowrap" onclick="resetUserPassword(\''+user.id+'\',\''+escapeAttr(user.name||user.email||'usuario')+'\')">Restablecer contraseña</button></td></tr>';
    }).join('');
    var auditRows=entries.map(function(entry){
      var fields=(entry.fields||[]).length?' · Campos: '+escapeHtml((entry.fields||[]).join(', ')):'';
      return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">'
        +'<strong>'+escapeHtml(_auditLabel(entry.action))+'</strong> · '+escapeHtml(entry.entity_type||'')
        +'<div style="font-size:var(--fs-xs);color:var(--text-mute)">'+escapeHtml(entry.user_name||entry.user_email||'Sistema')
        +' · '+escapeHtml(new Date(entry.created_at).toLocaleString('es-AR'))+fields+'</div></div>';
    }).join('');
    showModal('<div class="modal-header"><h3>Accesos y auditoría</h3><button class="close-btn" onclick="closeModal()">&times;</button></div>'
      +'<div class="modal-body"><div class="settings-section"><div class="settings-label">Usuarios</div>'
      +(users.length?'<div class="table-wrap"><table><thead><tr><th>Persona</th><th>Rol</th><th></th></tr></thead><tbody>'+userRows+'</tbody></table></div>':'<div class="empty-state">Sin usuarios</div>')
      +'</div><div class="settings-section"><div class="settings-label">Última actividad</div>'
      +(entries.length?auditRows:'<div class="empty-state">Sin actividad registrada</div>')+'</div></div>',true);
  }catch(e){
    toast(e.message||'No se pudieron cargar los accesos');
    openSettings();
  }
}

async function changeUserRole(userId,role){
  try{
    var updated=await api('/api/users/'+encodeURIComponent(userId)+'/role',{method:'PUT',body:{role:role}});
    if(currentUser&&currentUser.id===updated.id)currentUser.role=updated.role;
    toast('Rol actualizado');
    await openAccessManagement();
  }catch(e){
    toast(e.message||'No se pudo cambiar el rol');
    await openAccessManagement();
  }
}

async function resetUserPassword(userId,label){
  var password=prompt('Contraseña temporal para '+label+' (mínimo 8 caracteres). Se la tenés que pasar vos por otro medio:');
  if(password===null) return;
  if(password.length<8){ toast('La contraseña debe tener al menos 8 caracteres'); return; }
  try{
    await api('/api/users/'+encodeURIComponent(userId)+'/password',{method:'PUT',body:{password:password}});
    toast('Contraseña restablecida');
  }catch(e){
    toast(e.message||'No se pudo restablecer la contraseña');
  }
}

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
  var u = new URL(window.location.href);
  u.searchParams.set('_r', Date.now().toString());
  window.location.replace(u.toString());
}
