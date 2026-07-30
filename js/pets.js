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
    <thead><tr><th></th><th>Nombre</th><th class="col-sec">Especie/Raza</th><th class="col-sec">Sexo</th><th class="col-sec">Edad</th><th>Tutor</th><th>Pendientes</th><th class="col-sec">Estado</th><th></th></tr></thead>
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
        <td>${petAlertBadgeHTML(p) || '<span class="pet-alert-clear">Al día</span>'}</td>
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
          ${petAlertBadgeHTML(p, true)}
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
  const clinicalDisabled = canEditClinical() ? '' : ' disabled';
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
        <div class="form-group"><label>Peso (kg)</label><input type="number" step="0.1" id="pWeight" value="${pet.weight||''}"${clinicalDisabled}></div>
        <div class="form-group"><label>Microchip</label><input type="text" id="pChip" value="${escapeAttr(pet.microchip||'')}"></div>
      </div>
      <div class="form-group">
        <label>Tutores asociados</label>
        ${db.owners.length ? assocPicker('petOwnersPicker', ownerItems, pet.ownerIds||[]) : '<small style="color:var(--text-mute)">No hay tutores todavía. Creá uno en la sección Tutores.</small>'}
      </div>
      ${canEditClinical() ? '' : '<small style="display:block;color:var(--text-mute);margin-bottom:8px">Los datos clínicos son de solo lectura para Recepción.</small>'}
      <div class="form-group"><label>Alergias conocidas</label><textarea id="pAllergies"${clinicalDisabled}>${escapeHtml(pet.allergies||'')}</textarea></div>
      <div class="form-group"><label>Condiciones crónicas</label><textarea id="pChronic"${clinicalDisabled}>${escapeHtml(pet.chronicConditions||'')}</textarea></div>
      <div class="form-group"><label>Notas generales</label><textarea id="pNotes"${clinicalDisabled}>${escapeHtml(pet.notes||'')}</textarea></div>
    </div>
    <div class="modal-footer">
      ${!isNew && canDeleteEntity('pets') ? `<button class="btn btn-danger" onclick="deletePet('${pet.id}')">Eliminar</button>` : ''}
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
  saveDB(isNew ? 'Paciente creado' : 'Paciente actualizado');
  closeModal();
  render();
}

function deletePet(id) {
  if(!canDeleteEntity('pets')){ toast('Tu rol no permite eliminar pacientes'); return; }
  if ((db.invoices || []).some(invoice => invoice.petId === id && invoice.encounterId)) {
    toast('No podés eliminar un paciente con consultas vinculadas a recibos', 'error');
    return;
  }
  showConfirm('¿Eliminar este paciente y toda su historia clínica? Esta acción no se puede deshacer.', () => {
    db.pets = db.pets.filter(p => p.id !== id);
    db.appointments = db.appointments.filter(a => a.petId !== id);
    db.groomingAppointments = db.groomingAppointments.filter(a => a.petId !== id);
    db.reminders = db.reminders.filter(r => r.petId !== id);
    saveDB('Paciente eliminado');
    closeModal();
    if (currentView === 'pet-detail') closePetDetail();
    else render();
  });
}

// ========================================
// [11b] FICHA DE PACIENTE (PET DETAIL) — historia, estudios, fotos, vacunas
// ========================================
let currentPetId = null;
let petDetailReturnView = 'pets';
let petDetailReturnScrollY = 0;
let petDetailActiveTab = 'tab-followup';
let currentEncounterPetId = null;
let currentEncounterId = null;
let currentEncounterAppointmentId = null;

const ENCOUNTER_STATUSES = {
  draft: 'Borrador',
  in_progress: 'En curso',
  pending_results: 'Pendiente de resultados',
  ready_to_bill: 'Lista para cobrar',
  closed: 'Cerrada',
  reopened: 'Reabierta'
};
function encounterStatusLabel(status) { return ENCOUNTER_STATUSES[status] || ENCOUNTER_STATUSES.closed; }
function encounterStatusClass(status) { return 'encounter-status-' + (status || 'closed').replace(/_/g, '-'); }
function toggleEncounterReopenField(status) { const field = document.querySelector('.encounter-reopen-field'); if (field) field.classList.toggle('is-visible', status === 'reopened'); }


function openPetDetail(id) {
  const pet = db.pets.find(p => p.id === id);
  if (!pet) return;
  if (currentView !== 'pet-detail') {
    petDetailReturnView = currentView || 'pets';
    petDetailReturnScrollY = window.scrollY || 0;
  }
  if (currentPetId !== id) { petDetailActiveTab = 'tab-followup'; resetTimelineState(); }
  currentPetId = id;
  currentView = 'pet-detail';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const petsNav = document.querySelector('[data-view="pets"]');
  if (petsNav) petsNav.classList.add('active');
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (window.innerWidth < 769) closeSidebar();
}

function closePetDetail() {
  const returnView = petDetailReturnView === 'pet-detail' ? 'pets' : petDetailReturnView;
  const returnScroll = petDetailReturnScrollY;
  currentPetId = null;
  petDetailActiveTab = 'tab-followup';
  navigateTo(returnView || 'pets');
  requestAnimationFrame(() => window.scrollTo({ top: returnScroll, behavior: 'auto' }));
}

