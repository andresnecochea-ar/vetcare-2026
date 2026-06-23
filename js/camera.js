/* =====================================================================
   CAMARA PERSONALIZADA - foto de paciente
   Abre la camara dentro de la app (getUserMedia), muestra una guia
   circular y recorta la foto al cuadrado central antes de comprimirla.
   Requiere HTTPS o localhost (Cloudflare ya es HTTPS).
   ===================================================================== */

var _camStream = null;
var _camPetId = null;
var _camFacing = 'environment';

// Mostrar "Tomar foto" si el dispositivo es tactil y soporta camara.
// No depende del userAgent (que falla en muchos telefonos reales).
function deviceCanCapture(){
  var hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  var isTouch = (navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
  return hasCamera && isTouch;
}

function choosePhotoSource(petId){
  var camOption = deviceCanCapture()
    ? '<button class="btn btn-primary" style="width:100%;margin-bottom:10px;display:flex;align-items:center;justify-content:center" onclick="openCamera(\'' + petId + '\')"><svg class="ico" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:1.1em;height:1.1em;vertical-align:-.18em;margin-right:8px"><path d="M4 8.5h3l1.4-2.2h7.2L17 8.5h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.4"/></svg>Tomar foto</button>'
    : '';
  showModal(
    '<div class="modal-header"><h3>Foto del paciente</h3>'
    + '<button class="close-btn" onclick="closeModal()">&times;</button></div>'
    + '<div class="modal-body" style="text-align:center">'
    + camOption
    + '<label class="btn btn-secondary" style="width:100%;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg class="ico" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:1.1em;height:1.1em;vertical-align:-.18em;margin-right:8px"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="8.6" cy="9.4" r="1.6"/><path d="M4 17l4.6-4.4a1.4 1.4 0 0 1 1.9 0L15 17M13.5 15l2.3-2.1a1.4 1.4 0 0 1 1.9 0L20.5 15"/></svg>Subir desde archivo'
    + '<input type="file" accept="image/*" style="display:none" onchange="uploadPetPhoto(\'' + petId + '\', this); closeModal();"></label>'
    + '</div>'
  );
}

async function openCamera(petId){
  _camPetId = petId;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    toast('Tu navegador no permite usar la camara');
    return;
  }
  closeModal();
  var ov = document.createElement('div');
  ov.id = 'cameraOverlay';
  ov.className = 'camera-overlay';
  ov.innerHTML =
      '<video id="camVideo" autoplay playsinline muted></video>'
    + '<div class="camera-guide"></div>'
    + '<div class="camera-hint">Centra la cara de la mascota en el circulo</div>'
    + '<div class="camera-controls">'
    + '  <button class="cam-btn cam-cancel" onclick="closeCamera()" aria-label="Cancelar">✕</button>'
    + '  <button class="cam-shutter" onclick="captureCamera()" aria-label="Tomar foto"></button>'
    + '  <button class="cam-btn cam-flip" onclick="flipCamera()" aria-label="Cambiar camara">⟲</button>'
    + '</div>';
  document.body.appendChild(ov);
  try { history.pushState({ camera:true }, ''); } catch(e){}
  window.addEventListener('popstate', _camPopState);
  await startCamStream();
}

function _camPopState(){ closeCamera(); }

async function startCamStream(){
  try{
    if(_camStream){ _camStream.getTracks().forEach(function(t){ t.stop(); }); }
    _camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _camFacing, width:{ideal:1280}, height:{ideal:1280} },
      audio: false
    });
    var v = document.getElementById('camVideo');
    if(v){ v.srcObject = _camStream; }
  }catch(err){
    var msg = (err && err.name === 'NotAllowedError')
      ? 'Permiso de camara denegado. Activalo en el navegador.'
      : 'No se pudo abrir la camara.';
    toast(msg);
    closeCamera();
  }
}

function flipCamera(){
  _camFacing = (_camFacing === 'environment') ? 'user' : 'environment';
  startCamStream();
}

function captureCamera(){
  var v = document.getElementById('camVideo');
  if(!v || !v.videoWidth){ toast('La camara aun no esta lista'); return; }
  var side = Math.min(v.videoWidth, v.videoHeight);
  var sx = (v.videoWidth - side) / 2;
  var sy = (v.videoHeight - side) / 2;
  var canvas = document.createElement('canvas');
  canvas.width = side; canvas.height = side;
  var ctx = canvas.getContext('2d');
  if(_camFacing === 'user'){ ctx.translate(side,0); ctx.scale(-1,1); }
  ctx.drawImage(v, sx, sy, side, side, 0, 0, side, side);
  var petId = _camPetId;
  closeCamera();
  toast('Procesando foto...');
  canvas.toBlob(function(blob){
    if(!blob){ toast('No se pudo capturar la foto'); return; }
    var file = new File([blob], 'foto.jpg', { type:'image/jpeg' });
    compressImage(file, function(dataUrl){
      if(!dataUrl){ toast('No se pudo procesar la imagen'); return; }
      var pet = db.pets.find(function(p){ return p.id === petId; });
      if(!pet){ return; }
      pet.photo = dataUrl;
      saveDB();
      openPetDetail(petId);
      toast('Foto actualizada');
    });
  }, 'image/jpeg', 0.9);
}

function closeCamera(){
  window.removeEventListener('popstate', _camPopState);
  if(_camStream){ _camStream.getTracks().forEach(function(t){ t.stop(); }); _camStream = null; }
  var ov = document.getElementById('cameraOverlay');
  if(ov && ov.parentNode){ ov.parentNode.removeChild(ov); }
  _camFacing = 'environment';
}
