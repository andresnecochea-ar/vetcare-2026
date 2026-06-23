function renderInventory() {
  return `
    <div class="page-header">
      <div class="title"><small>Stock de productos</small><h1>Inventario</h1></div>
      <button class="btn btn-primary" onclick="openInvModal()">+ Nuevo producto</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Producto</th><th class="col-sec">Categoría</th><th>Stock</th><th class="col-sec">Mínimo</th><th class="col-sec">Precio</th><th class="col-sec">Vencimiento</th><th></th></tr></thead>
        <tbody>
          ${db.inventory.length === 0 ? '<tr><td colspan="7"><div class="empty-state">Sin productos registrados. Agrega vacunas, medicamentos, alimentos, etc.</div></td></tr>' : db.inventory.map(i => `
            <tr>
              <td><strong>${escapeHtml(i.name)}</strong></td>
              <td class="col-sec">${escapeHtml(i.category||'—')}</td>
              <td>${i.stock} ${parseInt(i.stock||0) <= parseInt(i.minStock||0) ? '<span class="tag danger">Bajo</span>' : ''}</td>
              <td class="col-sec">${i.minStock||'—'}</td>
              <td class="col-sec">${i.price?'$'+parseFloat(i.price).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</td>
              <td class="col-sec">${i.expiry?formatDate(i.expiry):'—'}</td>
              <td><div class="actions"><button class="btn btn-sm" onclick="openInvModal('${i.id}')">Editar</button><button class="btn btn-sm btn-danger" onclick="deleteInv('${i.id}')" title="Eliminar">${iconX()}</button></div></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openInvModal(id) {
  const i = id ? db.inventory.find(x=>x.id===id) : { id: uid() };
  const isNew = !id;
  showModal(`
    <div class="modal-header"><h2>${isNew?'Nuevo producto':'Editar producto'}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Nombre *</label><input type="text" id="iName" value="${escapeAttr(i.name||'')}"></div>
        <div class="form-group"><label>Categoría</label><select id="iCat"><option ${i.category==='Medicamento'?'selected':''}>Medicamento</option><option ${i.category==='Vacuna'?'selected':''}>Vacuna</option><option ${i.category==='Alimento'?'selected':''}>Alimento</option><option ${i.category==='Insumo'?'selected':''}>Insumo</option><option ${i.category==='Accesorio'?'selected':''}>Accesorio</option></select></div>
      </div>
      <div class="form-row-3">
        <div class="form-group"><label>Stock actual</label><input type="number" id="iStock" value="${i.stock||0}"></div>
        <div class="form-group"><label>Stock mínimo</label><input type="number" id="iMin" value="${i.minStock||0}"></div>
        <div class="form-group"><label>Precio</label><input type="number" step="0.01" id="iPrice" value="${i.price||''}"></div>
      </div>
      <div class="form-group"><label>Vencimiento</label><input type="date" id="iExpiry" value="${i.expiry||''}"></div>
      <div class="form-group"><label>Notas</label><textarea id="iNotes">${escapeHtml(i.notes||'')}</textarea></div>
    </div>
    <div class="modal-footer">
      ${!isNew ? `<button class="btn btn-danger" onclick="deleteInv('${i.id}')">Eliminar</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveInv('${i.id}', ${isNew})">Guardar</button>
    </div>
  `);
}

function saveInv(id, isNew) {
  const name = document.getElementById('iName').value.trim();
  if (!validateField('iName', !!name, 'El nombre es obligatorio')) return;
  const data = { id, name, category: document.getElementById('iCat').value, stock: document.getElementById('iStock').value, minStock: document.getElementById('iMin').value, price: document.getElementById('iPrice').value, expiry: document.getElementById('iExpiry').value, notes: document.getElementById('iNotes').value };
  if (isNew) db.inventory.push(data); else { const idx = db.inventory.findIndex(x=>x.id===id); db.inventory[idx] = data; }
  saveDB(); closeModal(); render(); toast('Producto guardado');
}

function deleteInv(id) {
  showConfirm('¿Eliminar este producto del inventario?', () => {
    db.inventory = db.inventory.filter(i=>i.id!==id);
    saveDB(); closeModal(); render();
  });
}

// ========================================
// [19] VISTA: FACTURACIÓN (INVOICES)
// ========================================