function renderPetDetail(id) {
  const pet = db.pets.find(p => p.id === id);
  if (!pet) {
    return '<div class="pet-detail-missing"><h1>Paciente no encontrado</h1><p>La ficha pudo haber sido eliminada o actualizada en otro equipo.</p><button class="btn btn-primary" onclick="navigateTo(\'pets\')">Volver a pacientes</button></div>';
  }
  renderPetDetailLegacy(id);
  const modal = document.querySelector('#modalContainer .modal');
  const body = modal && modal.querySelector('.modal-body');
  if (!body) {
    closeModal();
    return '<div class="pet-detail-missing"><h1>No se pudo abrir la ficha</h1><button class="btn btn-primary" onclick="navigateTo(\'pets\')">Volver a pacientes</button></div>';
  }

  const hero = body.querySelector('.pet-header');
  if (hero) hero.classList.add('pet-detail-hero');
  body.querySelectorAll('.tab').forEach(tab => {
    const active = (tab.getAttribute('onclick') || '').includes("'" + petDetailActiveTab + "'");
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  body.querySelectorAll('.tab-content').forEach(panel => panel.classList.toggle('active', panel.id === petDetailActiveTab));

  const history = [...(pet.history || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
  const owners = (pet.ownerIds || []).map(oid => db.owners.find(o => o.id === oid)).filter(Boolean);
  const nextAppointment = (db.appointments || [])
    .filter(a => a.petId === pet.id && a.date >= localDateKey() && !appointmentIsTerminal(a))
    .sort((a,b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`))[0];
  const summary = document.createElement('div');
  summary.className = 'pet-detail-summary';
  summary.setAttribute('aria-label', 'Resumen del paciente');
  summary.innerHTML = `
    <div class="pet-summary-item"><span>&Uacute;ltima atenci&oacute;n</span><strong>${history[0]?.date ? formatDate(history[0].date) : 'Sin registros'}</strong><small>${history[0]?.title ? escapeHtml(history[0].title) : 'Todavia no hay historia clinica'}</small></div>
    <div class="pet-summary-item"><span>Pr&oacute;ximo turno</span><strong>${nextAppointment ? formatDate(nextAppointment.date) : 'Sin turno'}</strong><small>${nextAppointment ? `${escapeHtml(nextAppointment.time || 'Sin hora')} &middot; ${escapeHtml(nextAppointment.type || 'Consulta')}` : 'No hay turnos programados'}</small></div>
    <div class="pet-summary-item"><span>Tutor principal</span><strong>${owners[0] ? escapeHtml(owners[0].name) : 'Sin asociar'}</strong><small>${owners[0]?.phone ? escapeHtml(owners[0].phone) : `${owners.length} tutor${owners.length === 1 ? '' : 'es'} asociado${owners.length === 1 ? '' : 's'}`}</small></div>`;
  if (hero) hero.insertAdjacentElement('afterend', summary);
  else body.prepend(summary);

  const content = body.innerHTML;
  closeModal();
  return `
    <div class="pet-detail-page">
      <div class="pet-detail-topbar">
        <button class="pet-detail-back" onclick="closePetDetail()" aria-label="Volver"><span aria-hidden="true">&larr;</span><span>Volver</span></button>
        <div class="pet-detail-breadcrumb"><span>Pacientes</span><span aria-hidden="true">/</span><strong>Ficha cl&iacute;nica</strong></div>
      </div>
      <div class="pet-detail-surface">${content}</div>
    </div>`;
}

function renderPetDetailLegacy(id) {
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
        <div class="tab active" onclick="switchTab(event, 'tab-followup')">Seguimiento${followUpTabBadge(pet)}</div>
        <div class="tab" onclick="switchTab(event, 'tab-history')">Historia clínica</div>
        <div class="tab" onclick="switchTab(event, 'tab-owners')">Tutores</div>
        <div class="tab" onclick="switchTab(event, 'tab-images')">Estudios e imágenes</div>
        <div class="tab" onclick="switchTab(event, 'tab-vacc')">Vacunas y desparasitación</div>
        <div class="tab" onclick="switchTab(event, 'tab-info')">Datos</div>
      </div>

      <div id="tab-followup" class="tab-content active">
        ${renderPetFollowUp(pet)}
      </div>

      <div id="tab-history" class="tab-content">
        ${renderPetTimeline(pet)}
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
          ${canEditClinical() ? `<span class="section-actions"><button class="btn btn-sm" onclick="requestStudy('${pet.id}')">+ Solicitar</button><button class="btn btn-sm btn-primary" onclick="addStudyLink('${pet.id}')">+ Agregar estudio</button></span>` : '<span class="tag">Solo lectura</span>'}
        </div>
        <small style="color:var(--text-mute)">Pegá el link de Google Drive de cada estudio: radiografías, ecografías, análisis, recetas, etc.</small>
        <div class="study-list">
          ${(pet.studies||[]).length === 0
            ? `<div class="empty-state">Sin estudios cargados.${canEditClinical() ? ` <a href="#" onclick="addStudyLink('${pet.id}');return false">+ Agregar el primero</a>` : ''}</div>`
            : [...pet.studies].sort((a,b) => (studyIsPending(b)?1:0) - (studyIsPending(a)?1:0)).map(s => `
            <div class="study-item${studyIsPending(s) ? ' is-pending' : ''}">
              <div class="study-icon">${studyIcon(s.type)}</div>
              <div class="study-body">
                ${s.url
                  ? `<a href="${escapeAttr(s.url)}" target="_blank" rel="noopener" class="study-title">${escapeHtml(s.title || s.type || 'Estudio')}</a>`
                  : `<span class="study-title">${escapeHtml(s.title || s.type || 'Estudio')}</span>`}
                <div class="study-meta">${studyIsPending(s) ? '<span class="study-pending-tag">Pendiente</span>' : ''}${escapeHtml(s.type || 'Estudio')}${s.date ? ' · ' + formatDate(s.date) : ''}${s.panel ? ' · ' + escapeHtml(LAB_PANELS[s.panel]?.label || '') : ''} ${labSummaryHTML(s, labSpecies(pet))}</div>
              </div>
              ${s.panel ? `<button class="btn btn-sm" onclick="openStudyResults('${pet.id}','${s.id}')">${labHasResults(s) ? 'Ver resultados' : 'Cargar resultados'}</button>` : ''}
              ${canEditClinical() ? `${studyIsPending(s) ? `<button class="btn btn-sm" onclick="markStudyReceived('${pet.id}','${s.id}')">Marcar recibido</button>` : ''}
              <button class="btn btn-sm" onclick="editStudyLink('${pet.id}','${s.id}')">Editar</button>
              <button class="img-x study-x" onclick="deleteStudyLink('${pet.id}','${s.id}')">×</button>` : ''}
            </div>
          `).join('')}
        </div>

        <div class="section-title" style="margin-top:18px">
          <h3>Fotos del paciente</h3>
          ${canEditClinical() ? `<label class="btn btn-sm btn-primary" style="cursor:pointer">+ Subir foto<input type="file" accept="image/*" multiple onchange="uploadPetImages('${pet.id}', this)" style="display:none"></label>` : '<span class="tag">Solo lectura</span>'}
        </div>
        <small style="color:var(--text-mute)">Evolución física, heridas, pelaje. Se guardan en el dispositivo.</small>
        <div class="image-gallery">
          ${(pet.images||[]).length === 0 ? '<div class="empty-state" style="grid-column:1/-1">Sin fotos adjuntas</div>' : pet.images.map(img => `
            <div class="img-item">
              <img src="${img.data}" onclick="openLightbox('${img.data}')">
              ${canEditClinical() ? `<button class="img-x" onclick="deletePetImage('${pet.id}','${img.id}')">×</button>` : ''}
              <div class="img-label">${escapeHtml(img.label||img.name||'Imagen')}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div id="tab-vacc" class="tab-content">
        ${renderSanitaryTab(pet)}
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
  petDetailActiveTab = id;
  const scope = e.currentTarget.closest('.pet-detail-page') || document;
  scope.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  scope.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  e.currentTarget.classList.add('active');
  e.currentTarget.setAttribute('aria-selected', 'true');
  const panel = scope.querySelector('#' + id);
  if (panel) panel.classList.add('active');
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
    saveDB('Foto actualizada');
    closeModal();
    openPetDetail(petId);
  });
}

function uploadPetImages(petId, input) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
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
        saveDB('Imágenes actualizadas');
        closeModal();
        openPetDetail(petId);
      }
    });
  });
}

