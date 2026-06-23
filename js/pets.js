// En movil arranca en lista (mas comodo); en desktop en grilla.
let petViewMode = (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ? 'list' : 'grid';

function renderPets() {
  const species = [...new Set(db.pets.map(p=>p.species).filter(Boolean))];
  return `
    <div class="page-header">
      <div class="title"><small>Fichas clínicas</small><h1>Pacientes</h1></div>
      <div style="display:flex;gap:8px;align-items:center">
        <div class="view-toggle">
          <button class="btn btn-sm ${petViewMode==='grid'?'active':''}" onclick="setPetView('grid')" title="Vista grilla">⊞</button>
          <button class="btn btn-sm ${petViewMode==='list'?'active':''}" onclick="setPetView('list')" title="Vista lista">☰</button>
        </div>
        <button class="btn btn-primary" onclick="openPetModal()">+ Nuevo paciente</button>
      </div>
    </div>
    <div class="search-bar">
      <input type="text" id="petSearch" placeholder="Buscar por nombre, especie, raza..." oninput="filterPets()">
    </div>
    <div class="patient-filters">
      <select id="filterSpecies" onchange="filterPets()">
        <option value="">Todas las especies</option>
        ${species.map(s=>`<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('')}
      </select>
      <select id="filterSex" onchange="filterPets()">
        <option value="">Cualquier sexo</option>
        <option value="Macho">Macho</option>
        <option value="Hembra">Hembra</option>
      </select>
      <select id="filterChronic" onchange="filterPets()">
        <option value="">Todas las condiciones</option>
        <option value="con">Con condición crónica</option>
        <option value="sin">Sin condición crónica</option>
      </select>
      <button class="btn btn-sm" onclick="clearPetFilters()">${iconX()} Limpiar</button>
    </div>
    <div id="petsGrid">
      ${renderPetItems(db.pets)}
    </div>
  `;
}

function setPetView(mode) {
  petViewMode = mode;
  filterPets();
  document.querySelectorAll('.view-toggle button').forEach((b,i)=>{
    b.classList.toggle('active', (i===0 && mode==='grid')||(i===1 && mode==='list'));
  });
}

function clearPetFilters() {
  ['petSearch','filterSpecies','filterSex','filterChronic'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  filterPets();
}

function filterPets() {
  const q = (document.getElementById('petSearch')?.value||'').toLowerCase();
  const sp = document.getElementById('filterSpecies')?.value||'';
  const sx = document.getElementById('filterSex')?.value||'';
  const ch = document.getElementById('filterChronic')?.value||'';
  const filtered = db.pets.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) && !(p.species||'').toLowerCase().includes(q) && !(p.breed||'').toLowerCase().includes(q)) return false;
    if (sp && (p.species||'') !== sp) return false;
    if (sx && (p.sex||'') !== sx) return false;
    if (ch === 'con' && !p.chronicConditions) return false;
    if (ch === 'sin' && p.chronicConditions) return false;
    return true;
  });
  const grid = document.getElementById('petsGrid');
  if (grid) grid.innerHTML = filtered.length === 0
    ? '<div class="empty-state"><div class="ico">⊘</div>Sin resultados</div>'
    : renderPetItems(filtered);
}

function renderPetItems(pets) {
  if (petViewMode === 'list') return renderPetList(pets);
  return `<div class="pets-grid">${pets.length===0?'<div class="empty-state" style="grid-column:1/-1"><div class="ico">◉</div>Sin pacientes registrados.</div>':pets.map(petCardHTML).join('')}</div>`;
}

function renderPetList(pets) {
  if (pets.length === 0) return '<div class="empty-state"><div class="ico">◉</div>Sin pacientes registrados.</div>';
  return `<div class="table-wrap pet-list-table"><table>
    <thead><tr><th></th><th>Nombre</th><th class="col-sec">Especie/Raza</th><th class="col-sec">Sexo</th><th class="col-sec">Edad</th><th>Tutor</th><th class="col-sec">Estado</th><th></th></tr></thead>
    <tbody>${pets.map(p => {
      const owners = (p.ownerIds||[]).map(id=>db.owners.find(o=>o.id===id)).filter(Boolean);
      const age = p.birthdate ? calcAge(p.birthdate) : '—';
      const statusTag = p.chronicConditions ? '<span class="tag danger">Crónico</span>' : p.allergies ? '<span class="tag warning">Alergia</span>' : '<span class="tag">OK</span>';
      return `<tr>
        <td><div class="pet-mini-avatar${p.photo?'':' is-silhouette'}" style="${petPhotoStyle(p)}"></div></td>
        <td><a style="cursor:pointer;color:var(--accent);font-weight: var(--fw-bold)" onclick="openPetDetail('${p.id}')">${escapeHtml(p.name)}</a></td>
        <td class="col-sec">${escapeHtml(p.species||'—')} / ${escapeHtml(p.breed||'—')}</td>
        <td class="col-sec">${escapeHtml(p.sex||'—')}</td>
        <td class="col-sec">${age}</td>
        <td>${owners.length ? escapeHtml(owners[0].name) : '—'}</td>
        <td class="col-sec">${statusTag}</td>
        <td><div class="actions"><button class="btn btn-sm" onclick="openPetDetail('${p.id}')">Ver</button><button class="btn btn-sm" onclick="openPetModal('${p.id}')">Editar</button></div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function petSilhouette(species) {
  const s = (species || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  const map = [
    [/perr|cachorr|canin|can\b/, 'perro'],
    [/gat|felin|minin/, 'gato'],
    [/conej|liebr|cobay|cuy/, 'conejo'],
    [/ave|pajar|pajaro|loro|cotorr|canari|periquit|cacatu|agapor|ninfa|pollo|gallin|pat[oa]/, 'ave'],
    [/tortug|reptil|iguan|lagart|galapag|quelon/, 'tortuga'],
    [/raton|rat[oó]n|hamster|jerbo|chinchill|huron|ardilla|roedor/, 'roedor'],
    [/pez|pec|carp|gold|betta|acuari/, 'pez'],
    [/caball|equin|yegua|poni|pony|potr/, 'caballo'],
  ];
  let icon = 'patita';
  for (const [re, name] of map) { if (re.test(s)) { icon = name; break; } }
  return 'assets/pets/' + icon + '.png';
}
function petPhotoStyle(p) {
  const src = p.photo ? p.photo : petSilhouette(p.species);
  return `background-image:url('${src}')`;
}

function petCardHTML(p) {
  const owners = (p.ownerIds || []).map(id => db.owners.find(o => o.id === id)).filter(Boolean);
  const age = p.birthdate ? calcAge(p.birthdate) : '—';
  return `
    <div class="pet-card" onclick="openPetDetail('${p.id}')">
      <div class="pet-photo${p.photo ? '' : ' is-silhouette'}" style="${petPhotoStyle(p)}"></div>
      <div class="pet-card-body">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="meta">${escapeHtml(p.species || '—')} · ${escapeHtml(p.breed || '—')}</div>
        <div class="meta">${age} ${p.sex ? '· ' + escapeHtml(p.sex) : ''}</div>
        <div class="tags">
          ${owners.length ? `<span class="tag">${escapeHtml(owners[0].name)}${owners.length > 1 ? ` +${owners.length-1}` : ''}</span>` : ''}
          ${p.allergies ? '<span class="tag warning">Alergias</span>' : ''}
          ${p.chronicConditions ? '<span class="tag danger">Crónico</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

function attachPetListeners() {}

function openPetModal(id) {
  const pet = id ? db.pets.find(p => p.id === id) : { id: uid(), ownerIds: [] };
  const isNew = !id;
  const ownerItems = db.owners.map(o => ({ id:o.id, label:o.name + (o.dni?' · DNI '+o.dni:''), search:(o.name||'')+' '+(o.dni||'') }));
  const speciesCommon = ['Perro','Gato','Conejo','Ave','Tortuga','Roedor','Pez','Caballo','Otro'];
  const curSp = pet.species||'';
  const spOpts = speciesCommon.map(s=>`<option value="${s}" ${curSp===s?'selected':''}>${s}</option>`).join('')
    + (curSp && speciesCommon.indexOf(curSp)===-1 ? `<option value="${escapeAttr(curSp)}" selected>${escapeHtml(curSp)}</option>` : '');

  showModal(`
    <div class="modal-header">
      <h2>${isNew ? 'Nuevo paciente' : 'Editar paciente'}</h2>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Nombre *</label><input type="text" id="pName" value="${escapeAttr(pet.name||'')}" aria-required="true"><span class="field-error"></span></div>
        <div class="form-group"><label>Especie</label><select id="pSpecies"><option value="">—</option>${spOpts}</select></div>
      </div>
      <div class="form-row-3">
        <div class="form-group"><label>Raza</label><input type="text" id="pBreed" value="${escapeAttr(pet.breed||'')}"></div>
        <div class="form-group"><label>Sexo</label><select id="pSex"><option value="">—</option><option ${pet.sex==='Macho'?'selected':''}>Macho</option><option ${pet.sex==='Hembra'?'selected':''}>Hembra</option></select></div>
        <div class="form-group"><label>Color / Pelaje</label><input type="text" id="pColor" value="${escapeAttr(pet.color||'')}"></div>
      </div>
      <div class="form-row-3">
        <div class="form-group"><label>Fecha nacimiento</label><input type="date" id="pBirth" value="${pet.birthdate||''}"></div>
        <div class="form-group"><label>Peso (kg)</label><input type="number" step="0.1" id="pWeight" value="${pet.weight||''}"></div>
        <div class="form-group"><label>Microchip</label><input type="text" id="pChip" value="${escapeAttr(pet.microchip||'')}"></div>
      </div>
      <div class="form-group">
        <label>Tutores asociados</label>
        ${db.owners.length ? assocPicker('petOwnersPicker', ownerItems, pet.ownerIds||[]) : '<small style="color:var(--text-mute)">No hay tutores todavía. Creá uno en la sección Tutores.</small>'}
      </div>
      <div class="form-group"><label>Alergias conocidas</label><textarea id="pAllergies">${escapeHtml(pet.allergies||'')}</textarea></div>
      <div class="form-group"><label>Condiciones crónicas</label><textarea id="pChronic">${escapeHtml(pet.chronicConditions||'')}</textarea></div>
      <div class="form-group"><label>Notas generales</label><textarea id="pNotes">${escapeHtml(pet.notes||'')}</textarea></div>
    </div>
    <div class="modal-footer">
      ${!isNew ? `<button class="btn btn-danger" onclick="deletePet('${pet.id}')">Eliminar</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="savePet('${pet.id}', ${isNew})">Guardar</button>
    </div>
  `);
}

function savePet(id, isNew) {
  const name = document.getElementById('pName').value.trim();
  if (!validateField('pName', !!name, 'El nombre es obligatorio')) return;
  const ownerIds = document.getElementById('petOwnersPicker') ? getAssocSelected('petOwnersPicker') : (id ? (db.pets.find(p=>p.id===id)||{}).ownerIds||[] : []);
  const data = {
    id,
    name,
    species: document.getElementById('pSpecies').value.trim(),
    breed: document.getElementById('pBreed').value.trim(),
    sex: document.getElementById('pSex').value,
    color: document.getElementById('pColor').value.trim(),
    birthdate: document.getElementById('pBirth').value,
    weight: document.getElementById('pWeight').value,
    microchip: document.getElementById('pChip').value.trim(),
    ownerIds,
    allergies: document.getElementById('pAllergies').value.trim(),
    chronicConditions: document.getElementById('pChronic').value.trim(),
    notes: document.getElementById('pNotes').value.trim(),
  };
  if (isNew) {
    data.history = [];
    data.images = [];
    data.photo = '';
    db.pets.push(data);
  } else {
    const idx = db.pets.findIndex(p => p.id === id);
    db.pets[idx] = { ...db.pets[idx], ...data };
  }
  saveDB();
  closeModal();
  render();
  toast(isNew ? 'Paciente creado' : 'Paciente actualizado');
}

function deletePet(id) {
  showConfirm('¿Eliminar este paciente y toda su historia clínica? Esta acción no se puede deshacer.', () => {
    db.pets = db.pets.filter(p => p.id !== id);
    db.appointments = db.appointments.filter(a => a.petId !== id);
    db.groomingAppointments = db.groomingAppointments.filter(a => a.petId !== id);
    db.reminders = db.reminders.filter(r => r.petId !== id);
    saveDB(); closeModal(); render(); toast('Paciente eliminado');
  });
}

// ========================================
// [11b] FICHA DE PACIENTE (PET DETAIL) — historia, estudios, fotos, vacunas
// ========================================
function openPetDetail(id) {
  const pet = db.pets.find(p => p.id === id);
  if (!pet) return;
  const owners = (pet.ownerIds||[]).map(oid => db.owners.find(o => o.id === oid)).filter(Boolean);
  const age = pet.birthdate ? calcAge(pet.birthdate) : '—';

  showModal(`
    <div class="modal-header">
      <h2>Ficha clínica</h2>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="pet-header">
        <div class="pet-avatar${pet.photo ? '' : ' is-silhouette'}" style="${petPhotoStyle(pet)};cursor:pointer" title="Click para cambiar foto" onclick="choosePhotoSource('${pet.id}')"></div>
        <div class="pet-info" style="flex:1">
          <h2>${escapeHtml(pet.name)}</h2>
          <div class="meta">${escapeHtml(pet.species||'—')} · ${escapeHtml(pet.breed||'—')} · ${age}</div>
          <div class="meta">${pet.sex||''} ${pet.weight ? '· '+pet.weight+'kg' : ''} ${pet.microchip ? '· chip '+pet.microchip : ''}</div>
        </div>
        <button class="btn btn-sm btn-primary" onclick="closeModal();openApptModal(null,'${pet.id}')">+ Turno</button>
        <button class="btn btn-sm" onclick="closeModal();openPetModal('${pet.id}')">Editar datos</button>
      </div>

      <div class="tabs">
        <div class="tab active" onclick="switchTab(event, 'tab-history')">Historia clínica</div>
        <div class="tab" onclick="switchTab(event, 'tab-owners')">Tutores</div>
        <div class="tab" onclick="switchTab(event, 'tab-images')">Estudios e imágenes</div>
        <div class="tab" onclick="switchTab(event, 'tab-vacc')">Vacunas y desparasitación</div>
        <div class="tab" onclick="switchTab(event, 'tab-info')">Datos</div>
      </div>

      <div id="tab-history" class="tab-content active">
        <div class="section-title">
          <h3>Registros clínicos</h3>
          <button class="btn btn-sm btn-primary" onclick="addHistoryEntry('${pet.id}')">+ Nuevo registro</button>
        </div>
        ${(pet.history||[]).length === 0 ? '<div class="empty-state">Sin registros aún</div>' :
          [...pet.history].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(h => `
            <div class="history-entry">
              <button class="close-btn delete-x" onclick="deleteHistory('${pet.id}','${h.id}')">&times;</button>
              <div class="date">${formatDate(h.date)} · ${escapeHtml(h.type||'Consulta')}</div>
              <div class="title">${escapeHtml(h.title||'')}</div>
              <div class="desc">${escapeHtml(h.description||'').replace(/\n/g,'<br>')}</div>
              ${h.treatment ? `<div class="desc" style="margin-top:6px"><strong>Tratamiento:</strong> ${escapeHtml(h.treatment)}</div>` : ''}
              ${h.vet ? `<div class="desc" style="margin-top:4px;font-size:var(--fs-2xs);color:var(--text-mute)">Profesional: ${escapeHtml(h.vet)}</div>` : ''}
            </div>
          `).join('')
        }
      </div>

      <div id="tab-owners" class="tab-content">
        <div class="section-title">
          <h3>Personas asociadas</h3>
        </div>
        ${owners.length === 0 ? '<div class="empty-state">Sin tutores asociados. Edita el paciente para agregar.</div>' : owners.map(o => ownerCardHTML(o, pet.name)).join('')}
      </div>

      <div id="tab-images" class="tab-content">
        <div class="section-title">
          <h3>Estudios clínicos (links a Drive)</h3>
          <button class="btn btn-sm btn-primary" onclick="addStudyLink('${pet.id}')">+ Agregar estudio</button>
        </div>
        <small style="color:var(--text-mute)">Pegá el link de Google Drive de cada estudio: radiografías, ecografías, análisis, recetas, etc.</small>
        <div class="study-list">
          ${(pet.studies||[]).length === 0
            ? `<div class="empty-state">Sin estudios cargados. <a href="#" onclick="addStudyLink('${pet.id}');return false">+ Agregar el primero</a></div>`
            : pet.studies.map(s => `
            <div class="study-item">
              <div class="study-icon">${studyIcon(s.type)}</div>
              <div class="study-body">
                <a href="${escapeAttr(s.url)}" target="_blank" rel="noopener" class="study-title">${escapeHtml(s.title || s.type || 'Estudio')}</a>
                <div class="study-meta">${escapeHtml(s.type || 'Estudio')}${s.date ? ' · ' + formatDate(s.date) : ''}</div>
              </div>
              <button class="btn btn-sm" onclick="editStudyLink('${pet.id}','${s.id}')">Editar</button>
              <button class="img-x study-x" onclick="deleteStudyLink('${pet.id}','${s.id}')">×</button>
            </div>
          `).join('')}
        </div>

        <div class="section-title" style="margin-top:18px">
          <h3>Fotos del paciente</h3>
          <label class="btn btn-sm btn-primary" style="cursor:pointer">+ Subir foto<input type="file" accept="image/*" multiple onchange="uploadPetImages('${pet.id}', this)" style="display:none"></label>
        </div>
        <small style="color:var(--text-mute)">Evolución física, heridas, pelaje. Se guardan en el dispositivo.</small>
        <div class="image-gallery">
          ${(pet.images||[]).length === 0 ? '<div class="empty-state" style="grid-column:1/-1">Sin fotos adjuntas</div>' : pet.images.map(img => `
            <div class="img-item">
              <img src="${img.data}" onclick="openLightbox('${img.data}')">
              <button class="img-x" onclick="deletePetImage('${pet.id}','${img.id}')">×</button>
              <div class="img-label">${escapeHtml(img.label||img.name||'Imagen')}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div id="tab-vacc" class="tab-content">
        <div class="section-title">
          <h3>Vacunas aplicadas</h3>
          <button class="btn btn-sm btn-primary" onclick="addVaccine('${pet.id}')">+ Vacuna</button>
        </div>
        ${(pet.vaccines||[]).length === 0 ? '<div class="empty-state">Sin vacunas registradas</div>' : pet.vaccines.map(v => `
          <div class="history-entry">
            <button class="close-btn delete-x" onclick="deleteVaccine('${pet.id}','${v.id}')">&times;</button>
            <div class="date">${formatDate(v.date)}</div>
            <div class="title">${escapeHtml(v.name)}</div>
            ${v.nextDose ? `<div class="desc">Próxima dosis: ${formatDate(v.nextDose)}</div>` : ''}
          </div>
        `).join('')}
      </div>

      <div id="tab-info" class="tab-content">
        <h3 style="margin-bottom:10px">Información general</h3>
        ${pet.allergies ? `<p style="margin-bottom:10px"><strong>Alergias:</strong> ${escapeHtml(pet.allergies)}</p>` : ''}
        ${pet.chronicConditions ? `<p style="margin-bottom:10px"><strong>Condiciones crónicas:</strong> ${escapeHtml(pet.chronicConditions)}</p>` : ''}
        ${pet.notes ? `<p style="margin-bottom:10px"><strong>Notas:</strong> ${escapeHtml(pet.notes)}</p>` : ''}
        ${(!pet.allergies && !pet.chronicConditions && !pet.notes) ? '<div class="empty-state">Sin información adicional registrada</div>' : ''}
      </div>
    </div>
  `, true);
}

function switchTab(e, id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById(id).classList.add('active');
}

// Comprime una imagen en el navegador a <100KB (canvas + JPEG con calidad decreciente)
function compressImage(file, cb){
  if(!file || !file.type || file.type.indexOf('image/')!==0){ cb(null); return; }
  var reader=new FileReader();
  reader.onload=function(ev){
    var img=new Image();
    img.onload=function(){
      var MAX=600; // lado mas largo
      var w=img.width, hgt=img.height;
      if(w>hgt){ if(w>MAX){ hgt=Math.round(hgt*MAX/w); w=MAX; } }
      else { if(hgt>MAX){ w=Math.round(w*MAX/hgt); hgt=MAX; } }
      var canvas=document.createElement('canvas');
      canvas.width=w; canvas.height=hgt;
      var ctx=canvas.getContext('2d');
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,hgt); // fondo blanco para PNG con transparencia
      ctx.drawImage(img,0,0,w,hgt);
      var TARGET=50*1024; // 50 KB
      var q=0.85, out=canvas.toDataURL('image/jpeg',q);
      // bajar calidad hasta entrar en 100KB (o llegar a q minima)
      while(out.length>TARGET*1.37 && q>0.4){ q-=0.1; out=canvas.toDataURL('image/jpeg',q); }
      // si aun es grande, reducir tamano y reintentar una vez
      if(out.length>TARGET*1.37){
        var c2=document.createElement('canvas');
        c2.width=Math.round(w*0.7); c2.height=Math.round(hgt*0.7);
        var x2=c2.getContext('2d'); x2.fillStyle='#fff'; x2.fillRect(0,0,c2.width,c2.height);
        x2.drawImage(img,0,0,c2.width,c2.height);
        q=0.7; out=c2.toDataURL('image/jpeg',q);
        while(out.length>TARGET*1.37 && q>0.4){ q-=0.1; out=c2.toDataURL('image/jpeg',q); }
      }
      cb(out);
    };
    img.onerror=function(){ cb(null); };
    img.src=ev.target.result;
  };
  reader.onerror=function(){ cb(null); };
  reader.readAsDataURL(file);
}

function uploadPetPhoto(petId, input) {
  const file = input.files[0];
  if (!file) return;
  toast('Procesando foto...');
  compressImage(file, (dataUrl) => {
    if(!dataUrl){ toast('No se pudo procesar la imagen'); return; }
    const pet = db.pets.find(p => p.id === petId);
    pet.photo = dataUrl;
    saveDB();
    closeModal();
    openPetDetail(petId);
    toast('Foto actualizada');
  });
}

function uploadPetImages(petId, input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const pet = db.pets.find(p => p.id === petId);
  pet.images = pet.images || [];
  toast('Procesando imágenes...');
  let pending = files.length;
  files.forEach(file => {
    const label = prompt(`Etiqueta para "${file.name}" (ej: Rx tórax 10/04):`, file.name);
    compressImage(file, (dataUrl) => {
      if(dataUrl){
        pet.images.push({
          id: uid(),
          name: file.name,
          label: label || file.name,
          data: dataUrl,
          date: new Date().toISOString()
        });
      }
      pending--;
      if (pending === 0) {
        saveDB();
        closeModal();
        openPetDetail(petId);
        toast('Imágenes guardadas');
      }
    });
  });
}

function deletePetImage(petId, imgId) {
  showConfirm('¿Eliminar esta imagen?', () => {
  const pet = db.pets.find(p => p.id === petId);
  pet.images = pet.images.filter(i => i.id !== imgId);
  saveDB();
  closeModal();
  openPetDetail(petId);
  toast('Imagen eliminada');
});
}

const STUDY_TYPES = ['Radiografía','Ecografía','Análisis de laboratorio','Receta','Informe','Otro'];

function studyIcon(type) {
  const map = { 'Radiografía':'🩻','Ecografía':'🔊','Análisis de laboratorio':'🧪','Receta':'📋','Informe':'📄' };
  return map[type] || '🔗';
}

function normalizeUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

function studyModal(petId, study, studyId) {
  const opts = STUDY_TYPES.map(t => `<option value="${t}" ${study.type===t?'selected':''}>${t}</option>`).join('');
  showModal(`
    <div class="modal-header"><h2>${studyId ? 'Editar estudio' : 'Nuevo estudio'}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Tipo de estudio</label><select id="studyType">${opts}</select></div>
        <div class="form-group"><label>Fecha del estudio</label><input type="date" id="studyDate" value="${study.date||''}"></div>
      </div>
      <div class="form-group"><label>Título / descripción</label><input type="text" id="studyTitle" value="${escapeAttr(study.title||'')}" placeholder="Ej: Rx tórax control"></div>
      <div class="form-group"><label>Link de Google Drive</label><input type="url" id="studyUrl" value="${escapeAttr(study.url||'')}" placeholder="https://drive.google.com/..."></div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveStudyLink('${petId}'${studyId ? `,'${studyId}'` : ''})">Guardar</button>
    </div>
  `);
}

function addStudyLink(petId) {
  studyModal(petId, {});
}

function editStudyLink(petId, studyId) {
  const pet = db.pets.find(p => p.id === petId);
  const study = (pet.studies||[]).find(s => s.id === studyId);
  if (!study) return;
  studyModal(petId, study, studyId);
}

function saveStudyLink(petId, studyId) {
  const url = normalizeUrl(document.getElementById('studyUrl').value);
  if (!url) { toast('Pegá un link válido'); return; }
  const pet = db.pets.find(p => p.id === petId);
  pet.studies = pet.studies || [];
  const data = {
    type: document.getElementById('studyType').value,
    title: document.getElementById('studyTitle').value.trim(),
    date: document.getElementById('studyDate').value,
    url
  };
  if (studyId) {
    const s = pet.studies.find(x => x.id === studyId);
    Object.assign(s, data);
  } else {
    pet.studies.push({ id: uid(), ...data });
  }
  saveDB();
  closeModal();
  openPetDetail(petId);
  toast('Estudio guardado');
}

function deleteStudyLink(petId, studyId) {
  const pet = db.pets.find(p => p.id === petId);
  const study = (pet.studies||[]).find(s => s.id === studyId);
  const name = study ? (study.title || study.type || 'estudio') : 'estudio';
  showConfirm(`¿Eliminar "${name}"?`, () => {
    pet.studies = (pet.studies||[]).filter(s => s.id !== studyId);
    saveDB();
    closeModal();
    openPetDetail(petId);
    toast('Estudio eliminado');
  });
}

function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('show');
}

function addHistoryEntry(petId, editId) {
  const pet = db.pets.find(p => p.id === petId);
  const ex = editId ? (pet.history||[]).find(h => h.id === editId) : null;
  const today = new Date().toISOString().split('T')[0];
  const ev = (f) => ex ? escapeHtml(ex[f]||''): '';
  const types = ['Consulta general','Control','Urgencia','Cirugía','Vacunación','Laboratorio','Otro'];
  showModal(`
    <div class="modal-header">
      <h2>${ex ? 'Editar consulta' : 'Nueva consulta clínica'}</h2>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-row-3">
        <div class="form-group"><label>Fecha *</label>
          <input type="date" id="hDate" value="${ex ? ex.date : today}"></div>
        <div class="form-group"><label>Tipo de consulta</label>
          <select id="hType">${types.map(t=>`<option ${ex&&ex.type===t?'selected':''} value="${t}">${t}</option>`).join('')}</select></div>
        <div class="form-group"><label>Profesional</label>
          <input type="text" id="hVet" value="${ev('vet')}" placeholder="Dr. García"></div>
      </div>
      <div style="background:var(--color-mint-soft);padding:12px;border-radius:var(--radius-sm);margin-bottom:12px">
        <div style="font-size:var(--fs-2xs);font-weight: var(--fw-bold);color:var(--text-soft);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">⚕ Signos vitales</div>
        <div class="form-row-3">
          <div class="form-group"><label>⚖ Peso (kg)</label>
            <input type="number" id="hWeight" step="0.1" placeholder="4.5" value="${ex?ex.weight||'':''}"></div>
          <div class="form-group"><label>🌡 Temperatura (°C)</label>
            <input type="number" id="hTemp" step="0.1" placeholder="38.5" value="${ex?ex.temp||'':''}"></div>
          <div class="form-group"><label>♥ FC (lpm)</label>
            <input type="number" id="hHR" placeholder="80" value="${ex?ex.hr||'':''}"></div>
        </div>
      </div>
      <div class="form-group"><label>Motivo de consulta *</label>
        <input type="text" id="hTitle" placeholder="¿Por qué viene hoy?" value="${ev('title')}"></div>
      <div class="form-group"><label>Examen físico</label>
        <textarea id="hExam" rows="3" placeholder="Hallazgos del examen físico...">${ev('exam')}</textarea></div>
      <div class="form-group"><label>Diagnóstico</label>
        <input type="text" id="hDiag" placeholder="Diagnóstico presuntivo o definitivo" value="${ev('diagnosis')}"></div>
      <div class="form-group"><label>Tratamiento / Prescripción</label>
        <textarea id="hTreat" rows="3" placeholder="Medicamentos, dosis, duración...">${ev('treatment')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Próximo control</label>
          <input type="date" id="hNext" value="${ex?ex.nextControl||'':''}"></div>
        <div class="form-group"><label>Observaciones</label>
          <input type="text" id="hDesc" value="${ev('description')}" placeholder="Notas adicionales"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      ${ex ? `<button class="btn btn-secondary" onclick="printHistEntry('${petId}','${editId}')">🖨 Imprimir</button>` : ''}
      <button class="btn btn-primary" onclick="saveHistory('${petId}','${editId||''}')">💾 Guardar consulta</button>
    </div>
  `, false);
}

function saveHistory(petId, editId) {
  const date = document.getElementById('hDate').value;
  const title = document.getElementById('hTitle').value.trim();
  if (!date || !title) { toast('Completá fecha y motivo', 'error'); return; }
  const pet = db.pets.find(p => p.id === petId);
  if (!pet) return;
  pet.history = pet.history || [];
  const weight = document.getElementById('hWeight').value;
  const temp = document.getElementById('hTemp').value;
  const entry = {
    id: editId || uid(), date,
    type: document.getElementById('hType').value,
    vet: document.getElementById('hVet').value,
    weight, temp, hr: document.getElementById('hHR').value,
    title, exam: document.getElementById('hExam').value,
    diagnosis: document.getElementById('hDiag').value,
    treatment: document.getElementById('hTreat').value,
    nextControl: document.getElementById('hNext').value,
    description: document.getElementById('hDesc').value
  };
  if (editId) {
    const idx = pet.history.findIndex(h => h.id === editId);
    if (idx > -1) pet.history[idx] = entry; else pet.history.unshift(entry);
  } else { pet.history.unshift(entry); }
  if (weight || temp) {
    pet.vitals = pet.vitals || [];
    const vi = pet.vitals.find(v => v.date === date);
    if (vi) { if(weight)vi.weight=parseFloat(weight); if(temp)vi.temp=parseFloat(temp); }
    else pet.vitals.push({date, weight:weight?parseFloat(weight):null, temp:temp?parseFloat(temp):null});
    pet.vitals.sort((a,b)=>a.date.localeCompare(b.date));
  }
  if (entry.nextControl) {
    db.reminders.push({id:uid(),title:'Control: '+title,petId,date:entry.nextControl,type:'control',completed:false});
  }
  saveDB(); closeModal(); openPetDetail(petId);
  toast(editId ? 'Consulta actualizada ✓' : 'Consulta registrada ✓');
}

function printHistEntry(petId, hId) {
  const pet = db.pets.find(p => p.id === petId);
  const h = (pet&&pet.history)?pet.history.find(x=>x.id===hId):null;
  if (!pet||!h) return;
  const owner = pet.ownerIds&&pet.ownerIds[0]?db.owners.find(o=>o.id===pet.ownerIds[0]):null;
  const w = window.open('','_blank');
  w.document.write('<!DOCTYPE html><html><head><title>Historia Clinica</title>'
    +'<style>body{font-family:Georgia,serif;padding:40px;max-width:680px;margin:auto;color:#1a1a1a}'
    +'h1{font-size:1.5rem;margin-bottom:4px}h2{font-size:.95rem;margin:18px 0 5px;border-bottom:1px solid #ddd;padding-bottom:3px;text-transform:uppercase;letter-spacing:.05em;color:#555}'
    +'.meta{color:#666;font-size:.9rem;margin-bottom:20px;padding:10px;background:#f9f9f9;border-radius:4px}'
    +'.vitals{display:flex;gap:20px;background:#f1e7fb;padding:12px;border-radius:6px;margin:12px 0}'
    +'.vit{text-align:center}.vit strong{display:block;font-size:1.2rem}.vit small{color:#666;font-size:.8rem}'
    +'p{margin:6px 0;line-height:1.7}@media print{button{display:none}}</style></head><body>'
    +'<h1>'+escapeHtml(db.clinicName||'VetCare')+' \u2014 Historia Cl\u00ednica</h1>'
    +'<div class="meta">Paciente: <strong>'+escapeHtml(pet.name)+'</strong> \u00b7 '+(pet.species||'')+' '+(pet.breed||'')+'<br>'
    +'Tutor: '+(owner?escapeHtml(owner.name):'\u2014')+' \u00b7 Fecha: '+formatDate(h.date)+' \u00b7 Tipo: '+(h.type||'Consulta')+' \u00b7 Prof: '+(h.vet||'\u2014')+'</div>'
    +((h.weight||h.temp||h.hr)?('<div class="vitals">'
      +(h.weight?'<div class="vit"><strong>'+h.weight+' kg</strong><small>Peso</small></div>':'')
      +(h.temp?'<div class="vit"><strong>'+h.temp+' \u00b0C</strong><small>Temperatura</small></div>':'')
      +(h.hr?'<div class="vit"><strong>'+h.hr+' lpm</strong><small>FC</small></div>':'')
      +'</div>'):'')
    +(h.title?'<h2>Motivo</h2><p>'+escapeHtml(h.title)+'</p>':'')
    +(h.exam?'<h2>Examen f\u00edsico</h2><p>'+escapeHtml(h.exam)+'</p>':'')
    +(h.diagnosis?'<h2>Diagn\u00f3stico</h2><p>'+escapeHtml(h.diagnosis)+'</p>':'')
    +(h.treatment?'<h2>Tratamiento</h2><p>'+escapeHtml(h.treatment)+'</p>':'')
    +(h.description?'<h2>Observaciones</h2><p>'+escapeHtml(h.description)+'</p>':'')
    +(h.nextControl?'<h2>Pr\u00f3ximo control</h2><p>'+formatDate(h.nextControl)+'</p>':'')
    +'<br><button onclick="window.print()">\uD83D\uDDB8 Imprimir</button></body></html>');
  w.document.close();
}

function deleteHistory(petId, hId) {
  showConfirm('¿Eliminar este registro clínico?', () => {
  const pet = db.pets.find(p => p.id === petId);
  pet.history = pet.history.filter(h => h.id !== hId);
  saveDB();
  closeModal();
  openPetDetail(petId);
  toast('Registro eliminado');
});
}

function addVaccine(petId) {
  showModal(`
    <div class="modal-header"><h2>Registrar vacuna</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Vacuna</label><input type="text" id="vName" placeholder="Ej: Antirrábica"></div>
      <div class="form-row">
        <div class="form-group"><label>Fecha aplicación</label><input type="date" id="vDate" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Próxima dosis</label><input type="date" id="vNext"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveVaccine('${petId}')">Guardar</button>
    </div>
  `);
}

function saveVaccine(petId) {
  const pet = db.pets.find(p => p.id === petId);
  pet.vaccines = pet.vaccines || [];
  const next = document.getElementById('vNext').value;
  const name = document.getElementById('vName').value;
  pet.vaccines.push({
    id: uid(),
    name,
    date: document.getElementById('vDate').value,
    nextDose: next
  });
  if (next) {
    db.reminders.push({
      id: uid(),
      title: `Refuerzo de ${name}`,
      petId,
      date: next,
      type: 'vaccine',
      completed: false,
      notes: 'Recordatorio automático de vacuna'
    });
  }
  saveDB();
  closeModal();
  openPetDetail(petId);
  toast('Vacuna registrada' + (next ? ' + recordatorio creado' : ''));
}

function deleteVaccine(petId, vId) {
  showConfirm('¿Eliminar este registro de vacuna?', () => {
  const pet = db.pets.find(p => p.id === petId);
  pet.vaccines = pet.vaccines.filter(v => v.id !== vId);
  saveDB();
  closeModal();
  openPetDetail(petId);
  toast('Vacuna eliminada');
});
}

// ========================================
// [12] VISTA: TUTORES (OWNERS)
// ========================================
