function seedDemo() {
  if (db.pets.length > 0 || db.owners.length > 0) return;
  const o1 = { id: uid(), name: 'María González', phone: '5491145678901', email: 'maria.g@email.com', address: 'Av. Siempreviva 742', relationship: 'Tutor principal' };
  const o2 = { id: uid(), name: 'Carlos Pérez', phone: '5491134567890', email: 'carlos.p@email.com', relationship: 'Familiar' };
  db.owners.push(o1, o2);
  const p1 = { id: uid(), name: 'Luna', species: 'Perro', breed: 'Golden Retriever', sex: 'Hembra', color: 'Dorado', birthdate: new Date(Date.now() - 3*365*24*60*60*1000).toISOString().split('T')[0], weight: '28', microchip: '982000123456789', ownerIds: [o1.id, o2.id], allergies: 'Pollo', chronicConditions: '', notes: 'Muy sociable, le encanta jugar con pelota.', history: [{ id: uid(), date: new Date(Date.now()-30*24*60*60*1000).toISOString().split('T')[0], type: 'Consulta', title: 'Control anual', description: 'Examen físico completo. Todo dentro de parámetros normales.', treatment: 'Continuar con plan vacunal', vet: 'Dra. Rodríguez' }], vaccines: [{ id: uid(), name: 'Antirrábica', date: new Date(Date.now()-60*24*60*60*1000).toISOString().split('T')[0], nextDose: new Date(Date.now()+305*24*60*60*1000).toISOString().split('T')[0] }], images: [], photo: '' };
  const p2 = { id: uid(), name: 'Whiskers', species: 'Gato', breed: 'Persa', sex: 'Macho', color: 'Blanco y gris', birthdate: new Date(Date.now() - 5*365*24*60*60*1000 + 10*24*60*60*1000).toISOString().split('T')[0], weight: '5.2', ownerIds: [o1.id], history: [], vaccines: [], images: [], photo: '' };
  db.pets.push(p1, p2);
  const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0];
  db.appointments.push({ id: uid(), petId: p1.id, date: tomorrow, time: '10:30', type: 'Control', vet: 'Dra. Rodríguez', notes: 'Control post-vacunación' });
  db.groomingAppointments.push({ id: uid(), petId: p2.id, date: tomorrow, time: '15:00', service: 'Baño + corte', groomer: 'Pablo', price: '4500', status: 'Pendiente' });
  db.reminders.push({ id: uid(), title: 'Llamar para confirmar cirugía', petId: p1.id, date: new Date(Date.now()+2*24*60*60*1000).toISOString().split('T')[0], notes: 'Confirmar ayuno previo', completed: false });
  saveDB();
}

