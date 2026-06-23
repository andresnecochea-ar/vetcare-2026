# -*- coding: utf-8 -*-
# Aplica la migración a D1 sobre index.html de forma atómica (sin truncar).
import sys, io

PATH = '/sessions/beautiful-focused-shannon/mnt/vetcare-2026/index.html'
with io.open(PATH, 'r', encoding='utf-8') as f:
    html = f.read()

orig_len = len(html)
assert html.rstrip().endswith('</html>'), 'El archivo de entrada ya esta truncado!'

def replace_once(haystack, needle, repl, label):
    n = haystack.count(needle)
    if n != 1:
        raise SystemExit('ERROR [%s]: se esperaba 1 coincidencia, hay %d' % (label, n))
    return haystack.replace(needle, repl)

# ---------- BLOQUE 1: capa de API antes de [03] PERSISTENCIA ----------
b1_old = (
"// ========================================\n"
"// [03] PERSISTENCIA — IndexedDB (fuente de verdad local)\n"
"// La DB vive en memoria (objeto `db`) y se persiste en IndexedDB del navegador.\n"
"// ========================================\n"
"const IDB_NAME='vetcare',IDB_VER=1;let idb=null;"
)
b1_new = (
"// ========================================\n"
"// [03-API] BACKEND — Cloudflare Worker + D1 (fuente de verdad central)\n"
"// ========================================\n"
"const API_BASE = 'PEGAR_AQUI_LA_URL_DEL_WORKER';\n"
"let authToken = null;\n"
"let currentUser = null;\n"
"try { authToken = localStorage.getItem('vetcare_token') || null; } catch(e){}\n"
"function apiConfigured(){ return API_BASE && !API_BASE.startsWith('PEGAR_AQUI'); }\n"
"async function api(path, opts){\n"
"  opts = opts || {};\n"
"  const headers = { 'Content-Type':'application/json' };\n"
"  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;\n"
"  const res = await fetch(API_BASE + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });\n"
"  let data = null; try { data = await res.json(); } catch(e){}\n"
"  if (res.status === 401) { clearSession(); showLogin(); throw new Error('Sesion expirada'); }\n"
"  if (!res.ok) throw new Error((data && data.error) || ('Error ' + res.status));\n"
"  return data;\n"
"}\n"
"function setSession(token, user){ authToken = token; currentUser = user; try { localStorage.setItem('vetcare_token', token); } catch(e){} }\n"
"function clearSession(){ authToken = null; currentUser = null; try { localStorage.removeItem('vetcare_token'); } catch(e){} }\n"
"async function apiLogin(email, password){ const d = await api('/api/login', { method:'POST', body:{ email, password } }); setSession(d.token, d.user); return d.user; }\n"
"async function apiRegister(email, password, name){ return api('/api/register', { method:'POST', body:{ email, password, name } }); }\n"
"async function apiLogout(){ try { await api('/api/logout', { method:'POST' }); } catch(e){} clearSession(); }\n"
"async function loadFromAPI(){ const d = await api('/api/data'); db = Object.assign(JSON.parse(JSON.stringify(defaultData)), d); if (!db.invoices) db.invoices = []; return true; }\n"
"// ========================================\n"
"// [03] PERSISTENCIA — IndexedDB (respaldo offline local)\n"
"// ========================================\n"
"const IDB_NAME='vetcare',IDB_VER=1;let idb=null;"
)
html = replace_once(html, b1_old, b1_new, 'API layer')

