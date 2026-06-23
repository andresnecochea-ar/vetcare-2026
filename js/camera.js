/* =====================================================================
   CAMARA PERSONALIZADA - foto de paciente
   Abre la camara dentro de la app (getUserMedia), muestra una guia
   circular y recorta la foto al cuadrado central antes de comprimirla.
   Requiere HTTPS o localhost (Cloudflare ya es HTTPS).
   ===================================================================== */

var _camStream = null;
var _camPetId = null;
var _camFacing = 'environment';

function isMobileDevice(){
  return (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
    && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function choosePhotoSource(petId){
  var camOption = isMobileDevice()
    ? '<button class="btn btn-primary" style="width:100%;margin-bottom:10px" onclick="openCamera(\'' + petId + '\')">📷 Tomar foto</button>'
    : '';
  showModal(
    '<div class="modal-header"><h3>Foto del paciente</h3>'
    + '<button class="close-btn" onclick="closeModal()">&times;</button></div>'
    + '<div class="modal-body" style="text-align:center">'
    + camOption
    + '<label class="btn btn-secondary" style="width:100%;cursor:pointer;display:block">🖼️ Subir desde archivo'
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