function deletePetImage(petId, imgId) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
  showConfirm('¿Eliminar esta imagen?', () => {
  const pet = db.pets.find(p => p.id === petId);
  pet.images = pet.images.filter(i => i.id !== imgId);
  saveDB('Imagen eliminada');
  closeModal();
  openPetDetail(petId);
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
  const pending = studyIsPending(study);
  showModal(`
    <div class="modal-header"><h2>${studyId ? 'Editar estudio' : (pending ? 'Solicitar estudio' : 'Nuevo estudio')}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Tipo de estudio</label><select id="studyType">${opts}</select></div>
        <div class="form-group"><label>Estado</label><select id="studyStatus" onchange="toggleStudyUrlHint()">
          <option value="requested" ${pending?'selected':''}>Solicitado (pendiente de resultado)</option>
          <option value="received" ${pending?'':'selected'}>Resultado disponible</option>
        </select></div>
      </div>
      <div class="form-group"><label>Panel de laboratorio</label><select id="studyPanel">
        <option value="">Sin panel (solo link o informe)</option>
        ${Object.entries(LAB_PANELS).map(([key, panel]) => `<option value="${key}" ${study.panel===key?'selected':''}>${escapeHtml(panel.label)}</option>`).join('')}
      </select><small style="color:var(--text-mute)">Si eleg&iacute;s un panel vas a poder cargar los valores y compararlos con las referencias.</small></div>
      <div class="form-row">
        <div class="form-group"><label>Fecha ${pending ? 'prevista' : 'del estudio'}</label><input type="date" id="studyDate" value="${study.date||''}"></div>
        <div class="form-group"><label>Título / descripción</label><input type="text" id="studyTitle" value="${escapeAttr(study.title||'')}" placeholder="Ej: Rx tórax control"></div>
      </div>
      <div class="form-group"><label>Link de Google Drive</label><input type="url" id="studyUrl" value="${escapeAttr(study.url||'')}" placeholder="https://drive.google.com/..."><small id="studyUrlHint" style="color:var(--text-mute)"></small></div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveStudyLink('${petId}'${studyId ? `,'${studyId}'` : ''})">Guardar</button>
    </div>
  `);
  toggleStudyUrlHint();
}

// El link solo es obligatorio cuando el resultado ya está disponible.
function toggleStudyUrlHint() {
  const hint = document.getElementById('studyUrlHint');
  if (!hint) return;
  const requested = document.getElementById('studyStatus')?.value === 'requested';
  hint.textContent = requested
    ? 'Opcional mientras el estudio esté pendiente. Al cargar el link marcá el resultado como disponible.'
    : 'Obligatorio para dejar el resultado accesible desde la ficha.';
}

function addStudyLink(petId) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
  studyModal(petId, { status: 'received' });
}

function requestStudy(petId) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
  studyModal(petId, { status: 'requested' });
}

function markStudyReceived(petId, studyId) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  const study = pet ? (pet.studies||[]).find(s => s.id === studyId) : null;
  if (!study) return;
  study.status = 'received';
  saveDB('Estudio marcado como recibido');
  render();
}

function editStudyLink(petId, studyId) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  const study = (pet.studies||[]).find(s => s.id === studyId);
  if (!study) return;
  studyModal(petId, study, studyId);
}

function saveStudyLink(petId, studyId) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
  const url = normalizeUrl(document.getElementById('studyUrl').value);
  const status = document.getElementById('studyStatus').value === 'requested' ? 'requested' : 'received';
  if (!url && status === 'received') { toast('Pegá un link válido o dejá el estudio como solicitado'); return; }
  const pet = db.pets.find(p => p.id === petId);
  pet.studies = pet.studies || [];
  const data = {
    type: document.getElementById('studyType').value,
    title: document.getElementById('studyTitle').value.trim(),
    date: document.getElementById('studyDate').value,
    url,
    status,
    panel: document.getElementById('studyPanel').value
  };
  if (studyId) {
    const s = pet.studies.find(x => x.id === studyId);
    Object.assign(s, data);
  } else {
    pet.studies.push({ id: uid(), results: {}, ...data });
  }
  saveDB(studyId ? 'Estudio actualizado' : (status === 'requested' ? 'Estudio solicitado' : 'Estudio agregado'));
  closeModal();
  openPetDetail(petId);
}

