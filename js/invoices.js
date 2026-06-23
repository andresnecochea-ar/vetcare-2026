function renderInvoices() {
  const invs = db.invoices||[];
  const total = invs.reduce((s,i)=>s+(parseFloat(i.total)||0),0);
  const pendTotal = invs.filter(i=>i.status==='pending').reduce((s,i)=>s+(parseFloat(i.total)||0),0);
  const paid = invs.filter(i=>i.status==='paid').length;
  return `
    <div class="page-header">
      <div class="title"><small>Administración</small><h1>Facturación</h1></div>
      <button class="btn btn-primary" onclick="openInvoiceModal()">+ Nueva factura</button>
    </div>
    <div class="grid-stats">
      <div class="stat-card"><div class="stat-label">💰 Total facturado</div><div class="stat-val" style="color:var(--color-navy)">$${total.toLocaleString('es-AR',{maximumFractionDigits:0})}</div></div>
      <div class="stat-card"><div class="stat-label">⏳ Pendiente cobro</div><div class="stat-val" style="color:var(--warning)">$${pendTotal.toLocaleString('es-AR',{maximumFractionDigits:0})}</div></div>
      <div class="stat-card"><div class="stat-label">✅ Cobrados</div><div class="stat-val" style="color:var(--color-mint-hover)">${paid}</div></div>
      <div class="stat-card"><div class="stat-label">🧾 Comprobantes</div><div class="stat-val">${invs.length}</div></div>
    </div>
    <div class="card" style="overflow-x:auto">
      <table>
        <thead><tr><th>#</th><th>Tutor</th><th class="col-sec">Paciente</th><th class="col-sec">Fecha</th><th>Total</th><th class="col-sec">Estado</th><th></th></tr></thead>
        <tbody>
        ${invs.length===0
          ?'<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-mute)">Sin facturas todavía. ¡Creá la primera!</td></tr>'
          :invs.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(inv=>{
              const owner=db.owners.find(o=>o.id===inv.ownerId);
              const pet=db.pets.find(p=>p.id===inv.petId);
              const sl=inv.status==='paid'?'Cobrado':inv.status==='cancelled'?'Cancelado':'Pendiente';
              const sc=inv.status==='paid'?'tag-success':inv.status==='cancelled'?'tag-mute':'tag-warning';
              return `<tr>
                <td><strong>#${inv.number||inv.id.slice(-4).toUpperCase()}</strong></td>
                <td>${owner?escapeHtml(owner.name):'—'}</td>
                <td class="col-sec">${pet?escapeHtml(pet.name):'—'}</td>
                <td class="col-sec">${formatDate(inv.date)}</td>
                <td><strong>$${parseFloat(inv.total||0).toLocaleString('es-AR',{maximumFractionDigits:0})}</strong></td>
                <td class="col-sec"><span class="tag ${sc}">${sl}</span></td>
                <td style="white-space:nowrap">
                  <button class="btn btn-sm" onclick="printInvoice('${inv.id}')" title="Imprimir">🖨</button>
                  <button class="btn btn-sm" onclick="openInvoiceModal('${inv.id}')" title="Editar">✏</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${inv.id}')" title="Eliminar">✕</button>
                </td></tr>`;}).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openInvoiceModal(id) {
  const isNew=!id, today=new Date().toISOString().split('T')[0];
  const inv=isNew
    ?{id:uid(),date:today,items:[{desc:'',qty:1,price:0}],status:'pending',ownerId:'',petId:'',notes:''}
    :((db.invoices||[]).find(i=>i.id===id)||{id:uid(),date:today,items:[{desc:'',qty:1,price:0}],status:'pending',ownerId:'',petId:'',notes:''});
  const ownerOpts=db.owners.map(o=>`<option value="${o.id}" ${inv.ownerId===o.id?'selected':''} >${escapeHtml(o.name)}</option>`).join('');
  const petOpts=db.pets.map(p=>`<option value="${p.id}" ${inv.petId===p.id?'selected':''} >${escapeHtml(p.name)}</option>`).join('');
  showModal(`
    <div class="modal-header">
      <h2>${isNew?'Nueva factura':'Editar factura #'+(inv.number||'')}</h2>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Tutor</label>
          <select id="invOwner"><option value="">— Sin tutor —</option>${ownerOpts}</select></div>
        <div class="form-group"><label>Paciente</label>
          <select id="invPet"><option value="">— Sin paciente —</option>${petOpts}</select></div>
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
            <button class="btn btn-sm btn-danger" onclick="this.closest('.inv-item').remove();updateInvTotal()" style="flex:none">✕</button>
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
      <button class="btn btn-primary" onclick="saveInvoice('${id||''}',${isNew})">💾 ${isNew?'Crear factura':'Guardar cambios'}</button>
    </div>
  `,true);
  updateInvTotal();
}

function addInvItem(){
  const c=document.getElementById('invItems');if(!c)return;
  const d=document.createElement('div');d.className='form-row inv-item';d.style.cssText='margin-bottom:6px;align-items:center';
  d.innerHTML=`<input type="text" placeholder="Descripción" class="inv-desc" style="flex:3">
    <input type="number" placeholder="Cant." value="1" class="inv-qty" style="flex:0.7;min-width:55px" oninput="updateInvTotal()">
    <input type="number" placeholder="Precio" value="0" class="inv-price" style="flex:1;min-width:75px" oninput="updateInvTotal()">
    <button class="btn btn-sm btn-danger" onclick="this.closest('.inv-item').remove();updateInvTotal()" style="flex:none">✕</button>`;
  c.appendChild(d);
}

function updateInvTotal(){
  let t=0;document.querySelectorAll('.inv-item').forEach(row=>{
    t+=(parseFloat(row.querySelector('.inv-qty')?.value||1))*(parseFloat(row.querySelector('.inv-price')?.value||0));});
  const el=document.getElementById('invTotalDisplay');
  if(el)el.textContent='$'+t.toLocaleString('es-AR',{maximumFractionDigits:0});
  return t;
}

function saveInvoice(id,isNew){
  const items=[];let total=0;
  document.querySelectorAll('.inv-item').forEach(row=>{
    const desc=row.querySelector('.inv-desc')?.value||'';
    const qty=parseFloat(row.querySelector('.inv-qty')?.value||1);
    const price=parseFloat(row.querySelector('.inv-price')?.value||0);
    if(desc.trim()){items.push({desc,qty,price});total+=qty*price;}});
  db.invoices=db.invoices||[];
  const inv={
    id:id||uid(),
    ownerId:document.getElementById('invOwner')?.value||'',
    petId:document.getElementById('invPet')?.value||'',
    date:document.getElementById('invDate')?.value||new Date().toISOString().split('T')[0],
    status:document.getElementById('invStatus')?.value||'pending',
    items,total,
    notes:document.getElementById('invNotes')?.value||'',
    number:isNew?String(db.invoices.length+1).padStart(4,'0'):((db.invoices.find(i=>i.id===id)||{}).number||String(db.invoices.length+1).padStart(4,'0'))
  };
  if(isNew){db.invoices.push(inv);}
  else{const idx=db.invoices.findIndex(i=>i.id===id);if(idx>-1)db.invoices[idx]=inv;else db.invoices.push(inv);}
  saveDB();closeModal();currentView='invoices';render();
  toast(isNew?'Factura creada ✓':'Factura actualizada ✓');
}

function deleteInvoice(id){
  showConfirm('¿Eliminar esta factura?',()=>{
    db.invoices=(db.invoices||[]).filter(i=>i.id!==id);
    saveDB();render();toast('Factura eliminada');
  });
}

function printInvoice(id){
  const inv=(db.invoices||[]).find(i=>i.id===id);if(!inv)return;
  const owner=db.owners.find(o=>o.id===inv.ownerId);
  const pet=db.pets.find(p=>p.id===inv.petId);
  const sl=inv.status==='paid'?'Cobrado':inv.status==='cancelled'?'Cancelado':'Pendiente';
  const w=window.open('','_blank');
  w.document.write('<!DOCTYPE html><html><head><title>Factura #'+(inv.number||inv.id.slice(-4))+'</title>'
    +'<style>body{font-family:Georgia,serif;padding:40px;max-width:620px;margin:auto;color:#1a1a1a}'
    +'h1{font-size:1.5rem;margin-bottom:6px}.meta{color:#666;font-size:.9rem;margin-bottom:20px;padding:10px;background:#f9f9f9;border-radius:4px}'
    +'table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}'
    +'.total{text-align:right;font-size:1.3rem;font-weight:bold;padding:12px 0}'
    +'@media print{button{display:none}}</style></head><body>'
    +'<h1>'+escapeHtml(db.clinicName||'VetCare')+' \u2014 Factura #'+(inv.number||inv.id.slice(-4).toUpperCase())+'</h1>'
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
