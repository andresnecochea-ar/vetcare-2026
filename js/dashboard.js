function renderDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const todayAppts = db.appointments.filter(a=>a.date===today).length;
  const todayGroom = db.groomingAppointments.filter(a=>a.date===today).length;
  const invoices = db.invoices||[];
  const totalBilled = invoices.reduce((s,i)=>s+(parseFloat(i.total)||0),0);
  const pendingInv = invoices.filter(i=>i.status==='pending').length;
  const lowStock = db.inventory.filter(i=>invTotalStock(i)<=parseInt(i.minStock||0)).length;
  const pendingRem = db.reminders.filter(r=>!r.completed).length;
  const days7 = Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().split('T')[0];});
  const apptCounts = days7.map(d=>db.appointments.filter(a=>a.date===d).length+db.groomingAppointments.filter(a=>a.date===d).length);
  const dayLabels = days7.map(d=>new Date(d+'T12:00:00').toLocaleDateString('es-AR',{weekday:'short',day:'numeric'}));
  const speciesCount={};
  db.pets.forEach(p=>{const s=p.species||'Otro';speciesCount[s]=(speciesCount[s]||0)+1;});
  const spKeys=Object.keys(speciesCount), spVals=spKeys.map(k=>speciesCount[k]);
  const spColors=['#6F2DBD','#A663CC','#F4B860','#c08fe0','#e5a04d','#8a52b8'];
  const lowItems=db.inventory.filter(i=>invTotalStock(i)<=parseInt(i.minStock||0));
  setTimeout(()=>{
    const c1=document.getElementById('chartAppts');
    if(c1&&window.Chart){if(c1._ci)c1._ci.destroy();
      c1._ci=new Chart(c1,{type:'bar',data:{labels:dayLabels,datasets:[{label:'Turnos',data:apptCounts,
        backgroundColor:'rgba(111,45,189,0.75)',borderColor:'#6F2DBD',borderWidth:2,borderRadius:6}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
          scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'rgba(0,0,0,.04)'}},x:{grid:{display:false}}}}});}
    const c2=document.getElementById('chartSpecies');
    if(c2&&window.Chart&&spKeys.length>0){if(c2._ci)c2._ci.destroy();
      c2._ci=new Chart(c2,{type:'doughnut',data:{labels:spKeys,datasets:[{data:spVals,
        backgroundColor:spColors.slice(0,spKeys.length),borderWidth:0}]},
        options:{responsive:true,maintainAspectRatio:false,cutout:'62%',
          plugins:{legend:{position:'bottom',labels:{font:{size:12},padding:10}}}}});}
  },80);
  return `
    <div class="page-header">
      <div class="title"><small>Resumen</small><h1>Panel general</h1></div>
      <div style="font-size:var(--fs-sm);color:var(--text-soft)">${new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div class="grid-stats">
      <div class="stat-card"><div class="stat-label">🐾 Pacientes</div><div class="stat-val" style="color:var(--color-navy)">${db.pets.length}</div></div>
      <div class="stat-card"><div class="stat-label">👥 Tutores</div><div class="stat-val">${db.owners.length}</div></div>
      <div class="stat-card"><div class="stat-label">📅 Turnos hoy</div><div class="stat-val" style="color:var(--color-navy)">${todayAppts+todayGroom}</div></div>
      <div class="stat-card"><div class="stat-label">💰 Cobrado total</div><div class="stat-val" style="color:var(--color-mint-hover)">$${totalBilled.toLocaleString('es-AR',{maximumFractionDigits:0})}</div></div>
      ${pendingRem>0?`<div class="stat-card"><div class="stat-label">🔔 Avisos pendientes</div><div class="stat-val" style="color:var(--color-coral)">${pendingRem}</div></div>`:''}
      ${lowStock>0?`<div class="stat-card"><div class="stat-label">⚠ Stock bajo</div><div class="stat-val" style="color:var(--warning)">${lowStock}</div></div>`:''}
      ${pendingInv>0?`<div class="stat-card"><div class="stat-label">🧾 Recibos pendientes</div><div class="stat-val" style="color:var(--warning)">${pendingInv}</div></div>`:''}
    </div>
    <div class="dashboard-charts">
      <div class="card"><h3 style="margin-bottom:14px">Actividad — últimos 7 días</h3>
        <div class="chart-wrap"><canvas id="chartAppts"></canvas></div></div>
      <div class="card"><h3 style="margin-bottom:14px">Pacientes por especie</h3>
        <div class="chart-wrap">${spKeys.length>0
          ?'<canvas id="chartSpecies"></canvas>'
          :'<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-mute);font-size:var(--fs-sm)">Sin pacientes aún</div>'}</div></div>
    </div>
    ${lowItems.length>0?`
    <div class="card" style="border-left:3px solid var(--warning);margin-bottom:16px">
      <h3 style="color:var(--warning);margin-bottom:10px">⚠ Stock bajo</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${lowItems.map(i=>`<span style="background:var(--bg-soft);padding:4px 12px;border-radius:20px;font-size:var(--fs-sm)">${escapeHtml(i.name)} <strong style="color:var(--warning)">(${invTotalStock(i)} u)</strong></span>`).join('')}
      </div></div>`:''}
  `;
}

function renderUpcomingAppts() {
  const upcoming = [...db.appointments, ...db.groomingAppointments]
    .filter(a => new Date(a.date + 'T' + (a.time || '00:00')) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a,b) => new Date(a.date+'T'+(a.time||'00:00')) - new Date(b.date+'T'+(b.time||'00:00')))
    .slice(0, 5);
  if (upcoming.length === 0) return '<div class="empty-state"><div class="ico">◰</div>Sin turnos próximos</div>';
  return upcoming.map(a => {
    const pet = db.pets.find(p => p.id === a.petId);
    return `<div class="reminder-item">
      <div class="info">
        <strong>${pet ? pet.name : '—'} · ${a.type || (a.service ? 'Peluquería: ' + a.service : 'Consulta')}</strong>
        <small>${formatDate(a.date)} ${a.time || ''}</small>
      </div>
    </div>`;
  }).join('');
}

function renderUrgentReminders() {
  const urgent = db.reminders.filter(r => !r.completed)
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  if (urgent.length === 0) return '<div class="empty-state"><div class="ico">▲</div>Sin avisos pendientes</div>';
  return urgent.map(r => {
    const pet = db.pets.find(p => p.id === r.petId);
    const days = Math.floor((new Date(r.date) - new Date()) / (1000*60*60*24));
    const cls = days < 0 ? 'urgent' : days <= 3 ? 'soon' : '';
    return `<div class="reminder-item ${cls}">
      <div class="info">
        <strong>${r.title}</strong>
        <small>${pet ? pet.name + ' · ' : ''}${formatDate(r.date)} ${days < 0 ? '(vencido)' : days === 0 ? '(hoy)' : `(en ${days}d)`}</small>
      </div>
      <button class="btn btn-sm" onclick="completeReminder('${r.id}')">✓</button>
    </div>`;
  }).join('');
}

// ========================================
// [11] VISTA: PACIENTES (PETS)
// ========================================
