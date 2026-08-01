/* =====================================================================
   OPCIONES / CONFIGURACION
   Modal con: tema, version + buscar actualizaciones, datos de la clinica
   y de los recibos, y acceso al respaldo.
   ===================================================================== */

var APP_VERSION = '2.15.0';

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
  // Códigos para reconstruir el número internacional de WhatsApp a partir de
  // los teléfonos locales de la base (ver js/phone.js). El país tiene un valor
  // razonable por defecto; el área depende de la localidad y hay que cargarla.
  if(db.settings.phoneCountryCode === undefined) db.settings.phoneCountryCode = '54';
  if(db.settings.phoneAreaCode === undefined) db.settings.phoneAreaCode = '';
}

// Campo de Opciones con <label> real: el placeholder solo no alcanza, porque
// desaparece al escribir y los lectores de pantalla no lo anuncian.
function _settingsField(id, label, value, enabled, placeholder){
  return '  <div class="form-group">'
    + '<label for="' + id + '">' + escapeHtml(label) + '</label>'
    + '<input class="input" id="' + id + '" value="' + escapeAttr(value || '') + '"'
    + (placeholder ? ' placeholder="' + escapeAttr(placeholder) + '"' : '')
    + (enabled ? '' : ' disabled') + '></div>';
}

// Cuántos tutores tienen hoy un WhatsApp utilizable, para que quien configura
// vea el efecto de cargar el código de área en vez de tener que adivinarlo.
function _phoneCoverageText(){
  const owners = (db.owners || []).filter(o => String(o.phone || o.altPhone || '').trim());
  if(!owners.length) return 'Se usan para armar el enlace de WhatsApp a partir de los teléfonos guardados.';
  const ok = owners.filter(o => waPhone([o.phone, o.altPhone])).length;
  return `Se usan para armar el enlace de WhatsApp. Hoy ${ok} de ${owners.length} tutores con teléfono tienen un WhatsApp utilizable.`;
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
    + '  <div class="settings-label">Datos de la clínica</div>'
    + _settingsField('setClinicName', 'Nombre de la clínica', s.clinicName, admin)
    + _settingsField('setClinicAddress', 'Dirección', s.clinicAddress, admin)
    + _settingsField('setClinicPhone', 'Teléfono', s.clinicPhone, admin)
    + _settingsField('setClinicEmail', 'Email', s.clinicEmail, admin)
    + _settingsField('setClinicLicense', 'Matrícula profesional', s.clinicLicense, admin)
    + '  <small style="color:var(--text-mute);display:block;margin-top:6px">Encabezan la historia clínica, los certificados, el plan sanitario, los resultados de laboratorio y los recibos.</small>'
    + (admin ? '  <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="saveSettings()">Guardar datos</button>' : '')
    + '</div>'

    // Sin estos dos códigos no se puede armar el número internacional y los
    // botones de WhatsApp quedan deshabilitados en toda la app, porque los
    // teléfonos de la base están cargados en formato local viejo ("15649798").
    + '<div class="settings-section">'
    + '  <div class="settings-label">Teléfonos y WhatsApp</div>'
    + '  <div class="form-row">'
    +      _settingsField('setPhoneCountry', 'Código de país', s.phoneCountryCode, admin, 'Ej: 54')
    +      _settingsField('setPhoneArea', 'Código de área (sin 0)', s.phoneAreaCode, admin, 'Ej: 2262')
    + '  </div>'
    + '  <small style="color:var(--text-mute);display:block;margin-top:6px">' + _phoneCoverageText() + '</small>'
    + (admin ? '  <button class="btn btn-secondary" style="width:100%;margin-top:10px" onclick="openPhoneReview()">Revisar teléfonos sin WhatsApp</button>' : '')
    + '</div>'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Documentos clínicos</div>'
    + '  <button class="btn btn-secondary" style="width:100%;margin-bottom:8px" onclick="openCertificateTemplate()">Texto del certificado médico</button>'
    + '  <button class="btn btn-secondary" style="width:100%" onclick="openExamTemplates()">Plantillas de examen físico</button>'
    + '</div>'

    + '<div class="settings-section">'
    + '  <div class="settings-label">Recibos (opcional)</div>'
    + '  <label class="settings-toggle"><input type="checkbox" id="setReceiptsEnabled"' + (s.receiptsEnabled?' checked':'') + (admin?'':' disabled') + ' onchange="toggleReceiptSettingsFields(this.checked)"><span><strong>Mostrar módulo de recibos</strong><small>La atención clínica funciona normalmente aunque esté desactivado.</small></span></label>'
    + '  <div id="receiptSettingsFields"' + (s.receiptsEnabled?'':' hidden') + '>'
    + '    <input class="input" id="setRecTax" placeholder="CUIT" value="' + escapeAttr(s.receiptTaxId) + '"' + (admin?'':' disabled') + '>'
    + '    <small style="color:var(--text-mute);display:block;margin-top:6px">La dirección y el teléfono del recibo salen de los datos de la clínica.</small>'
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
  if(byId('setPhoneCountry')) db.settings.phoneCountryCode = byId('setPhoneCountry').value.replace(/\D/g,'');
  if(byId('setPhoneArea')) db.settings.phoneAreaCode = byId('setPhoneArea').value.replace(/\D/g,'');
  if(byId('setReceiptsEnabled')) db.settings.receiptsEnabled = byId('setReceiptsEnabled').checked;
  if(byId('setRecAddr')) db.settings.receiptAddress = byId('setRecAddr').value.trim();
  if(byId('setRecPhone')) db.settings.receiptPhone = byId('setRecPhone').value.trim();
  if(byId('setRecTax')) db.settings.receiptTaxId = byId('setRecTax').value.trim();
  updateReceiptModuleVisibility();
  render();
  saveDB('Opciones actualizadas');
}