function deleteStudyLink(petId, studyId) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  const study = (pet.studies||[]).find(s => s.id === studyId);
  const name = study ? (study.title || study.type || 'estudio') : 'estudio';
  showConfirm(`¿Eliminar "${name}"?`, () => {
    pet.studies = (pet.studies||[]).filter(s => s.id !== studyId);
    saveDB('Estudio eliminado');
    closeModal();
    openPetDetail(petId);
  });
}

function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('show');
}

function addHistoryEntryLegacy(petId, editId) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  const ex = editId ? (pet.history||[]).find(h => h.id === editId) : null;
  const today = localDateKey();
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

function addHistoryEntry(petId, editId) {
  openEncounter(petId, editId);
}

function openEncounter(petId, editId, appointmentId) {
  if (!canEditClinical()) { toast('Tu rol no permite modificar informacion clinica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  if (!pet) return;
  if (editId && !(pet.history || []).some(h => h.id === editId)) return;
  const existingEncounter = editId ? (pet.history || []).find(h => h.id === editId) : null;
  currentEncounterPetId = petId;
  currentEncounterId = editId || null;
  currentEncounterAppointmentId = appointmentId || existingEncounter?.appointmentId || null;
  currentPetId = petId;
  currentView = 'encounter';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const petsNav = document.querySelector('[data-view="pets"]');
  if (petsNav) petsNav.classList.add('active');
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (window.innerWidth < 769) closeSidebar();
}

function closeEncounter() {
  const petId = currentEncounterPetId;
  currentEncounterPetId = null;
  currentEncounterId = null;
  currentEncounterAppointmentId = null;
  if (!petId) { navigateTo('pets'); return; }
  currentPetId = petId;
  petDetailActiveTab = 'tab-followup';
  currentView = 'pet-detail';
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function renderEncounter() {
  const pet = db.pets.find(p => p.id === currentEncounterPetId);
  if (!pet) return '<div class="pet-detail-missing"><h1>Paciente no encontrado</h1><button class="btn btn-primary" onclick="navigateTo(\'pets\')">Volver a pacientes</button></div>';
  const ex = currentEncounterId ? (pet.history || []).find(h => h.id === currentEncounterId) : null;
  const appointmentId = ex?.appointmentId || currentEncounterAppointmentId;
  const appointment = appointmentId ? db.appointments.find(a => a.id === appointmentId) : null;
  const today = localDateKey();
  const attrValue = field => escapeAttr(ex ? ex[field] || '' : '');
  const textValue = field => escapeHtml(ex ? ex[field] || '' : '');
  const status = ex ? (ex.status || 'closed') : (appointment ? 'in_progress' : 'draft');
  const types = ['Consulta general','Control','Urgencia','Cirug' + String.fromCharCode(237) + 'a','Vacunaci' + String.fromCharCode(243) + 'n','Laboratorio','Otro'];
  const encounterType = ex?.type || appointment?.type || 'Consulta general';
  if (!types.includes(encounterType)) types.push(encounterType);
  const owner = (pet.ownerIds || []).map(id => db.owners.find(o => o.id === id)).find(Boolean);
  const statusOptions = Object.entries(ENCOUNTER_STATUSES).map(([value,label]) => `<option value="${value}" ${status===value?'selected':''}>${label}</option>`).join('');
  return `
    <div class="encounter-page">
      <div class="pet-detail-topbar">
        <button class="pet-detail-back" onclick="closeEncounter()" aria-label="Volver a la ficha"><span aria-hidden="true">&larr;</span><span>Volver a la ficha</span></button>
        <div class="pet-detail-breadcrumb"><span>Pacientes</span><span aria-hidden="true">/</span><span>${escapeHtml(pet.name)}</span><span aria-hidden="true">/</span><strong>Consulta</strong></div>
      </div>
      <header class="encounter-header">
        <div><div class="page-eyebrow">Atenci&oacute;n cl&iacute;nica</div><h1>${ex ? 'Editar consulta' : 'Nueva consulta'}</h1><p>${escapeHtml(pet.name)} &middot; ${escapeHtml(pet.species || 'Paciente')} ${pet.breed ? '&middot; ' + escapeHtml(pet.breed) : ''}${appointment ? ` &middot; Turno ${escapeHtml(appointment.time || 'sin hora')}` : ''}</p></div>
        <span class="encounter-status ${encounterStatusClass(status)}">${encounterStatusLabel(status)}</span>
      </header>
      <div class="encounter-layout">
        <section class="encounter-form-card">
          <div class="encounter-section">
            <div class="encounter-section-heading"><span>1</span><div><h2>Contexto de la consulta</h2><p>Fecha, tipo, profesional y motivo de atenci&oacute;n.</p></div></div>
            <div class="form-row-3">
              <div class="form-group"><label for="hDate">Fecha *</label><input type="date" id="hDate" value="${escapeAttr(ex?.date || appointment?.date || today)}"></div>
              <div class="form-group"><label for="hType">Tipo</label><select id="hType">${types.map(type=>`<option ${encounterType===type?'selected':''} value="${type}">${type}</option>`).join('')}</select></div>
              <div class="form-group"><label for="hVet">Profesional</label><input type="text" id="hVet" value="${escapeAttr(ex?.vet || appointment?.vet || '')}" placeholder="Nombre del profesional"></div>
            </div>
            <div class="form-group"><label for="hTitle">Motivo de consulta ${status==='draft'?'':'*'}</label><input type="text" id="hTitle" value="${escapeAttr(ex?.title || appointment?.notes || appointment?.type || '')}" placeholder="Por que viene hoy"></div>
          </div>
          <div class="encounter-section encounter-vitals-section">
            <div class="encounter-section-heading"><span>2</span><div><h2>Signos vitales</h2><p>Quedan disponibles para ver la evoluci&oacute;n del paciente.</p></div></div>
            <div class="form-row-3">
              <div class="form-group"><label for="hWeight">Peso (kg)</label><input type="number" id="hWeight" step="0.1" value="${attrValue('weight')}" placeholder="4.5"></div>
              <div class="form-group"><label for="hTemp">Temperatura (&deg;C)</label><input type="number" id="hTemp" step="0.1" value="${attrValue('temp')}" placeholder="38.5"></div>
              <div class="form-group"><label for="hHR">FC (lpm)</label><input type="number" id="hHR" value="${attrValue('hr')}" placeholder="80"></div>
            </div>
          </div>
          <div class="encounter-section">
            <div class="encounter-section-heading"><span>3</span><div><h2>Evaluaci&oacute;n y plan</h2><p>Hallazgos, diagn&oacute;stico, tratamiento e indicaciones.</p></div></div>
            <div class="form-group">
              <div class="exam-template-bar">
                <label for="hExam">Examen f&iacute;sico</label>
                <span><select id="hExamTemplate" aria-label="Plantilla de examen">${examTemplateOptionsHTML()}</select><button class="btn btn-sm" type="button" onclick="applyExamTemplate()">Usar plantilla</button></span>
              </div>
              <textarea id="hExam" rows="6" placeholder="Hallazgos del examen f&iacute;sico">${textValue('exam')}</textarea>
            </div>
            <div class="form-group"><label for="hDiag">Diagn&oacute;stico</label><input type="text" id="hDiag" value="${attrValue('diagnosis')}" placeholder="Presuntivo o definitivo"></div>
            <div class="form-group"><label for="hTreat">Tratamiento e indicaciones</label><textarea id="hTreat" rows="4" placeholder="Medicamentos, dosis, duraci&oacute;n e indicaciones">${textValue('treatment')}</textarea></div>
            <div class="form-row"><div class="form-group"><label for="hNext">Pr&oacute;ximo control</label><input type="date" id="hNext" value="${attrValue('nextControl')}"></div><div class="form-group"><label for="hDesc">Observaciones</label><input type="text" id="hDesc" value="${attrValue('description')}" placeholder="Notas adicionales"></div></div>
          </div>
        </section>
        <aside class="encounter-sidebar">
          <div class="encounter-side-card"><h3>Estado de la consulta</h3><label class="sr-only" for="hStatus">Estado</label><select id="hStatus" onchange="toggleEncounterReopenField(this.value)">${statusOptions}</select><p>El estado permite continuar el trabajo sin cerrar una atenci&oacute;n incompleta.</p><div class="encounter-reopen-field ${status==='reopened'?'is-visible':''}"><label for="hReopen">Motivo de reapertura</label><textarea id="hReopen" rows="2" placeholder="Completar al reabrir una consulta cerrada">${textValue('reopenedReason')}</textarea></div></div>
          <div class="encounter-side-card encounter-patient-card"><h3>Paciente</h3><strong>${escapeHtml(pet.name)}</strong><span>${escapeHtml(pet.species || '')} ${pet.breed ? '&middot; ' + escapeHtml(pet.breed) : ''}</span>${pet.allergies?`<div class="encounter-alert"><b>Alergias</b>${escapeHtml(pet.allergies)}</div>`:''}${pet.chronicConditions?`<div class="encounter-alert"><b>Condici&oacute;n cr&oacute;nica</b>${escapeHtml(pet.chronicConditions)}</div>`:''}${owner?`<div class="encounter-owner"><b>${escapeHtml(owner.name)}</b><span>${escapeHtml(owner.phone || 'Sin tel&eacute;fono')}</span></div>`:''}</div>
          <div class="encounter-actions"><button class="btn" onclick="closeEncounter()">Cancelar</button><button class="btn btn-secondary" onclick="saveHistory('${pet.id}','${ex?ex.id:''}','draft')">Guardar borrador</button><button class="btn btn-primary" onclick="saveHistory('${pet.id}','${ex?ex.id:''}')">Guardar estado</button><button class="btn btn-success" onclick="openEncounterCloseReview('${pet.id}','${ex?ex.id:''}')">Revisar y cerrar</button></div>
        </aside>
      </div>
    </div>`;
}

function encounterInvoice(encounterId) {
  return (db.invoices || []).find(invoice => invoice.encounterId === encounterId);
}

function encounterInvoiceActionHTML(encounterId) {
  if (!receiptsEnabled()) return '';
  const invoice = encounterInvoice(encounterId);
  if (!invoice) return '';
  const number = invoice.number || invoice.id.slice(-4).toUpperCase();
  return `<button class="btn btn-sm encounter-receipt-link" onclick="openInvoiceModal('${invoice.id}')">Recibo #${escapeHtml(number)}</button>`;
}

function closeStudyRowHTML() {
  const opts = STUDY_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
  return `
    <div class="close-study-row">
      <select class="close-study-type" aria-label="Tipo de estudio">${opts}</select>
      <input class="close-study-title" type="text" placeholder="Detalle (ej: hemograma de control)">
      <input class="close-study-date" type="date" aria-label="Fecha prevista">
      <button class="btn btn-sm btn-danger" type="button" onclick="this.closest('.close-study-row').remove()" title="Quitar estudio">${iconX()}</button>
    </div>`;
}

function toggleCloseStudies() {
  const enabled = Boolean(document.getElementById('closeRequestStudies')?.checked);
  const fields = document.getElementById('closeStudyFields');
  if (!fields) return;
  fields.hidden = !enabled;
  fields.querySelectorAll('input,select,button').forEach(element => { element.disabled = !enabled; });
}

function addCloseStudyRow() {
  const container = document.getElementById('closeStudyRows');
  if (container) container.insertAdjacentHTML('beforeend', closeStudyRowHTML());
}

// Estudios que la consulta deja pedidos: nacen pendientes y sin link.
function collectCloseStudies() {
  if (!document.getElementById('closeRequestStudies')?.checked) return [];
  const studies = [];
  document.querySelectorAll('.close-study-row').forEach(row => {
    const type = row.querySelector('.close-study-type')?.value || '';
    const title = row.querySelector('.close-study-title')?.value.trim() || '';
    const date = row.querySelector('.close-study-date')?.value || '';
    if (!type && !title) return;
    studies.push({ id: uid(), type, title: title || type, date, url: '', status: 'requested' });
  });
  return studies;
}

function encounterChargeRowHTML(item) {
  return `
    <div class="encounter-charge-row">
      <input class="close-charge-desc" type="text" value="${escapeAttr(item.desc || '')}" placeholder="Servicio o producto">
      <input class="close-charge-qty" type="number" min="0.01" step="0.01" value="${escapeAttr(item.qty || 1)}" aria-label="Cantidad" oninput="updateEncounterCloseTotal()">
      <input class="close-charge-price" type="number" min="0" step="0.01" value="${escapeAttr(item.price || 0)}" aria-label="Precio unitario" oninput="updateEncounterCloseTotal()">
      <button class="btn btn-sm btn-danger" type="button" onclick="this.closest('.encounter-charge-row').remove();updateEncounterCloseTotal()" title="Quitar cargo">${iconX()}</button>
    </div>`;
}

function openEncounterCloseReview(petId, editId) {
  if (!canEditClinical()) { toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(item => item.id === petId);
  if (!pet) return;
  const date = document.getElementById('hDate')?.value || '';
  const title = document.getElementById('hTitle')?.value.trim() || '';
  if (!date || !title) { toast('Completá fecha y motivo antes de cerrar', 'error'); return; }

  const encounterId = editId || uid();
  const closeOperationId = uid();
  const closeTimestamp = new Date().toISOString();
  const existingInvoice = encounterInvoice(encounterId);
  const canUseReceipts = receiptsEnabled();
  const owners = (pet.ownerIds || []).map(id => db.owners.find(owner => owner.id === id)).filter(Boolean);
  const type = document.getElementById('hType')?.value || 'Consulta';
  const clinicalItems = [
    { label: 'Motivo', value: title },
    { label: 'Examen físico', value: document.getElementById('hExam')?.value.trim() || '' },
    { label: 'Diagnóstico', value: document.getElementById('hDiag')?.value.trim() || '' },
    { label: 'Tratamiento e indicaciones', value: document.getElementById('hTreat')?.value.trim() || '' },
  ];
  const incomplete = clinicalItems.filter(item => !item.value);
  const ownerOptions = owners.map((owner, index) =>
    `<option value="${owner.id}" ${index === 0 ? 'selected' : ''}>${escapeHtml(owner.name)}</option>`
  ).join('');
  const invoiceStatus = existingInvoice
    ? (existingInvoice.status === 'paid' ? 'Cobrado' : existingInvoice.status === 'cancelled' ? 'Cancelado' : 'Pendiente')
    : '';

  showModal(`
    <div class="modal-header">
      <div><div class="page-eyebrow">Cierre de consulta</div><h2>Revisar antes de cerrar</h2></div>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body encounter-close-review">
      <div class="close-review-grid${canUseReceipts ? '' : ' is-clinical-only'}">
        <section class="close-review-card">
          <div class="close-review-heading"><div><small>Información clínica</small><h3>${escapeHtml(pet.name)} · ${escapeHtml(type)}</h3></div><span class="encounter-status encounter-status-closed">Por cerrar</span></div>
          <div class="clinical-review-list">
            ${clinicalItems.map(item => `
              <div class="${item.value ? 'is-complete' : 'is-missing'}">
                <span aria-hidden="true">${item.value ? '✓' : '!'}</span>
                <div><strong>${escapeHtml(item.label)}</strong><p>${item.value ? escapeHtml(item.value) : 'Sin completar'}</p></div>
              </div>`).join('')}
          </div>
          <div class="close-review-note ${incomplete.length ? 'is-warning' : 'is-success'}">
            ${incomplete.length
              ? `${incomplete.length} campo${incomplete.length === 1 ? '' : 's'} clínico${incomplete.length === 1 ? '' : 's'} sin completar. Podés cerrar igualmente, pero quedará visible en la historia.`
              : 'La información clínica principal está completa.'}
          </div>
          <div class="close-review-meta"><span>Fecha <strong>${formatDate(date)}</strong></span><span>Profesional <strong>${escapeHtml(document.getElementById('hVet')?.value || 'Sin indicar')}</strong></span></div>

          <div class="close-review-studies">
            <label class="billing-toggle">
              <input type="checkbox" id="closeRequestStudies">
              <span><strong>Dejar estudios solicitados (opcional)</strong><small>Quedan pendientes en Seguimiento hasta que se cargue el resultado.</small></span>
            </label>
            <div id="closeStudyFields" hidden>
              <div id="closeStudyRows">${closeStudyRowHTML()}</div>
              <button class="btn btn-sm" type="button" onclick="addCloseStudyRow()">+ Agregar estudio</button>
            </div>
          </div>
        </section>

        ${canUseReceipts ? `<section class="close-review-card close-review-billing">
          <div class="close-review-heading"><div><small>Cobro</small><h3>Recibo de la consulta</h3></div></div>
          ${existingInvoice ? `
            <div class="linked-receipt-card">
              <div><strong>Recibo #${escapeHtml(existingInvoice.number || existingInvoice.id.slice(-4).toUpperCase())}</strong><span>${invoiceStatus} · $${Number(existingInvoice.total || 0).toLocaleString('es-AR')}</span></div>
              <button class="btn btn-sm" onclick="openInvoiceModal('${existingInvoice.id}')">Ver recibo</button>
            </div>
            <p class="close-review-help">Esta consulta ya tiene un recibo vinculado. El cierre no creará otro.</p>
          ` : `
            <label class="billing-toggle">
              <input type="checkbox" id="closeCreateInvoice" ${owners.length ? '' : 'disabled'}>
              <span><strong>Generar recibo (opcional)</strong><small>${owners.length ? 'Activá esta opción solo si también querés registrar el cobro.' : 'Para generar un recibo, primero asociá un tutor al paciente.'}</small></span>
            </label>
            <div id="encounterBillingFields" hidden>
              <div class="form-group"><label for="closeInvoiceOwner">Tutor responsable</label><select id="closeInvoiceOwner">${ownerOptions}</select></div>
              <div class="encounter-charge-labels"><span>Descripción</span><span>Cant.</span><span>Precio</span><span></span></div>
              <div id="encounterChargeRows">${encounterChargeRowHTML({ desc: `Consulta - ${type}`, qty: 1, price: 0 })}</div>
              <button class="btn btn-sm" type="button" onclick="addEncounterCharge()">+ Agregar cargo</button>
              <div class="close-review-total"><span>Total del recibo</span><strong id="encounterCloseTotal">$0</strong></div>
            </div>
          `}
        </section>` : ''}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Volver a editar</button>
      <button class="btn btn-success" id="finalizeEncounterCloseButton" onclick="finalizeEncounterClose('${petId}','${editId}','${encounterId}','${closeOperationId}','${closeTimestamp}')">Cerrar consulta</button>
    </div>
  `, true);
  document.getElementById('closeRequestStudies')?.addEventListener('change', toggleCloseStudies);
  toggleCloseStudies();
  if (!existingInvoice) {
    document.getElementById('closeCreateInvoice')?.addEventListener('change', toggleEncounterBilling);
    toggleEncounterBilling();
    updateEncounterCloseTotal();
  }
}

function toggleEncounterBilling() {
  const enabled = Boolean(document.getElementById('closeCreateInvoice')?.checked);
  const fields = document.getElementById('encounterBillingFields');
  if (!fields) return;
  fields.hidden = !enabled;
  fields.querySelectorAll('input,select,button').forEach(element => { element.disabled = !enabled; });
}

function addEncounterCharge() {
  const container = document.getElementById('encounterChargeRows');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', encounterChargeRowHTML({ desc: '', qty: 1, price: 0 }));
}

function updateEncounterCloseTotal() {
  let total = 0;
  document.querySelectorAll('.encounter-charge-row').forEach(row => {
    const qty = Number.parseFloat(row.querySelector('.close-charge-qty')?.value || '0');
    const price = Number.parseFloat(row.querySelector('.close-charge-price')?.value || '0');
    if (Number.isFinite(qty) && Number.isFinite(price)) total += qty * price;
  });
  const display = document.getElementById('encounterCloseTotal');
  if (display) display.textContent = '$' + total.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return total;
}

async function finalizeEncounterClose(petId, editId, encounterId, closeOperationId, closeTimestamp) {
  const createInvoice = Boolean(document.getElementById('closeCreateInvoice')?.checked);
  let invoice = null;
  if (createInvoice) {
    const ownerId = document.getElementById('closeInvoiceOwner')?.value || '';
    if (!ownerId) { toast('Seleccioná un tutor para generar el recibo', 'error'); return; }
    const items = [];
    document.querySelectorAll('.encounter-charge-row').forEach(row => {
      const desc = row.querySelector('.close-charge-desc')?.value.trim() || '';
      const qty = Number.parseFloat(row.querySelector('.close-charge-qty')?.value || '0');
      const price = Number.parseFloat(row.querySelector('.close-charge-price')?.value || '0');
      if (desc && Number.isFinite(qty) && qty > 0 && Number.isFinite(price) && price >= 0) {
        items.push({ desc, qty, price });
      }
    });
    const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    if (!items.length || total <= 0) {
      toast('Agregá al menos un cargo con importe mayor a cero', 'error');
      return;
    }
    invoice = { ownerId, items, total };
  }
  const studies = collectCloseStudies();
  const closeButton = document.getElementById('finalizeEncounterCloseButton');
  if (closeButton) {
    closeButton.disabled = true;
    closeButton.textContent = 'Confirmando cierre...';
  }
  try {
    await saveHistory(petId, editId, 'closed', {
      encounterId,
      idempotencyKey: `clinical-close:${closeOperationId}`,
      closedAt: closeTimestamp,
      invoice,
      studies,
    });
  } finally {
    const pendingButton = document.getElementById('finalizeEncounterCloseButton');
    if (pendingButton) {
      pendingButton.disabled = false;
      pendingButton.textContent = 'Cerrar consulta';
    }
  }
}

async function saveHistory(petId, editId, forcedStatus, closeBundle) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
  const date = document.getElementById('hDate').value;
  const title = document.getElementById('hTitle').value.trim();
  const statusField = document.getElementById('hStatus');
  const status = forcedStatus || (statusField ? statusField.value : 'closed');
  const existing = editId ? (db.pets.find(p => p.id === petId)?.history || []).find(h => h.id === editId) : null;
  const now = closeBundle?.closedAt || new Date().toISOString();
  const linkedAppointmentId = existing?.appointmentId || currentEncounterAppointmentId || '';
  const reopenedReason = (document.getElementById('hReopen')?.value || '').trim();
  if (status === 'reopened' && !reopenedReason) { toast('Completa el motivo de reapertura', 'error'); return; }
  if (existing && (existing.status || 'closed') === 'closed' && !['closed','reopened'].includes(status)) { toast('Una consulta cerrada debe pasar a Reabierta', 'error'); return; }
  if (!date || !title) { toast('Completá fecha y motivo', 'error'); return; }
  if (status === 'closed' && !closeBundle) {
    openEncounterCloseReview(petId, editId);
    return;
  }
  const pet = db.pets.find(p => p.id === petId);
  if (!pet) return;
  const atomicRemoteClose = Boolean(closeBundle && apiConfigured() && authToken);
  const beforeAtomicClose = atomicRemoteClose ? _cloneSyncValue(db) : null;
  pet.history = pet.history || [];
  const weight = document.getElementById('hWeight').value;
  const temp = document.getElementById('hTemp').value;
  const entry = {
    id: closeBundle?.encounterId || editId || uid(), date,
    type: document.getElementById('hType').value,
    vet: document.getElementById('hVet').value,
    weight, temp, hr: document.getElementById('hHR').value,
    title, exam: document.getElementById('hExam').value,
    diagnosis: document.getElementById('hDiag').value,
    treatment: document.getElementById('hTreat').value,
    nextControl: document.getElementById('hNext').value,
    description: document.getElementById('hDesc').value,
    status,
    appointmentId: linkedAppointmentId,
    startedAt: existing?.startedAt || now,
    closedAt: status === 'closed' ? (existing?.closedAt || now) : '',
    reopenedReason: status === 'reopened' ? reopenedReason : (existing?.reopenedReason || '')
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
  const latestWeight = [...pet.history].sort((a,b) => String(b.date||'').localeCompare(String(a.date||''))).find(h => h.weight);
  if (latestWeight) pet.weight = latestWeight.weight;
  let createdReminder = null;
  if (entry.nextControl && status === 'closed' && (!existing || existing.status !== 'closed')) {
    createdReminder = {
      id: closeBundle?.idempotencyKey ? `${closeBundle.idempotencyKey}:reminder` : uid(),
      title:'Control: '+title,
      petId,
      date:entry.nextControl,
      type:'control',
      completed:false
    };
    db.reminders.push(createdReminder);
  }
  let linkedAppointment = null;
  if (linkedAppointmentId) {
    linkedAppointment = db.appointments.find(a => a.id === linkedAppointmentId);
    if (linkedAppointment) {
      linkedAppointment.status = status === 'closed' ? 'completed' : 'in_consultation';
      if (!linkedAppointment.startedAt) linkedAppointment.startedAt = now;
      linkedAppointment.completedAt = status === 'closed' ? (linkedAppointment.completedAt || now) : '';
    }
  }
  const requestedStudies = (closeBundle?.studies || []).filter(study => !(pet.studies || []).some(s => s.id === study.id));
  if (requestedStudies.length) {
    pet.studies = pet.studies || [];
    pet.studies.push(...requestedStudies);
  }
  let receiptCreated = false;
  let createdInvoice = null;
  if (closeBundle?.invoice && !encounterInvoice(entry.id)) {
    const invoiceData = closeBundle.invoice;
    db.invoices = db.invoices || [];
    createdInvoice = {
      id: `${entry.id}-receipt`,
      number: nextLocalInvoiceNumber(),
      date,
      ownerId: invoiceData.ownerId,
      petId,
      items: invoiceData.items,
      total: invoiceData.total,
      status: 'pending',
      notes: 'Generado desde consulta: ' + title,
      encounterId: entry.id,
    };
    db.invoices.push(createdInvoice);
    receiptCreated = true;
  }
  const message = receiptCreated
    ? 'Consulta cerrada y recibo pendiente generado'
    : (status === 'closed' && closeBundle
      ? 'Consulta cerrada'
      : (editId ? 'Consulta actualizada' : 'Consulta registrada'));
  if (atomicRemoteClose) {
    try {
      const result = await api('/api/clinical-close', {
        method: 'POST',
        body: {
          idempotencyKey: closeBundle.idempotencyKey,
          petId,
          expectedRevision: Number.isInteger(pet.revision) ? pet.revision : 0,
          petWeight: pet.weight || '',
          encounter: entry,
          appointment: linkedAppointment,
          reminder: createdReminder,
          invoice: createdInvoice,
          studies: requestedStudies,
        },
      });
      pet.revision = result.petRevision;
      if (createdInvoice && result.invoiceNumber) createdInvoice.number = result.invoiceNumber;
      _snapshotUpsert('pets', _cloneSyncValue(pet));
      if (linkedAppointment) _snapshotUpsert('appointments', _cloneSyncValue(linkedAppointment));
      if (createdReminder) _snapshotUpsert('reminders', _cloneSyncValue(createdReminder));
      if (createdInvoice) _snapshotUpsert('invoices', _cloneSyncValue(createdInvoice));
      await saveIDB();
      if (_hasPendingChanges()) {
        _setSyncState('queued', null);
        if (typeof _syncTimer !== 'undefined') {
          clearTimeout(_syncTimer);
          _syncTimer = setTimeout(syncToAPI, 0);
        }
      } else {
        _markSyncConfirmed();
      }
      toast(message);
    } catch (error) {
      db = beforeAtomicClose;
      const conflict = error && error.status === 409;
      toast(conflict
        ? 'La ficha cambió en otro equipo. Recargá antes de volver a cerrar.'
        : 'No se pudo confirmar el cierre. La consulta sigue abierta para reintentar.');
      return;
    }
  } else {
    saveDB(message);
  }
  closeModal();
  closeEncounter();
}

function printHistEntry(petId, hId) {
  const pet = db.pets.find(p => p.id === petId);
  const h = (pet&&pet.history)?pet.history.find(x=>x.id===hId):null;
  if (!pet||!h) return;
  printDocument('Historia cl\u00ednica',
    documentPatientMeta(pet)
    +'<p style="color:#666;font-size:.9rem">Fecha: '+formatDate(h.date)+' \u00b7 Tipo: '+escapeHtml(h.type||'Consulta')+' \u00b7 Profesional: '+escapeHtml(h.vet||'\u2014')+'</p>'
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
    +'<div class="sign">'+escapeHtml(h.vet||'Profesional actuante')+'</div>');
}

function deleteHistory(petId, hId) {
  if(!canEditClinical()){ toast('Tu rol no permite modificar información clínica'); return; }
  if (encounterInvoice(hId)) {
    toast('No podés eliminar una consulta vinculada a un recibo', 'error');
    return;
  }
  showConfirm('¿Eliminar este registro clínico?', () => {
  const pet = db.pets.find(p => p.id === petId);
  pet.history = pet.history.filter(h => h.id !== hId);
  saveDB('Registro clínico eliminado');
  closeModal();
  openPetDetail(petId);
});
}

// El plan sanitario vive en sanitary.js; esto mantiene los accesos existentes.
function addVaccine(petId) { openSanitaryModal(petId, 'vaccine'); }
function addDeworming(petId) { openSanitaryModal(petId, 'deworming'); }

// ========================================
// [12] VISTA: TUTORES (OWNERS)
// ========================================
