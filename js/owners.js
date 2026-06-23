function renderOwners() {
  return `
    <div class="page-header">
      <div class="title"><small>Familias</small><h1>Tutores</h1></div>
      <button class="btn btn-primary" onclick="openOwnerModal()">+ Nuevo tutor</button>
    </div>
    <div class="search-bar">
      <input type="text" placeholder="Buscar tutor..." onkeyup="filterOwners(this.value)">
    </div>
    <div id="ownersGrid" class="pets-grid">
      ${db.owners.length === 0 ? '<div class="empty-state" style="grid-column:1/-1"><div class="ico">◐</div>Sin tutores registrados</div>' : db.owners.map(o => ownerListCardHTML(o)).join('')}
    </div>
  `;
}

function ownerListCardHTML(o) {
  const pets = db.pets.filter(p => (p.ownerIds||[]).includes(o.id));
  return `
    <div class="pet-card" style="cursor:default">
      <div class="pet-card-body">
        <h3>${escapeHtml(o.name)}</h3>
        <div class="meta">${escapeHtml(o.phone||'sin teléfono')}</div>
        <div class="meta">${escapeHtml(o.email||'sin email')}</div>
        <div class="tags">
          ${pets.map(p => `<span class="tag">${escapeHtml(p.name)}</span>`).join('') || '<span class="tag">Sin mascotas</span>'}
        </div>
        <div style="display:flex;gap:6px;margin-top:12px">
          ${o.phone ? `<a class="contact-btn wa" href="https://wa.me/${cleanPhone(o.phone)}" target="_blank">WhatsApp</a>` : ''}
          ${o.email ? `<a class="contact-btn mail" href="mailto:${o.email}">Email</a>` : ''}
          <button class="btn btn-sm" style="margin-left:auto" onclick="openOwnerModal('${o.id}')">Editar</button>
        </div>
      </div>
    </div>
  `;
}

function ownerCardHTML(o, petName) {
  const waMsg = encodeURIComponent(`Hola ${o.name}, le escribimos de la veterinaria respecto a ${petName}.`);
  const mailSubj = encodeURIComponent(`Veterinaria - ${petName}`);
  return `
    <div class="owner-card">
      <h4>${escapeHtml(o.name)} ${o.relationship ? `<small style="font-weight: var(--fw-normal);color:var(--text-mute)">· ${escapeHtml(o.relationship)}</small>` : ''}</h4>
      <div style="font-size:var(--fs-sm);color:var(--text-soft)">
        ${o.phone ? `📞 ${escapeHtml(o.phone)}<br>` : ''}
        ${o.email ? `✉ ${escapeHtml(o.email)}<br>` : ''}
        ${o.address ? `📍 ${escapeHtml(o.address)}` : ''}
      </div>
      <div class="contact-links">
        ${o.phone ? `<a class="contact-btn wa" href="https://wa.me/${cleanPhone(o.phone)}?text=${waMsg}" target="_blank">WhatsApp</a>` : ''}
        ${o.phone ? `<a class="contact-btn" href="tel:${o.phone}">Llamar</a>` : ''}
        ${o.email ? `<a class="contact-btn mail" href="mailto:${o.email}?subject=${mailSubj}">Email</a>` : ''}
      </div>
    </div>
  `;
}

function filterOwners(q) {
  q = q.toLowerCase();
  const filtered = db.owners.filter(o => o.name.toLowerCase().includes(q) || (o.phone||'').includes(q) || (o.email||'').toLowerCase().includes(q));
  document.getElementById('ownersGrid').innerHTML = filtered.length === 0 ? '<div class="empty-state" style="grid-column:1/-1">Sin resultados</div>' : filtered.map(ownerListCardHTML).join('');
}

function openOwnerModal(id) {
  const owner = id ? db.owners.find(o => o.id === id) : { id: uid() };
  const isNew = !id;
  showModal(`
    <div class="modal-header"><h2>${isNew?'Nuevo tutor':'Editar tutor'}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Nombre completo *</label><input type="text" id="oName" value="${escapeAttr(owner.name||'')}"></div>
        <div class="form-group"><label>Relación con mascota</label><input type="text" id="oRel" value="${escapeAttr(owner.relationship||'')}" placeholder="Tutor, hijo/a, cuidador..."></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Teléfono (con código país: 5491123456789)</label><input type="text" id="oPhone" value="${escapeAttr(owner.phone||'')}"></div>
        <div class="form-group"><label>Email</label><input type="email" id="oEmail" value="${escapeAttr(owner.email||'')}"></div>
      </div>
      <div class="form-group"><label>Dirección</label><input type="text" id="oAddress" value="${escapeAttr(owner.address||'')}"></div>
      <div class="form-group"><label>DNI / Documento</label><input type="text" id="oDni" value="${escapeAttr(owner.dni||'')}"></div>
      <div class="form-group">
        <label>Mascotas asociadas</label>
        ${db.pets.length ? assocPicker('ownerPetsPicker', db.pets.map(p=>({id:p.id,label:p.name+(p.species?' · '+p.species:''),search:(p.name||'')+' '+(p.species||'')})), db.pets.filter(p=>(p.ownerIds||[]).includes(owner.id)).map(p=>p.id)) : '<small style="color:var(--text-mute)">No hay mascotas todavía. Creá una en la sección Pacientes.</small>'}
      </div>
      <div class="form-group"><label>Notas</label><textarea id="oNotes">${escapeHtml(owner.notes||'')}</textarea></div>
    </div>
    <div class="modal-footer">
      ${!isNew ? `<button class="btn btn-danger" onclick="deleteOwner('${owner.id}')">Eliminar</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveOwner('${owner.id}', ${isNew})">Guardar</button>
    </div>
  `);
}

function saveOwner(id, isNew) {
  const name = document.getElementById('oName').value.trim();
  if (!name) { toast('Nombre obligatorio'); return; }
  const data = {
    id, name,
    relationship: document.getElementById('oRel').value.trim(),
    phone: document.getElementById('oPhone').value.trim(),
    email: document.getElementById('oEmail').value.trim(),
    address: document.getElementById('oAddress').value.trim(),
    dni: document.getElementById('oDni').value.trim(),
    notes: document.getElementById('oNotes').value.trim()
  };
  if (isNew) db.owners.push(data);
  else { const i = db.owners.findIndex(o=>o.id===id); db.owners[i] = data; }
  if (document.getElementById('ownerPetsPicker')) {
    const chosen = getAssocSelected('ownerPetsPicker');
    db.pets.forEach(p => {
      p.ownerIds = p.ownerIds || [];
      const has = p.ownerIds.includes(id);
      const want = chosen.includes(p.id);
      if (want && !has) p.ownerIds.push(id);
      if (!want && has) p.ownerIds = p.ownerIds.filter(oid => oid !== id);
    });
  }
  saveDB();
  closeModal();
  render();
  toast(isNew?'Tutor creado':'Tutor actualizado');
}

function deleteOwner(id) {
  showConfirm('¿Eliminar este tutor? Quedará desvinculado de sus mascotas.', () => {
  db.owners = db.owners.filter(o=>o.id!==id);
  db.pets.forEach(p => { if (p.ownerIds) p.ownerIds = p.ownerIds.filter(oid => oid !== id); });
  saveDB(); closeModal(); render(); toast('Tutor eliminado');
});
}

// ========================================
// [13] VISTA: TURNOS (APPOINTMENTS)
// ========================================
