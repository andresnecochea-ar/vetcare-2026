let invoiceFilters = { period: 'month', from: '', to: '', professional: '', status: '', query: '' };

function setInvoiceFilter(key,value){
  if(key==='from'||key==='to'){
    const bounds=dateFilterBounds(invoiceFilters);
    invoiceFilters.period='custom';
    invoiceFilters.from=bounds.from;
    invoiceFilters.to=bounds.to;
  }
  invoiceFilters[key]=value;
  render();
}

function invoiceProfessional(invoice){
  const pet=(db.pets||[]).find(item=>item.id===invoice.petId);
  const encounter=pet&&(pet.history||[]).find(item=>item.id===invoice.encounterId);
  const grooming=(db.groomingAppointments||[]).find(item=>item.invoiceId===invoice.id);
  return { vet:encounter?.vet||grooming?.groomer||'', vetUserId:encounter?.vetUserId||grooming?.groomerUserId||'' };
}

function invoiceBalance(invoice) { return Math.max(0, Number(invoice.total||0) - Number(invoice.amountPaid||0)); }

function applyInvoiceStock(invoice) {
  if (!invoice || invoice.stockAppliedAt || invoice.status !== 'paid') return;
  (invoice.items||[]).filter(item=>item.productId).forEach(item => consumeInventoryProduct(item.productId,'',Number(item.qty)||1));
  invoice.stockAppliedAt = new Date().toISOString();
}

