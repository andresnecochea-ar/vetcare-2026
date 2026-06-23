function renderAppointments() {
  const now = new Date();
  const upcoming = db.appointments.filter(a=>new Date(a.date+'T'+(a.time||'00:00'))>=now)
    .sort((a,b)=>new Date(a.date+'T'+(a.time||'00:00'))-new Date(b.date+'T'+(b.time||'00:00')));
  const past = db.appointments.filter(a=>new Date(a.date+'T'+(a.time||'00:00'))<now)
    .sort((a,b)=>new Date(b.date+'T'+(b.time||'00:00'))-new Date(a.date+'T'+(a.time||'00:00')));
  const sorted = [...upcoming, ...past];
  function apptRow(a) {
    const pet = db.pets.find(p=>p.id===a.petId);
    const isPast = new Date(a.date+'T'+(a.time||'00:00')) < now;
    const notesFull = a.notes||'';
    const notesShort = notesFull.length > 40 ? notesFull.slice(0,40)+'…' : notesFull;
    return `<tr>
      <td>${formatDate(a.date)}</td>
      <td>${a.time||'—'}</td>
      <td>${pet ? escapeHtml(pet.name) : '—'}</td>
      <td class="col-sec">${escapeHtml(a.type||'—')}</td>
      <td class="col-sec">${escapeHtml(a.vet||'—')}</td>
      <td class="col-sec"><span${notesFull.length>40?' data-tip="'+escapeAttr(notesFull)+'"':''} style="white-space:nowrap">${escapeHtml(notesShort)}</span></td>
      <td class="col-sec"><span class="tag ${isPast?'':'accent'}">${isPast?'Pasado':'Próximo'}</span></td>
      <td><div class="actions"><button class="btn btn-sm" onclick="openApptModal('${a.id}')">Editar</button><button class="btn btn-sm btn-danger" onclick="deleteAppt('${a.id}')" title="Eliminar">${iconX()}</button></div></td>
    </tr>`;
  }
  return `
    <div class="page-header">
      <div class="title"><small>Agenda médica</small><h1>Turnos</h1></div>
      <button class="btn btn-warm" onclick="openApptModal()">+ Nuevo turno</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th class="col-sec">Tipo</th><th class="col-sec">Profesional</th><th class="col-sec">Notas</th><th class="col-sec">Estado</th><th></th></tr></thead>
        <tbody>
          ${sorted.length===0?'<tr><td colspan="8"><div class="empty-state">Sin turnos registrados</div></td></tr>':sorted.map(apptRow).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openApptModal(id, presetPetId) {
  const a = id ? db.appointments.find(x=>x.id===id) : { id: uid(), petId: presetPetId||'' };
  const isNew = !id;
  const petOpts = db.pets.map(p => `<option value="${p.id}" ${(a.petId===p.id||p.id===presetPetId)?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
  showModal(`
    <div class="modal-header"><h2>${isNew?'Nuevo turno':'Editar turno'}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Paciente *</label><select id="aPet" aria-required="true"><option value="">Seleccionar...</option>${petOpts}</select><span class="field-error"></span></div>
      <div class="form-row-3">
        <div class="form-group"><label>Fecha *</label><input type="date" id="aDate" value="${a.date||''}" aria-required="true"><span class="field-error"></span></div>
        <div class="form-group"><label>Hora</label><input type="time" id="aTime" value="${a.time||''}"></div>
        <div class="form-group"><label>Tipo</label><select id="aType"><option ${a.type==='Consulta'?'selected':''}>Consulta</option><option ${a.type==='Vacunación'?'selected':''}>Vacunación</option><option ${a.type==='Cirugía'?'selected':''}>Cirugía</option><option ${a.type==='Control'?'selected':''}>Control</option><option ${a.type==='Análisis'?'selected':''}>Análisis</option><option ${a.type==='Emergencia'?'selected':''}>Emergencia</option></select></div>
      </div>
      <div class="form-group"><label>Profesional</label><input type="text" id="aVet" value="${escapeAttr(a.vet||'')}"></div>
      <div class="form-group"><label>Notas</label><textarea id="aNotes">${escapeHtml(a.notes||'')}</textarea></div>
    </div>
    <div class="modal-footer">
      ${!isNew ? `<button class="btn btn-danger" onclick="deleteAppt('${a.id}')">Eliminar</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveAppt('${a.id}', ${isNew})">Guardar</button>
    </div>
  `);
}

function saveAppt(id, isNew) {
  const petId = document.getElementById('aPet').value;
  const date = document.getElementById('aDate').value;
  const _v1 = validateField('aPet', !!petId, 'Seleccioná un paciente');
  const _v2 = validateField('aDate', !!date, 'La fecha es obligatoria');
  if (!_v1 || !_v2) return;
  const data = { id, petId, date, time: document.getElementById('aTime').value, type: document.getElementById('aType').value, vet: document.getElementById('aVet').value, notes: document.getElementById('aNotes').value };
  if (isNew) db.appointments.push(data); else { const i = db.appointments.findIndex(a=>a.id===id); db.appointments[i] = data; }
  saveDB(); closeModal(); render(); toast(isNew?'Turno creado':'Turno actualizado');
}

function deleteAppt(id) {
  showConfirm('¿Eliminar este turno?', () => {
    db.appointments = db.appointments.filter(a=>a.id!==id);
    saveDB(); closeModal(); render();
  });
}

// ========================================
// [14] VISTA: PELUQUERÍA (GROOMING)
// ========================================
function renderGrooming() {
  const _now = new Date();
  const _up = db.groomingAppointments.filter(a=>new Date(a.date+'T'+(a.time||'00:00'))>=_now)
    .sort((a,b)=>new Date(a.date+'T'+(a.time||'00:00'))-new Date(b.date+'T'+(b.time||'00:00')));
  const _ps = db.groomingAppointments.filter(a=>new Date(a.date+'T'+(a.time||'00:00'))<_now)
    .sort((a,b)=>new Date(b.date+'T'+(b.time||'00:00'))-new Date(a.date+'T'+(a.time||'00:00')));
  const sorted = [..._up, ..._ps];
  return `
    <div class="page-header">
      <div class="title"><small>Servicios estéticos</small><h1>Peluquería</h1></div>
      <button class="btn btn-warm" onclick="openGroomModal()">+ Nuevo turno</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th class="col-sec">Servicio</th><th class="col-sec">Peluquero/a</th><th class="col-sec">Precio</th><th class="col-sec">Estado serv.</th><th class="col-sec">Recordatorio</th><th class="col-sec">Próx/Pas</th><th></th></tr></thead>
        <tbody>
          ${sorted.length===0 ? '<tr><td colspan="10"><div class="empty-state">Sin turnos de peluquería</div></td></tr>' : sorted.map(a => {
            const pet = db.pets.find(p=>p.id===a.petId);
            const isPast = new Date(a.date+'T'+(a.time||'00:00')) < _now;
            const notesFull = a.notes||'';
            const notesShort = notesFull.length>40?notesFull.slice(0,40)+'…':notesFull;
            return `<tr>
              <td>${formatDate(a.date)}</td>
              <td>${a.time||'—'}</td>
              <td>${pet ? escapeHtml(pet.name) : '—'}</td>
              <td class="col-sec">${escapeHtml(a.service||'—')}</td>
              <td class="col-sec">${escapeHtml(a.groomer||'—')}</td>
              <td class="col-sec">${a.price ? '$'+a.price : '—'}</td>
              <td class="col-sec"><span class="tag ${a.status==='Completado'?'accent':a.status==='Cancelado'?'danger':''}">${a.status||'Pendiente'}</span></td>
              <td class="col-sec">${a.reminder ? `<span style='font-size:var(--fs-2xs);background:var(--color-lilac-soft);color:#6a4fa0;border:1px solid var(--color-lilac);border-radius:20px;padding:2px 8px;'>&#128276; ${escapeHtml(a.reminder)}</span>` : '<span style="color:var(--text-mute);font-size:var(--fs-xs)">—</span>'}</td>
              <td class="col-sec"><span class="tag ${isPast?'':'accent'}">${isPast?'Pasado':'Próximo'}</span></td>
              <td><div class="actions"><button class="btn btn-sm" onclick="openGroomModal('${a.id}')">Editar</button><button class="btn btn-sm btn-danger" onclick="deleteGroom('${a.id}')" title="Eliminar">${iconX()}</button></div></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openGroomModal(id) {
  const a = id ? db.groomingAppointments.find(x=>x.id===id) : { id: uid() };
  const isNew = !id;
  const petOpts = db.pets.map(p => `<option value="${p.id}" ${a.petId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
  showModal(`
    <div class="modal-header"><h2>${isNew?'Nuevo turno de peluquería':'Editar turno'}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Paciente *</label><select id="gPet"><option value="">Seleccionar...</option>${petOpts}</select></div>
      <div class="form-row-3">
        <div class="form-group"><label>Fecha *</label><input type="date" id="gDate" value="${a.date||''}"></div>
        <div class="form-group"><label>Hora</label><input type="time" id="gTime" value="${a.time||''}"></div>
        <div class="form-group"><label>Estado</label><select id="gStatus"><option ${a.status==='Pendiente'?'selected':''}>Pendiente</option><option ${a.status==='Completado'?'selected':''}>Completado</option><option ${a.status==='Cancelado'?'selected':''}>Cancelado</option></select></div>
      </div>
      <div class="form-row-3">
        <div class="form-group"><label>Servicio</label><select id="gService"><option ${a.service==='Baño'?'selected':''}>Baño</option><option ${a.service==='Corte completo'?'selected':''}>Corte completo</option><option ${a.service==='Baño + corte'?'selected':''}>Baño + corte</option><option ${a.service==='Corte de uñas'?'selected':''}>Corte de uñas</option><option ${a.service==='Limpieza de oídos'?'selected':''}>Limpieza de oídos</option><option ${a.service==='Otro'?'selected':''}>Otro</option></select></div>
        <div class="form-group"><label>Peluquero/a</label><input type="text" id="gGroomer" value="${escapeAttr(a.groomer||'')}"></div>
        <div class="form-group"><label>Precio</label><input type="number" id="gPrice" value="${a.price||''}"></div>
      </div>
      <div class="form-group"><label>&#128276; Recordatorio / Nota al cliente</label><input type="text" id="gReminder" value="${escapeAttr(a.reminder||'')}" placeholder="Ej: Traer champu especial, avisar 1h antes..."></div>
      <div class="form-group"><label>Notas internas</label><textarea id="gNotes">${escapeHtml(a.notes||'')}</textarea></div>
    </div>
    <div class="modal-footer">
      ${!isNew ? `<button class="btn btn-danger" onclick="deleteGroom('${a.id}')">Eliminar</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveGroom('${a.id}', ${isNew})">Guardar</button>
    </div>
  `);
}

function saveGroom(id, isNew) {
  const petId = document.getElementById('gPet').value;
  const date = document.getElementById('gDate').value;
  const _g1 = validateField('gPet', !!petId, 'Seleccioná un paciente');
  const _g2 = validateField('gDate', !!date, 'La fecha es obligatoria');
  if (!_g1 || !_g2) return;
  const data = { id, petId, date, time: document.getElementById('gTime').value, service: document.getElementById('gService').value, groomer: document.getElementById('gGroomer').value, price: document.getElementById('gPrice').value, status: document.getElementById('gStatus').value, reminder: document.getElementById('gReminder').value.trim(), notes: document.getElementById('gNotes').value };
  if (isNew) db.groomingAppointments.push(data); else { const i = db.groomingAppointments.findIndex(a=>a.id===id); db.groomingAppointments[i] = data; }
  saveDB(); closeModal(); render(); toast(isNew?'Turno creado':'Turno actualizado');
}

function deleteGroom(id) {
  showConfirm('¿Eliminar este turno de peluquería?', () => {
  db.groomingAppointments = db.groomingAppointments.filter(a=>a.id!==id);
  saveDB(); closeModal(); render(); toast('Turno eliminado');
});
}

// ========================================
// [15] VISTA: CALENDARIO (CALENDAR)
// ========================================
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let calView = 'month';              // 'month' | 'week' | 'day'
let calRef = new Date();            // fecha de referencia para semana/dia

function calViewSwitcher() {
  return `<div class="cal-view-switch">
    <button class="btn btn-sm ${calView==='month'?'active':''}" onclick="setCalView('month')">Mes</button>
    <button class="btn btn-sm ${calView==='week'?'active':''}" onclick="setCalView('week')">Semana</button>
    <button class="btn btn-sm ${calView==='day'?'active':''}" onclick="setCalView('day')">Día</button>
  </div>`;
}
function setCalView(v){ calView = v; render(); }
function _ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function shiftRef(days){ calRef = new Date(calRef.getFullYear(), calRef.getMonth(), calRef.getDate()+days); render(); }

function renderCalendar() {
  if (calView === 'week') return renderWeekView();
  if (calView === 'day') return renderDayView();
  return renderMonthView();
}

function renderMonthView() {
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();

  let cells = '';
  // Previous month padding
  const prevMonthLast = new Date(calYear, calMonth, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevMonthLast - i;
    cells += `<div class="cal-day other-month"><div class="num">${d}</div></div>`;
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;
    const dayEvents = getEventsForDate(dateStr);
    cells += `<div class="cal-day ${isToday?'today':''}" onclick="openDayDetail('${dateStr}')">
      <div class="num">${d}</div>
      <div class="events-mini">
        ${dayEvents.slice(0,3).map(e => `<div class="cal-event-mini ${e.cls}" title="${escapeAttr(e.title)}">${escapeHtml(e.title)}</div>`).join('')}
        ${dayEvents.length > 3 ? `<div style="font-size:var(--fs-2xs);color:var(--text-mute)">+${dayEvents.length-3} más</div>` : ''}
      </div>
    </div>`;
  }
  // Next month padding
  const totalCells = startDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    cells += `<div class="cal-day other-month"><div class="num">${d}</div></div>`;
  }

  return `
    <div class="page-header">
      <div class="title"><small>Vista mensual</small><h1>Calendario</h1></div>
      <div style="display:flex;gap:8px;align-items:center">${calViewSwitcher()}
      <button class="btn btn-primary" onclick="openReminderModal()">+ Nuevo aviso</button></div>
    </div>
    <div class="card">
      <div class="calendar-header">
        <button class="btn btn-sm" onclick="changeMonth(-1)">‹</button>
        <h2>${monthNames[calMonth]} ${calYear}</h2>
        <button class="btn btn-sm" onclick="changeMonth(1)">›</button>
      </div>
      <div class="calendar-grid">
        ${dayNames.map(n => `<div class="cal-day-name">${n}</div>`).join('')}
        ${cells}
      </div>
      <div style="margin-top:14px;display:flex;gap:14px;font-size:var(--fs-xs);color:var(--text-soft);flex-wrap:wrap">
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:2px;margin-right:4px"></span>Turnos</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--info);border-radius:2px;margin-right:4px"></span>Peluquería</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--warning);border-radius:2px;margin-right:4px"></span>Avisos</span>
      </div>
    </div>
  `;
}

function attachCalendarListeners() {}

function changeMonth(d) {
  calMonth += d;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  render();
}

function _weekStart(ref){ var d=new Date(ref.getFullYear(),ref.getMonth(),ref.getDate()); d.setDate(d.getDate()-d.getDay()); return d; }

function renderWeekView(){
  var dayNames=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var monthNames=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var start=_weekStart(calRef);
  var days=[]; for(var i=0;i<7;i++){ var d=new Date(start); d.setDate(start.getDate()+i); days.push(d); }
  var today=_ymd(new Date());
  var cols=days.map(function(d){
    var ds=_ymd(d);
    var ev=getEventsForDate(ds);
    return '<div class="cal-week-col '+(ds===today?'today':'')+'" onclick="openDayDetail(\''+ds+'\')">'
      + '<div class="cal-week-head">'+dayNames[d.getDay()]+' '+d.getDate()+'</div>'
      + '<div class="cal-week-events">'
      + (ev.length? ev.map(function(e){return '<div class="cal-event-mini '+e.cls+'" title="'+escapeAttr(e.title)+'">'+escapeHtml(e.title)+'</div>';}).join('') : '<div class="cal-week-empty">—</div>')
      + '</div></div>';
  }).join('');
  var rangeLabel = days[0].getDate()+' '+monthNames[days[0].getMonth()]+' — '+days[6].getDate()+' '+monthNames[days[6].getMonth()];
  return `
    <div class="page-header">
      <div class="title"><small>Vista semanal</small><h1>Calendario</h1></div>
      <div style="display:flex;gap:8px;align-items:center">${calViewSwitcher()}
      <button class="btn btn-primary" onclick="openReminderModal()">+ Nuevo aviso</button></div>
    </div>
    <div class="card">
      <div class="calendar-header">
        <button class="btn btn-sm" onclick="shiftRef(-7)">‹</button>
        <h2>${rangeLabel}</h2>
        <button class="btn btn-sm" onclick="shiftRef(7)">›</button>
      </div>
      <div class="cal-week-grid">${cols}</div>
    </div>
  `;
}

function renderDayView(){
  var dayNames=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var monthNames=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var ds=_ymd(calRef);
  var ev=getEventsForDate(ds);
  var label=dayNames[calRef.getDay()]+' '+calRef.getDate()+' de '+monthNames[calRef.getMonth()];
  return `
    <div class="page-header">
      <div class="title"><small>Vista diaria</small><h1>Calendario</h1></div>
      <div style="display:flex;gap:8px;align-items:center">${calViewSwitcher()}
      <button class="btn btn-primary" onclick="openReminderModal()">+ Nuevo aviso</button></div>
    </div>
    <div class="card">
      <div class="calendar-header">
        <button class="btn btn-sm" onclick="shiftRef(-1)">‹</button>
        <h2>${label}</h2>
        <button class="btn btn-sm" onclick="shiftRef(1)">›</button>
      </div>
      <div class="cal-day-list">
        ${ev.length ? ev.map(function(e){return '<div class="cal-day-row '+e.cls+'">'+escapeHtml(e.title)+'</div>';}).join('') : '<div class="empty-state">Sin eventos este día</div>'}
      </div>
      <div style="margin-top:14px"><button class="btn btn-sm" onclick="openDayDetail('${ds}')">Ver detalle / agregar</button></div>
    </div>
  `;
}

function getEventsForDate(dateStr) {
  const events = [];
  db.appointments.filter(a => a.date === dateStr).forEach(a => {
    const pet = db.pets.find(p=>p.id===a.petId);
    events.push({ title: `${a.time||''} ${pet?pet.name:''} ${a.type||''}`.trim(), cls: '' });
  });
  db.groomingAppointments.filter(a => a.date === dateStr).forEach(a => {
    const pet = db.pets.find(p=>p.id===a.petId);
    events.push({ title: `${a.time||''} ${pet?pet.name:''} ${a.service||''}`.trim(), cls: 'info' });
  });
  db.reminders.filter(r => r.date === dateStr && !r.completed).forEach(r => {
    events.push({ title: r.title, cls: 'warning' });
  });
  return events;
}

function openDayDetail(dateStr) {
  const events = getEventsForDate(dateStr);
  const appts = db.appointments.filter(a => a.date === dateStr);
  const groom = db.groomingAppointments.filter(a => a.date === dateStr);
  const rems = db.reminders.filter(r => r.date === dateStr && !r.completed);
  showModal(`
    <div class="modal-header"><h2>${formatDate(dateStr)}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      ${appts.length === 0 && groom.length === 0 && rems.length === 0 ? '<div class="empty-state">Sin eventos este día</div>' : ''}
      ${appts.length ? '<h3 style="margin-bottom:8px">Turnos médicos</h3>' : ''}
      ${appts.map(a => { const p = db.pets.find(x=>x.id===a.petId); return `<div class="reminder-item"><div class="info"><strong>${a.time||''} · ${p?escapeHtml(p.name):''}</strong><small>${escapeHtml(a.type||'')} ${a.vet?'· '+escapeHtml(a.vet):''}</small></div></div>`; }).join('')}
      ${groom.length ? '<h3 style="margin:12px 0 8px">Peluquería</h3>' : ''}
      ${groom.map(a => { const p = db.pets.find(x=>x.id===a.petId); return `<div class="reminder-item"><div class="info"><strong>${a.time||''} · ${p?escapeHtml(p.name):''}</strong><small>${escapeHtml(a.service||'')} ${a.groomer?'· '+escapeHtml(a.groomer):''}</small></div></div>`; }).join('')}
      ${rems.length ? '<h3 style="margin:12px 0 8px">Avisos</h3>' : ''}
      ${rems.map(r => { const p = db.pets.find(x=>x.id===r.petId); return `<div class="reminder-item soon"><div class="info"><strong>${escapeHtml(r.title)}</strong><small>${p?escapeHtml(p.name)+' · ':''}${escapeHtml(r.notes||'')}</small></div><button class="btn btn-sm" onclick="completeReminder('${r.id}')">✓</button></div>`; }).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal();openReminderModal(null,'${dateStr}')">+ Aviso</button>
      <button class="btn btn-primary" onclick="closeModal();openApptModalForDate('${dateStr}')">+ Turno</button>
    </div>
  `);
}

function openApptModalForDate(date) {
  openApptModal();
  setTimeout(() => { document.getElementById('aDate').value = date; }, 50);
}

// ========================================
// [16] VISTA: AVISOS (REMINDERS)
// ========================================
