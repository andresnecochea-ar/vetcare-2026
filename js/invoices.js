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
    <div class="card" style="overflow-x:auto">
      <table>
        <thead><tr><th>#</th><th>Tutor</th><th class="col-sec">Paciente</th><th class="col-sec">Fecha</th><th>Total</th><th class="col-sec">Estado</th><th></th></tr></thead>
        <tbody>
        ${invs.length===0
          ?'<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-mute)">Sin recibos todavía. ¡Creá el primero!</td></tr>'
          :invs.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(inv=>{
              const owner=db.owners.find(o=>o.id===inv.ownerId);
              const pet=db.pets.find(p=>p.id===inv.petId);
              const sl=inv.status==='paid'?'Cobrado':inv.status==='cancelled'?'Cancelado':'Pendiente';
              const sc=inv.status==='paid'?'tag-success':inv.status==='cancelled'?'tag-mute':'tag-warning';
              return `<tr>
                <td><strong>#${inv.number||inv.id.slice(-4).toUpperCase()}</strong></td>
                <td>${owner?`<button type="button" class="link-cell" onclick="openOwnerModal('${owner.id}')">${escapeHtml(owner.name)}</button>`:'—'}</td>
                <td class="col-sec">${pet?`<button type="button" class="link-cell" onclick="openPetDetail('${pet.id}')">${escapeHtml(pet.name)}</button>`:'—'}</td>
                <td class="col-sec">${formatDate(inv.date)}</td>
                <td><strong>$${parseFloat(inv.total||0).toLocaleString('es-AR',{maximumFractionDigits:0})}</strong></td>
                <td class="col-sec"><span class="tag ${sc}">${sl}</span></td>
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
  const availableOwners=linkedPet?db.owners.filter(o=>(linkedPet.ownerIds||[]).includes(o.id)):db.owners;
  const ownerOpts=availableOwners.map(o=>`<option value="${o.id}" ${inv.ownerId===o.id?'selected':''} >${escapeHtml(o.name)}</option>`).join('');
  const petOpts=invoicePetOptions(inv.ownerId,inv.petId,true);
  showModal(`
    <div class="modal-header">
      <h2>${isNew?'Nuevo recibo':'Editar recibo #'+(inv.number||'')}</h2>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      ${inv.encounterId ? `<div class="linked-receipt-context"><strong>Vinculado a una consulta clínica</strong><span>El paciente ${linkedPet ? `<button type="button" class="link-cell" style="display:inline;padding:0;font:inherit" onclick="closeModal();openPetDetail('${linkedPet.id}')">${escapeHtml(linkedPet.name)}</button>` : ''} queda protegido para conservar la trazabilidad.</span></div>` : ''}
      <div class="form-row">
        <div class="form-group"><label>Tutor</label>
          <select id="invOwner" onchange="syncInvoiceRelations('owner')"><option value="">— Sin tutor —</option>${ownerOpts}</select></div>
        <div class="form-group"><label>Paciente${inv.encounterId?' vinculado':''}</label>
          <select id="invPet" onchange="syncInvoiceRelations('pet')" ${inv.encounterId?'disabled':''}><option value="">— Sin paciente —</option>${petOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Fecha</label><input type="date" id="invDate" value="${inv.date}"></div>
        <div class="form-group"><label>Estado</label>
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

function invoicePetOptions(ownerId,selectedPetId,includeLegacyMismatch){
  let pets=ownerId
    ?db.pets.filter(p=>(p.ownerIds||[]).includes(ownerId))
    :db.pets.slice();
  if(includeLegacyMismatch&&selectedPetId&&!pets.some(p=>p.id===selectedPetId)){
    const legacyPet=db.pets.find(p=>p.id===selectedPetId);
    if(legacyPet)pets.unshift({...legacyPet,_relationWarning:true});
  }
  return pets.map(p=>`<option value="${p.id}" ${selectedPetId===p.id?'selected':''}>${p._relationWarning?'⚠ ':''}${escapeHtml(p.name)}${p._relationWarning?' — no asociado':''}</option>`).join('');
}

function syncInvoiceRelations(source){
  const ownerSelect=document.getElementById('invOwner');
  const petSelect=document.getElementById('invPet');
  if(!ownerSelect||!petSelect)return;
  let ownerId=ownerSelect.value;
  let petId=petSelect.value;
  if(source==='pet'&&petId){
    const pet=db.pets.find(p=>p.id===petId);
    if(pet&&ownerId&&!(pet.ownerIds||[]).includes(ownerId))ownerId='';
    if(pet&&!ownerId)ownerId=(pet.ownerIds||[])[0]||'';
    ownerSelect.value=ownerId;
  }
  if(source==='owner'&&petId){
    const pet=db.pets.find(p=>p.id===petId);
    if(ownerId&&pet&&!(pet.ownerIds||[]).includes(ownerId))petId='';
  }
  petSelect.innerHTML='<option value="">— Sin paciente —</option>'+invoicePetOptions(ownerId,petId,false);
  petSelect.value=petId;
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
  const ownerId=document.getElementById('invOwner')?.value||'';
  const petId=document.getElementById('invPet')?.value||'';
  const selectedPet=petId?db.pets.find(p=>p.id===petId):null;
  const existingInvoice=id?db.invoices.find(i=>i.id===id):null;
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
