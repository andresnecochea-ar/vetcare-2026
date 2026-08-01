function renderInvoices() {
  const invs = db.invoices||[];
  const summary = VetCareFinance.summarize(invs);
  return `
    <div class="page-header">
      <div class="title"><small>Administración</small><h1>Recibos</h1></div>
      <button class="btn btn-primary" onclick="openInvoiceModal()">+ Nuevo recibo</button>
    </div>
    <div class="grid-stats">
      <div class="stat-card"><div class="stat-label">${icon('money','ico-sm')} Total cobrado</div><div class="stat-val" style="color:var(--color-navy)">$${summary.paidTotal.toLocaleString('es-AR',{maximumFractionDigits:0})}</div></div>
      <div class="stat-card"><div class="stat-label">${icon('clock','ico-sm')} Pendiente cobro</div><div class="stat-val" style="color:var(--warning)">$${summary.pendingTotal.toLocaleString('es-AR',{maximumFractionDigits:0})}</div></div>
      <div class="stat-card"><div class="stat-label">${icon('checkCircle','ico-sm')} Cobrados</div><div class="stat-val" style="color:var(--color-mint-hover)">${summary.paidCount}</div></div>
      <div class="stat-card"><div class="stat-label">${icon('receipt','ico-sm')} Comprobantes</div><div class="stat-val">${invs.length}</div></div>
    </div>
    <div class="table-wrap as-cards">
      <table>
        <thead><tr><th>Tutor</th><th>#</th><th>Paciente</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th></tr></thead>
        <tbody>
        ${invs.length===0
          ?'<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-mute)">Sin recibos todavía. ¡Creá el primero!</td></tr>'
          :invs.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(inv=>{
              const owner=db.owners.find(o=>o.id===inv.ownerId);
              const pet=db.pets.find(p=>p.id===inv.petId);
              const sl=inv.status==='paid'?'Cobrado':inv.status==='cancelled'?'Cancelado':'Pendiente';
              const sc=inv.status==='paid'?'tag-success':inv.status==='cancelled'?'tag-mute':'tag-warning';
              return `<tr>
                <td data-primary>${owner?`<button type="button" class="link-cell" onclick="openOwnerModal('${owner.id}')">${escapeHtml(owner.name)}</button>`:'—'}</td>
                <td data-label="Recibo"><strong>#${inv.number||inv.id.slice(-4).toUpperCase()}</strong></td>
                <td data-label="Paciente">${pet?`<button type="button" class="link-cell" onclick="openPetDetail('${pet.id}')">${escapeHtml(petDisplayName(pet))}</button>`:'—'}</td>
                <td data-label="Fecha">${formatDate(inv.date)}</td>
                <td data-label="Total"><strong>$${parseFloat(inv.total||0).toLocaleString('es-AR',{maximumFractionDigits:0})}</strong></td>
                <td data-label="Estado"><span class="tag ${sc}">${sl}</span></td>
                <td style="white-space:nowrap">
                  <button class="btn btn-sm" onclick="printInvoice('${inv.id}')" title="Imprimir" aria-label="Imprimir">${icon('print','ico-sm')}</button>
                  <button class="btn btn-sm" onclick="openInvoiceModal('${inv.id}')" title="Editar" aria-label="Editar">${icon('edit','ico-sm')}</button>
                  ${canDeleteEntity('invoices') ? `<button class="btn btn-sm btn-danger" onclick="deleteInvoice('${inv.id}')" title="Eliminar">${iconX()}</button>` : ''}
                </td></tr>`;}).join('')}
        </tbody>
      </table>
    </div>
  `;
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
        ${inv.items.map(item=>`
          <div class="form-row inv-item" style="margin-bottom:6px;align-items:center">
            <input type="text" placeholder="Descripción" value="${escapeAttr(item.desc||'')} " class="inv-desc" style="flex:3">
            <input type="number" placeholder="Cant." value="${item.qty||1}" class="inv-qty" style="flex:0.7;min-width:55px" oninput="updateInvTotal()">
            <input type="number" placeholder="Precio" value="${item.price||0}" class="inv-price" style="flex:1;min-width:75px" oninput="updateInvTotal()">
            <button class="btn btn-sm btn-danger" onclick="this.closest('.inv-item').remove();updateInvTotal()" style="flex:none" title="Quitar">${iconX()}</button>
          </div>`).join('')}
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
  const d=document.createElement('div');d.className='form-row inv-item';d.style.cssText='margin-bottom:6px;align-items:center';
  d.innerHTML=`<input type="text" placeholder="Descripción" class="inv-desc" style="flex:3">
    <input type="number" placeholder="Cant." value="1" class="inv-qty" style="flex:0.7;min-width:55px" oninput="updateInvTotal()">
    <input type="number" placeholder="Precio" value="0" class="inv-price" style="flex:1;min-width:75px" oninput="updateInvTotal()">
    <button class="btn btn-sm btn-danger" onclick="this.closest('.inv-item').remove();updateInvTotal()" style="flex:none" title="Quitar">${iconX()}</button>`;
  c.appendChild(d);
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
    if(desc.trim()){items.push({desc,qty,price});total+=qty*price;}});
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
  const inv={
    id:id||uid(),
    ownerId,
    petId,
    date:document.getElementById('invDate')?.value||localDateKey(),
    status:document.getElementById('invStatus')?.value||'pending',
    items,total,
    notes:document.getElementById('invNotes')?.value||'',
    encounterId:existingInvoice?.encounterId||'',
    number:isNew?nextLocalInvoiceNumber():(existingInvoice?.number||nextLocalInvoiceNumber())
  };
  if(isNew){db.invoices.push(inv);}
  else{const idx=db.invoices.findIndex(i=>i.id===id);if(idx>-1)db.invoices[idx]=inv;else db.invoices.push(inv);}
  saveDB(isNew?'Recibo creado':'Recibo actualizado');closeModal();currentView='invoices';render();
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
