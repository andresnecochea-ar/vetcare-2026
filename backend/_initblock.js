// ---------- Pantalla de login / registro ----------
function showLogin(){
  document.getElementById('appShell').classList.add('is-hidden');
  document.getElementById('globalSearchWrap').style.display = 'none';
  var lb=document.getElementById('logoutBtn'); if(lb) lb.style.display='none';
  var ws = document.getElementById('welcomeScreen');
  ws.style.display = 'flex';
  ws.innerHTML = '<div style="max-width:380px;width:100%;background:#fff;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.12);padding:32px;">'
    + '<h1 style="margin:0 0 4px;font-size:26px;color:#6F2DBD;">VetCare</h1>'
    + '<p id="authSub" style="margin:0 0 20px;color:#777;font-size:14px;">Ingresá con tu cuenta</p>'
    + '<div id="authError" style="display:none;background:#fde8e8;color:#c0392b;padding:10px;border-radius:10px;font-size:13px;margin-bottom:12px;"></div>'
    + '<div id="nameField" style="display:none;margin-bottom:12px;"><input id="authName" type="text" placeholder="Tu nombre" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;"></div>'
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
  if(!email||!pass){ authErr('Completá email y contraseña.'); return; }
  var btn=document.getElementById('authBtn'); btn.disabled=true; var orig=btn.textContent; btn.textContent='...';
  try {
    if(_authMode==='register'){
      if(pass.length<6){ authErr('La contraseña debe tener al menos 6 caracteres.'); btn.disabled=false; btn.textContent=orig; return; }
      await apiRegister(email, pass, name);
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
    } catch(e){}
    return;
  }
  if(authToken){
    try { const me = await api('/api/me'); currentUser = me.user; await enterApp(); return; }
    catch(e){ clearSession(); }
  }
  showLogin();
})();