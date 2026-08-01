let ownerVisibleLimit = 100;
const OWNER_PAGE_SIZE = 100;
let _ownerFilterTimer = null;

function ownerItemsHTML(owners) {
  const shown=owners.slice(0,ownerVisibleLimit);
  return shown.map(o => ownerListCardHTML(o)).join('')
    + (owners.length>shown.length?`<div class="list-more" style="grid-column:1/-1"><small>${shown.length} de ${owners.length} tutores</small><button class="btn" onclick="showMoreOwners()">Ver más</button></div>`:'');
}

function renderOwners() {
  return `
    <div class="page-header">
      <div class="title"><small>Familias</small><h1>Tutores</h1></div>
      <button class="btn btn-primary" onclick="openOwnerModal()">+ Nuevo tutor</button>
    </div>
    <div class="search-bar">
      <input type="text" id="ownerSearch" placeholder="Buscar tutor..." oninput="filterOwners(this.value)">
    </div>
    <div id="ownersGrid" class="pets-grid">
      ${db.owners.length === 0 ? `<div class="empty-state" style="grid-column:1/-1"><div class="ico">${icon('users')}</div>Sin tutores registrados</div>` : ownerItemsHTML(db.owners)}
    </div>
  `;
}

function showOwnerInvoices(ownerId) {
  const owner=db.owners.find(item=>item.id===ownerId);
  invoiceFilters.query=owner?.name||'';
  navigateTo('invoices');
}

// Items para pickerOne(). El teléfono y el DNI son lo que distingue a dos
// tutores con el mismo nombre: hay 176 repartidos en 84 grupos homónimos.
function ownerPickerItems(options) {
  const opts = options || {};
  const pool = opts.ids ? db.owners.filter(o => opts.ids.includes(o.id)) : db.owners;
  return pool.map(o => ({
    id: o.id,
    label: o.name,
    sub: [o.phone || o.altPhone || 'sin teléfono', o.dni ? 'DNI ' + o.dni : ''].filter(Boolean).join(' · '),
    search: [o.name, o.dni, o.phone, o.altPhone].filter(Boolean).join(' ')
  })).sort((a, b) => compareEs(a.label, b.label));
}

function ownerListCardHTML(o) {
  const pets = db.pets.filter(p => (p.ownerIds||[]).includes(o.id));
  const balance = (db.invoices||[]).filter(inv=>inv.ownerId===o.id&&inv.status==='pending').reduce((sum,inv)=>sum+invoiceBalance(inv),0);
  return `
    <div class="pet-card is-static">
      <div class="pet-card-body">
        <h3>${escapeHtml(o.name)}</h3>
        <div class="meta">${icon('phone','ico-sm')} ${escapeHtml(o.phone||'sin teléfono')}</div>
        ${o.altPhone ? `<div class="meta">${icon('phone','ico-sm')} ${escapeHtml(o.altPhone)} <small style="color:var(--text-mute)">(alt.)</small></div>` : ''}
        <div class="meta">${icon('mail','ico-sm')} ${escapeHtml(o.email||'sin email')}</div>
        <div class="tags">
          ${balance?`<button type="button" class="tag warning tag-link" onclick="showOwnerInvoices('${o.id}')">Saldo ${_fmtMoney(balance)}</button>`:''}
          ${pets.map(p => `<button type="button" class="tag tag-link" onclick="openPetDetail('${p.id}')">${escapeHtml(p.name)}</button>`).join('') || '<span class="tag">Sin mascotas</span>'}
        </div>
        <div class="contact-links">
          ${waButtonHTML([o.phone, o.altPhone], { fixOnclick: `openOwnerModal('${o.id}')` })}
          ${o.email ? `<a class="contact-btn mail" href="mailto:${o.email}">Email</a>` : ''}
          <button class="btn btn-sm" style="margin-left:auto" onclick="openOwnerModal('${o.id}')">Editar</button>
          <button class="btn btn-sm btn-primary" onclick="openPetModal(null,'${o.id}')">+ Paciente</button>
        </div>
      </div>
    </div>
  `;
}