function renderInvoices() {
  const invs = db.invoices||[];
  const professionalRecords=invs.map(invoice=>invoiceProfessional(invoice));
  const filtered=invs.filter(invoice=>{
    const professional=invoiceProfessional(invoice);
    return dateMatchesFilter(invoice.date,invoiceFilters)
      && (!invoiceFilters.status||invoice.status===invoiceFilters.status)
      && (!invoiceFilters.query || normalizedRecordName([
        invoice.number,
        db.owners.find(owner=>owner.id===invoice.ownerId)?.name,
        db.pets.find(pet=>pet.id===invoice.petId)?.name,
        ...(invoice.items||[]).map(item=>item.desc)
      ].join(' ')).includes(normalizedRecordName(invoiceFilters.query)))
      && professionalMatches(professional,invoiceFilters.professional,'vetUserId','vet');
  });
  const summary = VetCareFinance.summarize(filtered);
  return `
    <div class="page-header">
      <div class="title"><small>Administración</small><h1>Recibos</h1></div>
      <button class="btn btn-primary" onclick="openInvoiceModal()">+ Nuevo recibo</button>
    </div>
    <div class="grid-stats">
      <div class="stat-card"><div class="stat-label">${icon('money','ico-sm')} Total cobrado</div><div class="stat-val" style="color:var(--color-navy)">$${summary.paidTotal.toLocaleString('es-AR',{maximumFractionDigits:0})}</div></div>
      <div class="stat-card"><div class="stat-label">${icon('clock','ico-sm')} Pendiente cobro</div><div class="stat-val" style="color:var(--warning)">$${summary.pendingTotal.toLocaleString('es-AR',{maximumFractionDigits:0})}</div></div>
      <div class="stat-card"><div class="stat-label">${icon('checkCircle','ico-sm')} Cobrados</div><div class="stat-val" style="color:var(--color-mint-hover)">${summary.paidCount}</div></div>
      <div class="stat-card"><div class="stat-label">${icon('receipt','ico-sm')} Comprobantes</div><div class="stat-val">${filtered.length}</div></div>
    </div>
    <div class="list-filters">
      ${dateFilterControls(invoiceFilters,'setInvoiceFilter')}
      <label>Profesional<select class="input" onchange="setInvoiceFilter('professional',this.value)">${professionalFilterOptions(professionalRecords,'vetUserId','vet',invoiceFilters.professional,false)}</select></label>
      <label>Estado<select class="input" onchange="setInvoiceFilter('status',this.value)">
        <option value="">Cualquier estado</option>
        <option value="pending" ${invoiceFilters.status==='pending'?'selected':''}>Pendiente</option>
        <option value="paid" ${invoiceFilters.status==='paid'?'selected':''}>Cobrado</option>
        <option value="cancelled" ${invoiceFilters.status==='cancelled'?'selected':''}>Cancelado</option>
      </select></label>
      <label>Buscar<input class="input" value="${escapeAttr(invoiceFilters.query)}" oninput="invoiceFilters.query=this.value;clearTimeout(window._invoiceSearchTimer);window._invoiceSearchTimer=setTimeout(render,180)" placeholder="Tutor, paciente o número"></label>
      <span class="list-filter-count">${filtered.length} de ${invs.length} recibos</span>
    </div>
    <div class="table-wrap as-cards">
      <table>
        <thead><tr><th>Tutor</th><th>#</th><th>Paciente</th><th>Fecha</th><th class="col-sec">Profesional</th><th>Total</th><th>Estado</th><th></th></tr></thead>
        <tbody>
        ${filtered.length===0
          ?'<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-mute)">Sin recibos para estos filtros</td></tr>'
          :filtered.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(inv=>{
              const owner=db.owners.find(o=>o.id===inv.ownerId);
              const pet=db.pets.find(p=>p.id===inv.petId);
              const professional=invoiceProfessional(inv);
              const sl=inv.status==='paid'?'Cobrado':inv.status==='cancelled'?'Cancelado':'Pendiente';
              const sc=inv.status==='paid'?'tag-success':inv.status==='cancelled'?'tag-mute':'tag-warning';
              return `<tr>
                <td data-primary>${owner?`<button type="button" class="link-cell" onclick="openOwnerModal('${owner.id}')">${escapeHtml(owner.name)}</button>`:'—'}</td>
                <td data-label="Recibo"><strong>#${inv.number||inv.id.slice(-4).toUpperCase()}</strong></td>
                <td data-label="Paciente">${pet?`<button type="button" class="link-cell" onclick="openPetDetail('${pet.id}')">${escapeHtml(petDisplayName(pet))}</button>`:'—'}</td>
                <td data-label="Fecha">${formatDate(inv.date)}</td>
                <td class="col-sec" data-label="Profesional">${escapeHtml(professional.vet||'—')}</td>
                <td data-label="Total"><strong>$${parseFloat(inv.total||0).toLocaleString('es-AR',{maximumFractionDigits:0})}</strong>${invoiceBalance(inv)>0&&Number(inv.amountPaid)>0?`<small>Saldo $${invoiceBalance(inv).toLocaleString('es-AR')}</small>`:''}</td>
                <td data-label="Estado"><span class="tag ${sc}">${sl}</span></td>
                <td style="white-space:nowrap">
                  <button class="btn btn-sm" onclick="printInvoice('${inv.id}')" title="Imprimir" aria-label="Imprimir">${icon('print','ico-sm')}</button>
                  <button class="btn btn-sm" onclick="openInvoiceModal('${inv.id}')" title="Editar" aria-label="Editar">${icon('edit','ico-sm')}</button>
                  ${inv.status==='pending'?`<button class="btn btn-sm btn-primary" onclick="openInvoicePayment('${inv.id}')">Cobrar</button>`:''}
                  ${canDeleteEntity('invoices') ? `<button class="btn btn-sm btn-danger" onclick="deleteInvoice('${inv.id}')" title="Eliminar">${iconX()}</button>` : ''}
                </td></tr>`;}).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function invoiceProductOptions(selected) {
  return '<option value="">Ítem manual</option>' + (db.inventory||[]).map(product => `<option value="${escapeAttr(product.id)}" ${product.id===selected?'selected':''}>${escapeHtml(product.name)} · ${_fmtMoney(product.price)}</option>`).join('');
}

function invoiceItemHTML(item) {
  return `<div class="form-row inv-item" style="margin-bottom:6px;align-items:center">
    <select class="inv-product" onchange="fillInvoiceProduct(this)">${invoiceProductOptions(item.productId||'')}</select>
    <input type="text" placeholder="Descripción" value="${escapeAttr(item.desc||'')}" class="inv-desc">
    <input type="number" min="0.01" step="0.01" placeholder="Cant." value="${item.qty||1}" class="inv-qty" oninput="updateInvTotal()">
    <input type="number" min="0" step="0.01" placeholder="Precio" value="${item.price||0}" class="inv-price" oninput="updateInvTotal()">
    <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.inv-item').remove();updateInvTotal()" title="Quitar">${iconX()}</button>
  </div>`;
}

function fillInvoiceProduct(select) {
  const row = select.closest('.inv-item');
  const product = (db.inventory||[]).find(item=>item.id===select.value);
  if (product) {
    row.querySelector('.inv-desc').value = product.name;
    row.querySelector('.inv-price').value = product.price || 0;
  }
  updateInvTotal();
}

function openInvoiceModal(id) {
  const isNew=!id, today=localDateKey();
  const inv=isNew
    ?{id:uid(),date:today,items:[{desc:'',qty:1,price:0}],status:'pending',ownerId:'',petId:'',notes:''}
    :((db.invoices||[]).find(i=>i.id===id)||{id:uid(),date:today,items:[{desc:'',qty:1,price:0}],status:'pending',ownerId:'',petId:'',notes:''});
  const linkedPet=inv.encounterId?db.pets.find(p=>p.id===inv.petId):null;
  const ownerItems=linkedPet
    ?ownerPickerItems({ids:linkedPet.ownerIds||[]})
    :ownerPickerItems();
  // Un recibo nacido de una consulta no puede cambiar de paciente: se muestra
  // el vínculo en vez del selector, para no romper la trazabilidad.
  const petField=inv.encounterId
    ?`<div class="picker-one-chosen is-locked"><div class="picker-one-chosen-main"><strong>${escapeHtml(linkedPet?linkedPet.name:'Paciente de la consulta')}</strong><small>${linkedPet?escapeHtml(petContextLine(linkedPet)):''}</small></div></div>`
    :pickerOne('invPet',invoicePickerItems(inv.ownerId,inv.petId),inv.petId||'',{onChange:"syncInvoiceRelations('pet')",emptyLabel:'Ese tutor no tiene pacientes asociados'});
  showModal(`
    <div class="modal-header">
      <h2>${isNew?'Nuevo recibo':'Editar recibo #'+(inv.number||'')}</h2>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      ${inv.encounterId ? `<div class="linked-receipt-context"><strong>Vinculado a una consulta clínica</strong><span>El paciente ${linkedPet ? `<button type="button" class="link-inline" onclick="closeModal();openPetDetail('${linkedPet.id}')">${escapeHtml(linkedPet.name)}</button>` : ''} queda protegido para conservar la trazabilidad.</span></div>` : ''}
      <div class="form-row">
        <div class="form-group"><label for="invOwner-search">Tutor</label>
          ${pickerOne('invOwner',ownerItems,inv.ownerId||'',{onChange:"syncInvoiceRelations('owner')",placeholder:'Buscar por apellido, DNI o teléfono...'})}</div>
        <div class="form-group"><label for="invPet-search">Paciente${inv.encounterId?' vinculado':''}</label>
          ${petField}</div>
      </div>
      <div class="form-row">
        <div class="form-group"><label for="invPaymentMethod">Medio de pago</label><select id="invPaymentMethod"><option value="">Sin indicar</option>${['Efectivo','Débito','Crédito','Transferencia','Mercado Pago','Otro'].map(method=>`<option value="${method}" ${inv.paymentMethod===method?'selected':''}>${method}</option>`).join('')}</select></div>
        <div class="form-group"><label for="invAmountPaid">Importe abonado</label><input type="number" min="0" step="0.01" id="invAmountPaid" value="${escapeAttr(inv.amountPaid||0)}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label for="invDate">Fecha</label><input type="date" id="invDate" value="${inv.date}"></div>
        <div class="form-group"><label for="invStatus">Estado</label>
          <select id="invStatus">
            <option value="pending" ${inv.status==='pending'?'selected':''}>Pendiente</option>
            <option value="paid" ${inv.status==='paid'?'selected':''}>Cobrado</option>
            <option value="cancelled" ${inv.status==='cancelled'?'selected':''}>Cancelado</option>
          </select></div>
      </div>
      <label style="display:block;margin-bottom:8px;font-weight: var(--fw-bold)">Ítems / Servicios</label>
      <div id="invItems">
        ${inv.items.map(invoiceItemHTML).join('')}
      </div>
      <button class="btn btn-sm" onclick="addInvItem()" style="margin-top:4px">+ Agregar ítem</button>
      <div style="text-align:right;font-size:var(--fs-md);font-family:var(--font-display);padding:12px;background:var(--bg-soft);border-radius:var(--radius-sm);margin-top:12px;margin-bottom:10px">
        Total: <strong id="invTotalDisplay">$0</strong></div>
      <div class="form-group"><label>Observaciones</label>
        <textarea id="invNotes" rows="2">${escapeHtml(inv.notes||'')} </textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveInvoice('${id||''}',${isNew})">${icon('save','ico-sm')} ${isNew?'Crear recibo':'Guardar cambios'}</button>
    </div>
  `,true);
  updateInvTotal();
}

// Pacientes ofrecidos para el recibo: los del tutor elegido, o todos si
// todavía no hay tutor. Un recibo viejo puede apuntar a un paciente que ya no
// está asociado a ese tutor; en ese caso se lo conserva, marcado, para no
// perder el dato al editar.
function invoicePickerItems(ownerId,selectedPetId){
  const items=ownerId
    ?petPickerItems({keepId:selectedPetId}).filter(it=>{
        const pet=db.pets.find(p=>p.id===it.id);
        return pet&&(pet.ownerIds||[]).includes(ownerId);
      })
    :petPickerItems({keepId:selectedPetId});
  if(selectedPetId&&!items.some(it=>it.id===selectedPetId)){
    const pet=db.pets.find(p=>p.id===selectedPetId);
    if(pet)items.unshift({
      id:pet.id,
      label:'⚠ '+pet.name+' — no asociado a este tutor',
      sub:petContextLine(pet),
      search:pet.name
    });
  }
  return items;
}

function syncInvoiceRelations(source){
  if(!document.getElementById('invPet'))return;   // recibo vinculado a consulta
  let ownerId=getPickerOne('invOwner');
  let petId=getPickerOne('invPet');
  if(source==='pet'&&petId){
    const pet=db.pets.find(p=>p.id===petId);
    // Elegir el paciente completa el tutor solo: es el camino más frecuente.
    if(pet&&ownerId&&!(pet.ownerIds||[]).includes(ownerId))ownerId='';
    if(pet&&!ownerId)ownerId=(pet.ownerIds||[])[0]||'';
    setPickerOneItems('invOwner',ownerPickerItems(),ownerId);
  }
  if(source==='owner'&&petId){
    const pet=db.pets.find(p=>p.id===petId);
    if(ownerId&&pet&&!(pet.ownerIds||[]).includes(ownerId))petId='';
  }
  setPickerOneItems('invPet',invoicePickerItems(ownerId,petId),petId);
}

function addInvItem(){
  const c=document.getElementById('invItems');if(!c)return;
  c.insertAdjacentHTML('beforeend',invoiceItemHTML({desc:'',qty:1,price:0,productId:''}));
}

function updateInvTotal(){
  let t=0;document.querySelectorAll('.inv-item').forEach(row=>{
    t+=(parseFloat(row.querySelector('.inv-qty')?.value||1))*(parseFloat(row.querySelector('.inv-price')?.value||0));});
  const el=document.getElementById('invTotalDisplay');
  if(el)el.textContent='$'+t.toLocaleString('es-AR',{maximumFractionDigits:0});
  return t;
}

function nextLocalInvoiceNumber(){
  const highest=(db.invoices||[]).reduce((max,invoice)=>{
    const value=/^\d+$/.test(invoice.number||'')?parseInt(invoice.number,10):0;
    return Math.max(max,value);
  },0);
  return String(highest+1).padStart(4,'0');
}

function saveInvoice(id,isNew){
  const items=[];let total=0;
  document.querySelectorAll('.inv-item').forEach(row=>{
    const desc=row.querySelector('.inv-desc')?.value||'';
    const qty=parseFloat(row.querySelector('.inv-qty')?.value||1);
    const price=parseFloat(row.querySelector('.inv-price')?.value||0);
    const productId=row.querySelector('.inv-product')?.value||'';
    if(desc.trim()){items.push({desc:desc.trim(),qty,price,productId});total+=qty*price;}});
  db.invoices=db.invoices||[];
  const existingInvoice=id?db.invoices.find(i=>i.id===id):null;
  const ownerId=getPickerOne('invOwner');
  // El recibo nacido de una consulta no muestra selector de paciente: conserva
  // el que ya tenía.
  const petId=document.getElementById('invPet')?getPickerOne('invPet'):(existingInvoice?.petId||'');
  const selectedPet=petId?db.pets.find(p=>p.id===petId):null;
  if(ownerId&&petId&&(!selectedPet||!(selectedPet.ownerIds||[]).includes(ownerId))){
    toast('El paciente no está asociado al tutor seleccionado','error');
    return;
  }
  let amountPaid=Math.max(0,parseFloat(document.getElementById('invAmountPaid')?.value||0)||0);
  let status=document.getElementById('invStatus')?.value||'pending';
  if(status==='paid') amountPaid=total;
  else if(status!=='cancelled'&&amountPaid>=total&&total>0) status='paid';
  const inv={
    id:id||uid(),
    ownerId,
    petId,
    date:document.getElementById('invDate')?.value||localDateKey(),
    status,
    items,total,
    notes:document.getElementById('invNotes')?.value||'',
    encounterId:existingInvoice?.encounterId||'',
    paymentMethod:document.getElementById('invPaymentMethod')?.value||'',
    amountPaid,
    stockAppliedAt:existingInvoice?.stockAppliedAt||'',
    number:isNew?nextLocalInvoiceNumber():(existingInvoice?.number||nextLocalInvoiceNumber())
  };
  applyInvoiceStock(inv);
  if(isNew){db.invoices.push(inv);}
  else{const idx=db.invoices.findIndex(i=>i.id===id);if(idx>-1)db.invoices[idx]=inv;else db.invoices.push(inv);}
  saveDB(isNew?'Recibo creado':'Recibo actualizado');closeModal();currentView='invoices';render();
}

function openInvoicePayment(id) {
  const invoice=(db.invoices||[]).find(item=>item.id===id);
  if(!invoice)return;
  const balance=invoiceBalance(invoice)||Number(invoice.total||0);
  showModal(`<div class="modal-header"><h2>Cobrar recibo #${escapeHtml(invoice.number||invoice.id.slice(-4))}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-row"><div class="form-group"><label for="payAmount">Importe</label><input type="number" min="0.01" step="0.01" max="${balance}" id="payAmount" value="${balance}"></div><div class="form-group"><label for="payMethod">Medio de pago</label><select id="payMethod">${['Efectivo','Débito','Crédito','Transferencia','Mercado Pago','Otro'].map(method=>`<option>${method}</option>`).join('')}</select></div></div><p>Saldo actual: <strong>${_fmtMoney(balance)}</strong>. Podés registrar un pago parcial.</p></div><div class="modal-footer"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveInvoicePayment('${id}')">Registrar cobro</button></div>`);
}

