let dashboardPeriod = 'month';

function dashboardBounds(period, previous) {
  const now = new Date();
  const months = period === 'year' ? 12 : period === 'quarter' ? 3 : 1;
  const endMonth = now.getMonth() - (previous ? months : 0);
  const from = new Date(now.getFullYear(), endMonth - months + 1, 1);
  const to = new Date(now.getFullYear(), endMonth + 1, 0);
  return { from: localDateKey(from), to: localDateKey(to) };
}

function dashboardInRange(date, bounds) { return date && date >= bounds.from && date <= bounds.to; }
function dashboardDelta(current, previous) {
  if (!previous) return current ? 'Nuevo' : '0 %';
  const value = ((current - previous) / previous) * 100;
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)} %`;
}
function setDashboardPeriod(value) { dashboardPeriod = value; render(); }
function dashboardGo(view) { navigateTo(view); }
function dashboardInvoices(status) { invoiceFilters.status = status || ''; invoiceFilters.period = dashboardPeriod==='month'?'month':'custom'; if(invoiceFilters.period==='custom')Object.assign(invoiceFilters,dashboardBounds(dashboardPeriod,false)); navigateTo('invoices'); }

function dashboardProductivity(bounds) {
  const rows = new Map();
  const ensure = (id,name) => {
    const key = id || `name:${name||'Sin asignar'}`;
    if(!rows.has(key)) rows.set(key,{id:key,name:name||'Sin asignar',consultations:0,revenue:0,attended:0,noShow:0});
    return rows.get(key);
  };
  (db.pets||[]).forEach(pet => (pet.history||[]).filter(entry=>entry.status==='closed'&&dashboardInRange(entry.date,bounds)).forEach(entry=>ensure(entry.vetUserId,entry.vet).consultations++));
  (db.appointments||[]).filter(item=>dashboardInRange(item.date,bounds)).forEach(item=>{
    const row=ensure(item.vetUserId,item.vet);
    if(item.status==='completed')row.attended++;
    if(item.status==='no_show')row.noShow++;
  });
  (db.invoices||[]).filter(invoice=>invoice.status!=='cancelled'&&dashboardInRange(invoice.date,bounds)).forEach(invoice=>{
    const professional=invoiceProfessional(invoice);
    ensure(professional.vetUserId,professional.vet).revenue += invoice.amountPaid===undefined?(invoice.status==='paid'?Number(invoice.total||0):0):Number(invoice.amountPaid||0);
  });
  return [...rows.values()].filter(row=>row.consultations||row.revenue||row.attended||row.noShow).sort((a,b)=>b.revenue-a.revenue||b.consultations-a.consultations);
}

function renderDashboard() {
  const today = localDateKey();
  const bounds = dashboardBounds(dashboardPeriod,false);
  const previousBounds = dashboardBounds(dashboardPeriod,true);
  const activePets = (db.pets||[]).filter(p=>!p.deceasedAt&&!petIsInactive(p));
  const invoices = (db.invoices||[]).filter(i=>dashboardInRange(i.date,bounds));
  const previousInvoices = (db.invoices||[]).filter(i=>dashboardInRange(i.date,previousBounds));
  const invoiceSummary = VetCareFinance.summarize(invoices);
  const previousSummary = VetCareFinance.summarize(previousInvoices);
  const pendingInv = invoices.filter(i=>i.status==='pending').length;
  const todayAppts = db.appointments.filter(a=>a.date===today).length;
  const todayGroom = db.groomingAppointments.filter(a=>a.date===today).length;
  const lowItems=db.inventory.filter(i=>invTotalStock(i)<=parseInt(i.minStock||0));
  const pendingRem = db.reminders.filter(r=>!r.completed).length;
  const productivity=dashboardProductivity(bounds);
  const days7 = Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return localDateKey(d);});
  const apptCounts = days7.map(d=>db.appointments.filter(a=>a.date===d).length+db.groomingAppointments.filter(a=>a.date===d).length);
  const dayLabels = days7.map(d=>new Date(d+'T12:00:00').toLocaleDateString('es-AR',{weekday:'short',day:'numeric'}));
  setTimeout(()=>{
    const canvas=document.getElementById('chartAppts');
    if(canvas&&window.Chart)canvas._ci=new Chart(canvas,{type:'bar',data:{labels:dayLabels,datasets:[{label:'Turnos',data:apptCounts,backgroundColor:'rgba(111,45,189,.75)',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}},x:{grid:{display:false}}}}});
  },80);
  return `<div class="page-header"><div class="title"><small>Gestión</small><h1>Panel general</h1></div><label>Período<select class="input" onchange="setDashboardPeriod(this.value)"><option value="month" ${dashboardPeriod==='month'?'selected':''}>Mes actual</option><option value="quarter" ${dashboardPeriod==='quarter'?'selected':''}>Últimos 3 meses</option><option value="year" ${dashboardPeriod==='year'?'selected':''}>Últimos 12 meses</option></select></label></div>
    <div class="grid-stats">
      <button class="stat-card stat-button" onclick="dashboardGo('pets')"><div class="stat-label">${icon('paw','ico-sm')} Pacientes activos</div><div class="stat-val">${activePets.length}</div></button>
      <button class="stat-card stat-button" onclick="dashboardGo('today')"><div class="stat-label">${icon('calendar','ico-sm')} Turnos hoy</div><div class="stat-val">${todayAppts+todayGroom}</div></button>
      <button class="stat-card stat-button" onclick="dashboardInvoices('paid')"><div class="stat-label">${icon('money','ico-sm')} Cobrado</div><div class="stat-val">$${invoiceSummary.paidTotal.toLocaleString('es-AR',{maximumFractionDigits:0})}</div><small>${dashboardDelta(invoiceSummary.paidTotal,previousSummary.paidTotal)} vs. período anterior</small></button>
      <button class="stat-card stat-button" onclick="dashboardInvoices('pending')"><div class="stat-label">${icon('receipt','ico-sm')} Pendiente</div><div class="stat-val">$${invoiceSummary.pendingTotal.toLocaleString('es-AR',{maximumFractionDigits:0})}</div><small>${pendingInv} recibos</small></button>
      <button class="stat-card stat-button" onclick="dashboardGo('reminders')"><div class="stat-label">${icon('bell','ico-sm')} Avisos pendientes</div><div class="stat-val">${pendingRem}</div></button>
      <button class="stat-card stat-button" onclick="dashboardGo('inventory')"><div class="stat-label">${icon('alert','ico-sm')} Stock bajo</div><div class="stat-val">${lowItems.length}</div></button>
    </div>
    <div class="dashboard-charts"><div class="card"><h3>Actividad · últimos 7 días</h3><div class="chart-wrap"><canvas id="chartAppts"></canvas></div></div><div class="card"><h3>Productividad por profesional</h3>${productivity.length?`<div class="table-wrap"><table><thead><tr><th>Profesional</th><th>Consultas</th><th>Atendidos</th><th>No asistió</th><th>Ingresos</th></tr></thead><tbody>${productivity.map(row=>`<tr><td>${escapeHtml(row.name)}</td><td>${row.consultations}</td><td>${row.attended}</td><td>${row.noShow}</td><td>${_fmtMoney(row.revenue)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Sin actividad en este período</div>'}</div></div>
    ${lowItems.length?`<div class="card dashboard-action-card" onclick="dashboardGo('inventory')"><h3>${icon('alert','ico-sm')} Stock bajo</h3><p>${lowItems.map(item=>`${escapeHtml(item.name)} (${invTotalStock(item)} u)`).join(' · ')}</p></div>`:''}`;
}