function ownerCardHTML(o, petName) {
  const waMsg = `Hola ${o.name}, le escribimos de la veterinaria respecto a ${petName}.`;
  const mailSubj = encodeURIComponent(`Veterinaria - ${petName}`);
  return `
    <div class="owner-card">
      <h4><button type="button" class="link-inline" onclick="closeModal();openOwnerModal('${o.id}')">${escapeHtml(o.name)}</button> ${o.relationship ? `<small style="font-weight: var(--fw-normal);color:var(--text-mute)">· ${escapeHtml(o.relationship)}</small>` : ''}</h4>
      <div style="font-size:var(--fs-sm);color:var(--text-soft)">
        ${o.phone ? `${icon('phone','ico-sm')} ${escapeHtml(o.phone)}<br>` : ''}
        ${o.altPhone ? `${icon('phone','ico-sm')} ${escapeHtml(o.altPhone)} <small style="color:var(--text-mute)">(alt.)</small><br>` : ''}
        ${o.email ? `${icon('mail','ico-sm')} ${escapeHtml(o.email)}<br>` : ''}
        ${o.address ? `${icon('pin','ico-sm')} ${escapeHtml(o.address)}` : ''}
      </div>
      <div class="contact-links">
        ${waButtonHTML([o.phone, o.altPhone], { message: waMsg, fixOnclick: `closeModal();openOwnerModal('${o.id}')` })}
        ${o.phone ? `<a class="contact-btn" href="tel:${telPhone(o.phone)}">Llamar</a>` : ''}
        ${o.altPhone ? `<a class="contact-btn" href="tel:${telPhone(o.altPhone)}">Llamar (alt.)</a>` : ''}
        ${o.email ? `<a class="contact-btn mail" href="mailto:${o.email}?subject=${mailSubj}">Email</a>` : ''}
        <button class="btn btn-sm" style="margin-left:auto" onclick="closeModal();openOwnerModal('${o.id}')">Editar tutor</button>
      </div>
    </div>
  `;
}

function filterOwners(q) {
  clearTimeout(_ownerFilterTimer);
  _ownerFilterTimer=setTimeout(()=>renderFilteredOwners(q),160);
}

function renderFilteredOwners(q) {
  q = String(q||'').toLowerCase().trim();
  const filtered = db.owners.filter(o => [o.name,o.phone,o.altPhone,o.email,o.dni].filter(Boolean).join(' ').toLowerCase().includes(q));
  document.getElementById('ownersGrid').innerHTML = filtered.length === 0 ? '<div class="empty-state" style="grid-column:1/-1">Sin resultados</div>' : ownerItemsHTML(filtered);
}

function showMoreOwners() {
  ownerVisibleLimit+=OWNER_PAGE_SIZE;
  renderFilteredOwners(document.getElementById('ownerSearch')?.value||'');
}