# ---------- BLOQUE 2: renombrar saveDB -> saveIDB y nuevo saveDB con sync ----------
b2_old = "async function saveDB(){\n  if(!idb)return;\n"
b2_new = (
"let _syncTimer=null,_syncing=false,_syncAgain=false,_lastSnapshot={};\n"
"const _ENTITY_TABLES=['owners','pets','appointments','groomingAppointments','reminders','inventory','invoices'];\n"
"function _snap(){return JSON.parse(JSON.stringify({owners:db.owners,pets:db.pets,appointments:db.appointments,groomingAppointments:db.groomingAppointments,reminders:db.reminders,inventory:db.inventory,invoices:db.invoices}));}\n"
"async function syncToAPI(){\n"
"  if(!apiConfigured()||!authToken)return;\n"
"  if(_syncing){_syncAgain=true;return;}\n"
"  _syncing=true;\n"
"  try{\n"
"    for(const t of _ENTITY_TABLES){\n"
"      const cur=db[t]||[]; const prev=_lastSnapshot[t]||[]; const curIds=new Set(cur.map(x=>x.id));\n"
"      for(const item of cur){ if(item&&item.id) await api('/api/'+t,{method:'POST',body:item}); }\n"
"      for(const old of prev){ if(old&&old.id&&!curIds.has(old.id)) await api('/api/'+t+'/'+old.id,{method:'DELETE'}); }\n"
"    }\n"
"    _lastSnapshot=_snap();\n"
"  }catch(e){ console.warn('Sync API fallo:',e); toast('⚠ No se pudo guardar en el servidor'); }\n"
"  finally{ _syncing=false; if(_syncAgain){_syncAgain=false;syncToAPI();} }\n"
"}\n"
"async function saveDB(){\n"
"  saveIDB();\n"
"  if(!apiConfigured()||!authToken)return;\n"
"  clearTimeout(_syncTimer); _syncTimer=setTimeout(syncToAPI,600);\n"
"}\n"
"async function saveIDB(){\n  if(!idb)return;\n"
)
html = replace_once(html, b2_old, b2_new, 'saveDB->saveIDB')

# ---------- BLOQUE 3: reemplazar initApp por login flow ----------
b3_old = (
"(async function initApp() {\n"
"  try {\n"
"    await openIDB();\n"
"    const hasData = await loadIDB();\n"
"    if (hasData) {\n"
"      if (!db.invoices) db.invoices = [];\n"
"      document.getElementById('welcomeScreen').style.display = 'none';\n"
"      document.getElementById('appShell').classList.remove('is-hidden');\n"
"      document.getElementById('globalSearchWrap').style.display = 'flex';\n"
"      applyTheme(); render(); updateBadges();\n"
"      toast('Datos cargados automáticamente ✓');\n"
"    }\n"
"    // Si no hay datos: pantalla de bienvenida queda visible, botones funcionan normal\n"
"  } catch(e) {\n"
"    // Si IDB falla completamente, la app igual funciona sin persistencia\n"
"    console.warn('IndexedDB no disponible, modo sin persistencia:', e);\n"
"  }\n"
"})();"
)
b3_new = open('/sessions/beautiful-focused-shannon/mnt/vetcare-2026/backend/_initblock.js','r',encoding='utf-8').read()
html = replace_once(html, b3_old, b3_new, 'initApp')

# ---------- BLOQUE 4: boton Salir ----------
b4_old = "<!-- Modals injected here -->\n<div id=\"modalContainer\"></div>"
b4_new = ("<!-- Modals injected here -->\n<div id=\"modalContainer\"></div>\n"
"<button id=\"logoutBtn\" onclick=\"logout()\" title=\"Cerrar sesion\" style=\"display:none;position:fixed;bottom:16px;right:16px;z-index:9000;background:var(--navy,#6F2DBD);color:#fff;border:none;border-radius:24px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2);\">Salir</button>")
html = replace_once(html, b4_old, b4_new, 'logout button')

# ---------- Validacion final ----------
if not html.rstrip().endswith('</html>'):
    raise SystemExit('ERROR: el resultado quedaria truncado!')

with io.open(PATH, 'w', encoding='utf-8') as f:
    f.write(html)

print('OK. len antes=%d, despues=%d, delta=%d' % (orig_len, len(html), len(html)-orig_len))
print('cierre:', repr(html[-20:]))