// Lista de trabajo para ir corrigiendo los teléfonos que no permiten mandar un
// WhatsApp. No reescribe nada por su cuenta: el número real lo sabe la persona
// que atiende, no el sistema. Se ordena por cantidad de pacientes activos para
// que arreglar los primeros ya cubra la mayor parte de los avisos.
let _phoneReviewQuery = '';

function openPhoneReview(){
  if(!isAdmin()){ toast('Acceso reservado a administradores'); return; }
  const pending = (db.owners || [])
    .map(owner => ({ owner, issue: phoneIssue([owner.phone, owner.altPhone]) }))
    .filter(row => row.issue && row.issue !== 'empty')
    .map(row => ({ ...row, pets: db.pets.filter(p => !p.deceasedAt && (p.ownerIds||[]).includes(row.owner.id)).length }))
    .sort((a, b) => b.pets - a.pets || String(a.owner.name||'').localeCompare(String(b.owner.name||''), 'es'));

  const query = _phoneReviewQuery.trim().toLowerCase();
  const filtered = query
    ? pending.filter(row => String(row.owner.name||'').toLowerCase().includes(query))
    : pending;
  const shown = filtered.slice(0, 100);
  const byIssue = pending.reduce((acc, row) => { acc[row.issue] = (acc[row.issue]||0) + 1; return acc; }, {});

  const rows = shown.map(row => `
    <tr>
      <td><strong>${escapeHtml(row.owner.name || 'Sin nombre')}</strong>
        <br><small style="color:var(--text-mute)">${row.pets} paciente${row.pets===1?'':'s'} activo${row.pets===1?'':'s'}</small></td>
      <td><code>${escapeHtml(row.owner.phone || row.owner.altPhone || '')}</code></td>
      <td class="col-sec"><small>${escapeHtml(PHONE_ISSUE_TEXT[row.issue] || 'Teléfono incompleto')}</small></td>
      <td><button class="btn btn-sm" onclick="closeModal();openOwnerModal('${row.owner.id}')">Corregir</button></td>
    </tr>`).join('');

  showModal(
    '<div class="modal-header"><h3>Teléfonos sin WhatsApp</h3>'
    + '<button class="close-btn" onclick="closeModal()">&times;</button></div>'
    + '<div class="modal-body">'
    + (pending.length === 0
      ? '<div class="empty-state">Todos los tutores con teléfono tienen un WhatsApp utilizable.</div>'
      : '<p style="color:var(--text-soft);font-size:var(--fs-sm);margin-bottom:12px">'
        + pending.length + ' tutores tienen un teléfono que no permite mandar WhatsApp. '
        + 'Están ordenados por cantidad de pacientes activos: corrigiendo los primeros se cubre la mayor parte de los avisos.</p>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'
        + Object.entries(byIssue).map(([issue, count]) =>
            `<span class="tag">${escapeHtml(PHONE_ISSUE_TEXT[issue] || issue)}: ${count}</span>`).join('')
        + '</div>'
        + '<div class="form-group"><label for="phoneReviewSearch">Buscar tutor</label>'
        + '<input class="input" id="phoneReviewSearch" value="' + escapeAttr(_phoneReviewQuery) + '" '
        + 'oninput="_phoneReviewQuery=this.value;clearTimeout(window._phoneReviewTimer);window._phoneReviewTimer=setTimeout(openPhoneReview,250)"></div>'
        + '<div class="table-wrap"><table><thead><tr><th>Tutor</th><th>Teléfono</th>'
        + '<th class="col-sec">Motivo</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        + (filtered.length > shown.length
          ? '<small style="color:var(--text-mute);display:block;margin-top:10px">Se muestran los primeros '
            + shown.length + ' de ' + filtered.length + '. Usá el buscador para llegar a uno puntual.</small>'
          : ''))
    + '</div>', true);

  const search = document.getElementById('phoneReviewSearch');
  if(search && _phoneReviewQuery){ search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
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