// ========================================
// [24] INIT — punto de entrada de la app
// ========================================
applyTheme();
// Capturar el SVG del logo original (esta dentro del welcomeScreen) para reusarlo
var _logoHTML='';
(function(){
  try{
    var wl=document.querySelector('#welcomeScreen .welcome-logo');
    if(wl){ _logoHTML=wl.innerHTML; }
    var sl=document.getElementById('splashLogo');
    if(sl&&_logoHTML){ sl.innerHTML=_logoHTML; }
  }catch(e){}
})();
function hideSplash(){ var s=document.getElementById('splash'); if(s){ s.classList.add('hide'); setTimeout(function(){ if(s&&s.parentNode) s.style.display='none'; },500); } }
// ---------- Pantalla de login / registro ----------
function showLogin(){
  hideSplash();
  document.getElementById('appShell').classList.add('is-hidden');
  document.getElementById('globalSearchWrap').style.display = 'none';
  var lb=document.getElementById('logoutBtn'); if(lb) lb.style.display='none';
  var ws = document.getElementById('welcomeScreen');
  ws.style.display = 'flex';
  ws.innerHTML = '<div style="max-width:380px;width:100%;background:#fff;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.12);padding:32px;">'
    + '<div class="login-logo" style="width:56px;height:56px;margin:0 0 14px;display:flex;align-items:center;justify-content:flex-start;">'+(_logoHTML||'')+'</div>'
    + '<h1 style="margin:0 0 4px;font-size:26px;color:#6F2DBD;">VetCare</h1>'
    + '<p id="authSub" style="margin:0 0 20px;color:#777;font-size:14px;">Ingresá con tu cuenta</p>'
    + '<div id="authError" style="display:none;background:#fde8e8;color:#c0392b;padding:10px;border-radius:10px;font-size:13px;margin-bottom:12px;"></div>'
    + '<div id="nameField" style="display:none;"><div style="margin-bottom:12px;"><input id="authName" type="text" placeholder="Tu nombre" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;"></div><div style="margin-bottom:12px;"><input id="authInvite" type="text" placeholder="Clave de invitación" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;"></div></div>'
    + '<div style="margin-bottom:12px;"><input id="authEmail" type="email" placeholder="Email" autocomplete="username" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;"></div>'
    + '<div style="margin-bottom:18px;"><input id="authPass" type="password" placeholder="Contraseña" autocomplete="current-password" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;"></div>'
    + '<button id="authBtn" onclick="doAuth()" style="width:100%;padding:13px;background:#6F2DBD;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Ingresar</button>'
    + '<p style="text-align:center;margin:16px 0 0;font-size:14px;color:#777;"><span id="authToggleTxt">¿No tenés cuenta?</span> <a id="authToggle" href="#" onclick="toggleAuthMode(event)" style="color:#6F2DBD;font-weight:600;">Crear cuenta</a></p>'
    + '</div>';
  var pass=document.getElementById('authPass');
  if(pass) pass.addEventListener('keydown',function(e){ if(e.key==='Enter') doAuth(); });
}
var _authMode='login';
function toggleAuthMode(ev){
  if(ev) ev.preventDefault();
  _authMode = _authMode==='login' ? 'register' : 'login';
  var reg = _authMode==='register';
  document.getElementById('nameField').style.display = reg ? 'block' : 'none';
  document.getElementById('authSub').textContent = reg ? 'Creá tu cuenta' : 'Ingresá con tu cuenta';
  document.getElementById('authBtn').textContent = reg ? 'Crear cuenta' : 'Ingresar';
  document.getElementById('authToggleTxt').textContent = reg ? '¿Ya tenés cuenta?' : '¿No tenés cuenta?';
  document.getElementById('authToggle').textContent = reg ? 'Ingresar' : 'Crear cuenta';
  document.getElementById('authError').style.display='none';
}
function authErr(msg){ var e=document.getElementById('authError'); if(!e)return; e.textContent=msg; e.style.display='block'; }
async function doAuth(){
  var email=(document.getElementById('authEmail').value||'').trim();
  var pass=document.getElementById('authPass').value||'';
  var nameEl=document.getElementById('authName');
  var name=nameEl?(nameEl.value||'').trim():'';
  var inviteEl=document.getElementById('authInvite');
  var invite=inviteEl?(inviteEl.value||'').trim():'';
  if(!email||!pass){ authErr('Completá email y contraseña.'); return; }
  var btn=document.getElementById('authBtn'); btn.disabled=true; var orig=btn.textContent; btn.textContent='...';
  try {
    if(_authMode==='register'){
      if(pass.length<6){ authErr('La contraseña debe tener al menos 6 caracteres.'); btn.disabled=false; btn.textContent=orig; return; }
      await apiRegister(email, pass, name, invite);
      await apiLogin(email, pass);
      toast('Cuenta creada ✓');
    } else {
      await apiLogin(email, pass);
    }
    await enterApp();
  } catch(e){
    authErr(e.message||'No se pudo conectar con el servidor.');
    btn.disabled=false; btn.textContent=orig;
  }
}
async function enterApp(){
  await loadFromAPI();
  _lastSnapshot=_snap();
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('appShell').classList.remove('is-hidden');
  document.getElementById('globalSearchWrap').style.display = 'flex';
  applyTheme(); render(); updateBadges();
  var lb=document.getElementById('logoutBtn'); if(lb) lb.style.display='block';
  hideSplash();
  toast('Bienvenido ' + (currentUser && currentUser.name ? currentUser.name : '') + ' ✓');
}
async function logout(){ await apiLogout(); showLogin(); }

(async function initApp() {
  try { await openIDB(); } catch(e){}
  if(!apiConfigured()){
    try {
      const hasData = await loadIDB();
      if (hasData) {
        if (!db.invoices) db.invoices = [];
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('appShell').classList.remove('is-hidden');
        document.getElementById('globalSearchWrap').style.display = 'flex';
        applyTheme(); render(); updateBadges();
        toast('Modo local (sin servidor configurado)');
      }
      hideSplash();
    } catch(e){ hideSplash(); }
    return;
  }
  if(authToken){
    try { const me = await api('/api/me'); currentUser = me.user; await enterApp(); return; }
    catch(e){ clearSession(); }
  }
  showLogin();
})();
// App inicia desde pantalla de bienvenida

// ========================================
// [21] BÚSQUEDA GLOBAL + BADGES
// ========================================
