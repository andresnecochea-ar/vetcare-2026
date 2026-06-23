// ========================================
// [18] VISTA: INVENTARIO (stock por lotes; catalogo se gestiona en Opciones)
// ========================================

function invTotalStock(it){
  return (it.lots||[]).reduce(function(s,l){ return s + (parseInt(l.qty)||0); }, 0);
}
function invNextExpiry(it){
  var fechas = (it.lots||[]).map(function(l){ return l.expiry; }).filter(Boolean).sort();
  return fechas.length ? fechas[0] : '';
}
function _fmtMoney(v){ return '$'+parseFloat(v||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}); }

// ---- INVENTARIO: solo stock de productos ya existentes ----
function renderInventory() {
  return `
    <div class="page-header">
      <div class="title"><small>Stock de productos</small><h1>Inventario</h1></div>
      <button class="btn btn-secondary" onclick="openCatalog()">Gestionar catálogo</button>
    </div>
    ${db.inventory.length === 0
      ? '<div class="empty-state">No hay productos en el catálogo. Agregalos desde Opciones › Catálogo de productos (o el botón de arriba).</div>'
      : `<div class="table-wrap">
      <table>
        <thead><tr><th>Producto</th><th class="col-sec">Categoría</th><th>Stock</th><th class="col-sec">Mínimo</th><th class="col-sec">Precio</th><th class="col-sec">Próx. venc.</th><th>Stock</th></tr></thead>
        <tbody>
          ${db.inventory.map(i => {
            const total = invTotalStock(i);
            const low = total <= parseInt(i.minStock||0);
            const next = invNextExpiry(i);
            const venc = next ? (new Date(next) < new Date() ? `<span class="tag danger">${formatDate(next)} venc.</span>` : formatDate(next)) : '—';
            return `
            <tr>
              <td><strong>${escapeHtml(i.name)}</strong></td>
              <td class="col-sec">${escapeHtml(i.category||'—')}</td>
              <td>${total} ${low ? '<span class="tag danger">Bajo</span>' : ''}</td>
              <td class="col-sec">${i.minStock||'—'}</td>
              <td class="col-sec">${i.price?_fmtMoney(i.price):'—'}</td>
              <td class="col-sec">${venc}</td>
              <td><div class="actions" style="white-space:nowrap">
                <button class="btn btn-sm btn-primary" onclick="openAddLotModal('${i.id}')" title="Cargar stock">+</button>
                <button class="btn btn-sm" onclick="openUseStockModal('${i.id}')" title="Usar/bajar stock">−</button>
              </div></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`}
  `;
}

// ---- CATALOGO (gestion de productos) ----
function openCatalog() {
  const rows = db.inventory.length === 0
    ? '<div class="empty-state">Sin productos. Creá el primero.</div>'
    : `<div class="table-wrap"><table>
        <thead><tr><th>Producto</th><th class="col-sec">Categoría</th><th class="col-sec">Mínimo</th><th class="col-sec">Precio</th><th></th></tr></thead>
        <tbody>${db.inventory.map(i=>`
          <tr>
            <td><strong>${escapeHtml(i.name)}</strong></td>
            <td class="col-sec">${escapeHtml(i.category||'—')}</td>
            <td class="col-sec">${i.minStock||'—'}</td>
            <td class="col-sec">${i.price?_fmtMoney(i.price):'—'}</td>
            <td><div class="actions" style="white-space:nowrap">
              <button class="btn btn-sm" onclick="openInvModal('${i.id}')">Editar</button>
              <button class="btn btn-sm btn-danger" onclick="deleteInv('${i.id}')" title="Eliminar">${iconX()}</button>
            </div></td>
          </tr>`).join('')}</tbody></table></div>`;
  showModal(`
    <div class="modal-header"><h2>Catálogo de productos</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <button class="btn btn-primary" style="margin-bottom:14px" onclick="openInvModal()">+ Nuevo producto</button>
      ${rows}
    </div>
  `, true);
}

// ---- Alta / edicion de producto ----
function openInvModal(id) {
  const i = id ? db.inventory.find(x=>x.id===id) : { id: uid(), lots: [] };
  const isNew = !id;
  const cats = ['Medicamento','Vacuna','Alimento','Insumo','Accesorio'];
  const catOpts = cats.map(c=>`<option ${i.category===c?'selected':''}>${c}</option>`).join('');
  showModal(`
    <div class="modal-header"><h2>${isNew?'Nuevo producto':'Editar producto'}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Nombre *</label><input type="text" id="iName" value="${escapeAttr(i.name||'')}"></div>
        <div class="form-group"><label>Categoría</label><select id="iCat">${catOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Stock mínimo</label><input type="number" id="iMin" value="${i.minStock||0}"></div>
        <div class="form-group"><label>Precio</label><input type="number" step="0.01" id="iPrice" value="${i.price||''}"></div>
      </div>
      <div class="form-group"><label>Notas</label><textarea id="iNotes">${escapeHtml(i.notes||'')}</textarea></div>
      ${isNew ? '<small style="color:var(--text-mute)">Luego cargá el stock desde la sección Inventario con el botón +.</small>' : `<small style="color:var(--text-mute)">Stock actual: ${invTotalStock(i)} u en ${(i.lots||[]).length} lote(s).</small>`}
    </div>
    <div class="modal-footer">
      ${!isNew ? `<button class="btn btn-danger" onclick="deleteInv('${i.id}')">Eliminar</button>` : ''}
      <button class="btn" onclick="openCatalog()">Volver</button>
      <button class="btn btn-primary" onclick="saveInv('${i.id}', ${isNew})">Guardar</button>
    </div>
  `);
}

function saveInv(id, isNew) {
  const name = document.getElementById('iName').value.trim();
  if (!validateField('iName', !!name, 'El nombre es obligatorio')) return;
  if (isNew) {
    db.inventory.push({ id, name, category: document.getElementById('iCat').value, minStock: document.getElementById('iMin').value, price: document.getElementById('iPrice').value, notes: document.getElementById('iNotes').value, lots: [] });
  } else {
    const it = db.inventory.find(x=>x.id===id);
    it.name = name; it.category = document.getElementById('iCat').value;
    it.minStock = document.getElementById('iMin').value; it.price = document.getElementById('iPrice').value;
    it.notes = document.getElementById('iNotes').value;
    if (!it.lots) it.lots = [];
  }
  saveDB(); openCatalog(); render(); toast('Producto guardado');
}

// ---- Cargar stock (agregar lote) ----
function openAddLotModal(id) {
  const it = db.inventory.find(x=>x.id===id);
  if(!it) return;
  showModal(`
    <div class="modal-header"><h2>Cargar stock — ${escapeHtml(it.name)}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Cantidad *</label><input type="number" id="lotQty" min="1" value="1"></div>
        <div class="form-group"><label>Vencimiento (opcional)</label><input type="date" id="lotExp" value=""></div>
      </div>
      <small style="color:var(--text-mute)">Cada carga es un lote independiente. Así sabés cuántas unidades vencen en cada fecha.</small>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveLot('${id}')">Cargar</button>
    </div>
  `);
}

function saveLot(id) {
  const it = db.inventory.find(x=>x.id===id);
  if(!it) return;
  const qty = parseInt(document.getElementById('lotQty').value)||0;
  if (qty <= 0) { toast('Ingresá una cantidad válida'); return; }
  const expiry = document.getElementById('lotExp').value || '';
  if (!it.lots) it.lots = [];
  it.lots.push({ id: uid(), qty: qty, expiry: expiry });
  saveDB(); closeModal(); render(); toast('Stock cargado ✓');
}

// ---- Usar / bajar stock ----
function openUseStockModal(id) {
  const it = db.inventory.find(x=>x.id===id);
  if(!it) return;
  const lots = (it.lots||[]).slice().sort((a,b)=> (a.expiry||'9999').localeCompare(b.expiry||'9999'));
  if (lots.length === 0) { toast('Este producto no tiene stock cargado'); return; }
  const rows = lots.map(l => `
    <label class="assoc-row" style="justify-content:space-between">
      <span><input type="radio" name="useLot" value="${l.id}" style="width:auto;margin-right:8px"> ${l.qty} u · venc: ${l.expiry?formatDate(l.expiry):'sin fecha'}</span>
    </label>`).join('');
  showModal(`
    <div class="modal-header"><h2>Usar stock — ${escapeHtml(it.name)}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label>¿De qué lote (vencimiento) se usó?</label>
        <div class="assoc-list" style="border:1px solid var(--border);border-radius:var(--radius-sm)">${rows}</div>
      </div>
      <div class="form-group"><label>Cantidad a descontar *</label><input type="number" id="useQty" min="1" value="1"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="useStock('${id}')">Descontar</button>
    </div>
  `);
}

function useStock(id) {
  const it = db.inventory.find(x=>x.id===id);
  if(!it) return;
  const sel = document.querySelector('input[name="useLot"]:checked');
  if (!sel) { toast('Elegí un lote'); return; }
  const qty = parseInt(document.getElementById('useQty').value)||0;
  if (qty <= 0) { toast('Cantidad inválida'); return; }
  const lot = (it.lots||[]).find(l=>l.id===sel.value);
  if (!lot) { toast('Lote no encontrado'); return; }
  if (qty > lot.qty) { toast('No hay tantas unidades en ese lote ('+lot.qty+')'); return; }
  lot.qty -= qty;
  if (lot.qty <= 0) it.lots = it.lots.filter(l=>l.id!==lot.id);
  saveDB(); closeModal(); render(); toast('Stock descontado ✓');
}

function deleteInv(id) {
  showConfirm('¿Eliminar este producto del catálogo? Se pierde su stock.', () => {
    db.inventory = db.inventory.filter(i=>i.id!==id);
    saveDB(); closeModal(); render();
  });
}