function openOwnerModal(id, fromPet) {
  const owner = id ? db.owners.find(o => o.id === id) : { id: uid() };
  const isNew = !id;
  showModal(`
    <div class="modal-header"><h2>${isNew?'Nuevo tutor':'Editar tutor'}</h2><button class="close-btn" ${fromPet?'data-modal-cancel':''} onclick="${fromPet?'cancelOwnerFromPet()':'closeModal()'}">&times;</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Nombre completo *</label><input type="text" id="oName" value="${escapeAttr(owner.name||'')}"></div>
        <div class="form-group"><label>Relación con mascota</label><input type="text" id="oRel" value="${escapeAttr(owner.relationship||'')}" placeholder="Tutor, hijo/a, cuidador..."></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label for="oPhone">Celular / WhatsApp</label><input type="text" id="oPhone" value="${escapeAttr(owner.phone||'')}" placeholder="15649798 o 2262649798">
          <small style="color:var(--text-mute)">Alcanza con el número local: el código de área sale de Opciones.</small></div>
        <div class="form-group"><label for="oEmail">Email</label><input type="email" id="oEmail" value="${escapeAttr(owner.email||'')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Teléfono alternativo <small style="color:var(--text-mute)">(fijo u otro contacto, opcional)</small></label><input type="text" id="oPhoneAlt" value="${escapeAttr(owner.altPhone||'')}"></div>
      </div>
      <div class="form-group"><label>Dirección</label><input type="text" id="oAddress" value="${escapeAttr(owner.address||'')}"></div>
      <div class="form-group"><label>DNI / Documento</label><input type="text" id="oDni" value="${escapeAttr(owner.dni||'')}"></div>
      <div class="form-group">
        <label>Mascotas asociadas</label>
        ${db.pets.length ? (() => {
          const own = db.pets.filter(p => (p.ownerIds||[]).includes(owner.id)).map(p => p.id);
          const items = petPickerItems({ keepIds: own }).map(it => ({ id: it.id, label: it.label + ' · ' + it.sub, search: it.search }));
          return assocPicker('ownerPetsPicker', items, own);
        })() : '<small style="color:var(--text-mute)">No hay mascotas todavía. Creá una en la sección Pacientes.</small>'}
      </div>
      <div class="form-group"><label>Notas</label><textarea id="oNotes">${escapeHtml(owner.notes||'')}</textarea></div>
    </div>
    <div class="modal-footer">
      ${!isNew && canDeleteEntity('owners') ? `<button class="btn btn-danger" onclick="deleteOwner('${owner.id}')">Eliminar</button>` : ''}
      <button class="btn" ${fromPet?'data-modal-cancel':''} onclick="${fromPet?'cancelOwnerFromPet()':'closeModal()'}">Cancelar</button>
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
    altPhone: document.getElementById('oPhoneAlt').value.trim(),
    email: document.getElementById('oEmail').value.trim(),
    address: document.getElementById('oAddress').value.trim(),
    dni: document.getElementById('oDni').value.trim(),
    notes: document.getElementById('oNotes').value.trim()
  };
  if (isNew) {
    const duplicate = db.owners.find(owner => normalizedRecordName(owner.name) === normalizedRecordName(name)
      || (data.dni && owner.dni && normalizedRecordName(owner.dni) === normalizedRecordName(data.dni)));
    if (duplicate && !document.getElementById('oDuplicateConfirmed')) {
      const notice=document.createElement('div');notice.id='oDuplicateConfirmed';notice.className='inline-warning';
      const duplicateAction=window._pendingPetDraft
        ? `<button type="button" class="link-inline" onclick="useOwnerForPendingPet('${duplicate.id}')">Usar este tutor</button>`
        : `<button type="button" class="link-inline" onclick="closeModal();openOwnerModal('${duplicate.id}')">Abrir tutor</button>`;
      notice.innerHTML=`${icon('alert','ico-sm')} Ya existe ${escapeHtml(duplicate.name)}${duplicate.dni?' · DNI '+escapeHtml(duplicate.dni):''}. ${duplicateAction} · Volvé a guardar para crear igualmente.`;
      document.getElementById('oName')?.closest('.form-row')?.after(notice);return;
    }
  }
  // Ya no se exige el formato internacional completo: con el código de área
  // configurado en Opciones, "15649798" se reconstruye solo. Sólo se avisa
  // cuando de verdad no se puede armar un celular, que es cuando el botón de
  // WhatsApp va a quedar deshabilitado para este tutor.
  const issue = data.phone || data.altPhone ? phoneIssue([data.phone, data.altPhone]) : null;
  if (issue) {
    showConfirm(
      `${phoneIssueText([data.phone, data.altPhone])}. Sin un celular válido no vas a poder avisarle por WhatsApp. ¿Guardar igual?`,
      () => persistOwner(id, isNew, data),
      { okLabel: 'Guardar igual', okClass: 'btn-primary' }
    );
    return;
  }
  persistOwner(id, isNew, data);
}

function useOwnerForPendingPet(ownerId) {
  const draft=window._pendingPetDraft;
  if (!draft) { closeModal();openOwnerModal(ownerId);return; }
  window._pendingPetDraft=null;
  draft.ownerIds=[...new Set([...(draft.ownerIds||[]),ownerId])];
  closeModal();
  openPetModal(null,ownerId,draft);
}

function cancelOwnerFromPet() {
  const draft=window._pendingPetDraft;
  window._pendingPetDraft=null;
  closeModal();
  if (draft) openPetModal(null,null,draft);
}

function persistOwner(id, isNew, data) {
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
  saveDB(isNew?'Tutor creado':'Tutor actualizado');
  closeModal();
  if (isNew && window._pendingPetDraft) {
    const draft=window._pendingPetDraft;window._pendingPetDraft=null;
    draft.ownerIds=[...(draft.ownerIds||[]),id];
    openPetModal(null,id,draft);
  } else render();
}

function deleteOwner(id) {
  if(!canDeleteEntity('owners')){ toast('Tu rol no permite eliminar tutores'); return; }
  showConfirm('¿Eliminar este tutor? Quedará desvinculado de sus mascotas.', () => {
  db.owners = db.owners.filter(o=>o.id!==id);
  db.pets.forEach(p => { if (p.ownerIds) p.ownerIds = p.ownerIds.filter(oid => oid !== id); });
  saveDB('Tutor eliminado'); closeModal(); render();
});
}

// ========================================
// [13] VISTA: TURNOS (APPOINTMENTS)
// ========================================