function saveInvoicePayment(id) {
  const invoice=(db.invoices||[]).find(item=>item.id===id);
  const amount=Math.max(0,Number(document.getElementById('payAmount')?.value)||0);
  if(!invoice||amount<=0){toast('Ingresá un importe válido','error');return;}
  invoice.amountPaid=Math.min(Number(invoice.total||0),Number(invoice.amountPaid||0)+amount);
  invoice.paymentMethod=document.getElementById('payMethod')?.value||'';
  invoice.status=invoice.amountPaid>=Number(invoice.total||0)?'paid':'pending';
  applyInvoiceStock(invoice);
  saveDB(invoice.status==='paid'?'Recibo cobrado':'Pago parcial registrado');
  closeModal();render();
}

function deleteInvoice(id){
  if(!canDeleteEntity('invoices')){ toast('Tu rol no permite eliminar recibos'); return; }
  showConfirm('¿Eliminar este recibo?',()=>{
    db.invoices=(db.invoices||[]).filter(i=>i.id!==id);
    saveDB('Recibo eliminado');render();
  });
}

function printInvoice(id){
  const inv=(db.invoices||[]).find(i=>i.id===id);if(!inv)return;
  const owner=db.owners.find(o=>o.id===inv.ownerId);
  const pet=db.pets.find(p=>p.id===inv.petId);
  const sl=inv.status==='paid'?'Cobrado':inv.status==='cancelled'?'Cancelado':'Pendiente';
  const w=window.open('','_blank');
  w.document.write('<!DOCTYPE html><html><head><title>Recibo #'+(inv.number||inv.id.slice(-4))+'</title>'
    +'<style>body{font-family:Georgia,serif;padding:40px;max-width:620px;margin:auto;color:#1a1a1a}'
    +'h1{font-size:1.5rem;margin-bottom:6px}.meta{color:#666;font-size:.9rem;margin-bottom:20px;padding:10px;background:#f9f9f9;border-radius:4px}'
    +'table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}'
    +'.total{text-align:right;font-size:1.3rem;font-weight:bold;padding:12px 0}'
    +'@media print{button{display:none}}</style></head><body>'
    +'<h1>'+escapeHtml(clinicInfo().name)+' \u2014 Recibo #'+(inv.number||inv.id.slice(-4).toUpperCase())+'</h1>'
    +((clinicContactLine()||clinicInfo().taxId)?'<div style="color:#666;font-size:.85rem;margin-bottom:14px">'+[clinicContactLine(),clinicInfo().taxId?'CUIT '+escapeHtml(clinicInfo().taxId):''].filter(Boolean).join(' \u00b7 ')+'</div>':'')
    +'<div class="meta">Fecha: '+formatDate(inv.date)+' \u00b7 Estado: '+sl
    +(owner?'<br>Tutor: '+escapeHtml(owner.name):'')
    +(pet?' \u00b7 Paciente: '+escapeHtml(pet.name):'')+'</div>'
    +'<table><thead><tr><th>Descripci\u00f3n</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th></tr></thead><tbody>'
    +inv.items.map(i=>'<tr><td>'+escapeHtml(i.desc)+'</td><td>'+i.qty+'</td><td>$'+parseFloat(i.price).toLocaleString('es-AR')+'</td><td>$'+(i.qty*i.price).toLocaleString('es-AR')+'</td></tr>').join('')
    +'</tbody></table>'
    +'<div class="total">Total: $'+parseFloat(inv.total||0).toLocaleString('es-AR',{minimumFractionDigits:2})+'</div>'
    +(inv.notes?'<p style="color:#666;margin-top:12px">'+escapeHtml(inv.notes)+'</p>':'')
    +'<br><button onclick="window.print()">\uD83D\uDDB8 Imprimir</button></body></html>');
  w.document.close();
}

// ========================================
// [20] VISTA: RESPALDO (BACKUP)
// ========================================
