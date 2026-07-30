function renderBackup() {
  const sizeKB = (JSON.stringify(db).length / 1024).toFixed(1);
  const turnos = db.appointments.length + db.groomingAppointments.length;
  const sync = getSyncStatus();
  return `
    <div class="page-header">
      <div class="title"><small>Seguridad de datos</small><h1>Respaldo y restauración</h1></div>
    </div>
    <div class="card">
      <h3>Estado actual</h3>
      <p style="margin-bottom:8px"><span class="sync-summary sync-summary-${sync.state}" id="syncSummary">${escapeHtml(sync.label)}</span></p>
      <p id="syncSummaryDetail" style="color:var(--text-soft);margin-bottom:6px">${escapeHtml(sync.detail)}</p>
      <p id="syncSummaryLast" style="color:var(--text-mute);font-size:var(--fs-xs);margin-bottom:12px">${sync.lastSyncAt?'Última sincronización confirmada: '+escapeHtml(new Date(sync.lastSyncAt).toLocaleString('es-AR')):'Todavía no hay una sincronización confirmada.'}</p>
      ${(sync.state==='error'||sync.state==='offline')?'<button class="btn btn-sm" onclick="retrySync()">Reintentar ahora</button>':''}
      ${sync.state==='conflict'?'<button class="btn btn-sm btn-danger" onclick="handleSyncStatusAction()">Revisar conflicto</button>':''}
      <p style="color:var(--text-soft);margin-top:6px">${db.pets.length} pacientes · ${db.owners.length} tutores · ${turnos} turnos · ${db.reminders.length} avisos · <strong>${sizeKB} KB</strong></p>
      <p style="color:var(--text-mute);font-size:var(--fs-xs);margin-top:6px">La copia local se conserva incluso si se interrumpe Internet. El indicador superior confirma cuándo los cambios llegaron al servidor.</p>
    </div>

    <h3 style="margin-top:24px;margin-bottom:8px">Descargar copia local</h3>
    <p style="color:var(--text-soft);font-size:var(--fs-sm);margin-bottom:12px">Guardá un archivo <strong>.vetcare</strong> en tu computadora como resguardo extra.</p>
    <div class="backup-options">
      <div class="backup-card">
        <h4>Respaldo completo</h4>
        <p>Todos los datos, incluidas las fotos de mascotas e imágenes de estudios.</p>
        <button class="btn btn-primary" onclick="exportVetcare('full')">${icon('download','ico-sm')} Descargar todo</button>
      </div>
      <div class="backup-card">
        <h4>Liviano (sin imágenes)</h4>
        <p>Todos los datos excepto las fotos. Archivo más chico, ideal para enviar por mail.</p>
        <button class="btn" onclick="exportVetcare('lite')">${icon('download','ico-sm')} Descargar</button>
      </div>
    </div>

    <h3 style="margin-top:24px;margin-bottom:8px">Restaurar desde una copia</h3>
    <p style="color:var(--text-soft);font-size:var(--fs-sm);margin-bottom:12px">Cargá un archivo .vetcare. Se <strong>agregan</strong> los registros que falten; no se borra ni pisa nada de lo que ya está en el sistema.</p>
    <div class="card">
      <input type="file" id="restoreFile" accept=".vetcare,.json">
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="restoreBackup('merge')">Cargar y fusionar</button>
      </div>
      <p style="color:var(--text-mute);font-size:var(--fs-xs);margin-top:10px">Como los datos son compartidos, lo restaurado queda disponible para todo el equipo.</p>
    </div>
  `;
}

function exportBackup(type) {
  let data;
  const meta = { exportDate: new Date().toISOString(), type, version: 1 };
  switch (type) {
    case 'full':
      data = { ...db, _meta: meta };
      break;
    case 'basic':
      data = { pets: db.pets.map(p => ({...p, history: [], images: [], vaccines: p.vaccines||[], dewormings: p.dewormings||[]})), owners: db.owners, _meta: meta };
      break;
    case 'agenda':
      data = { appointments: db.appointments, groomingAppointments: db.groomingAppointments, reminders: db.reminders, _meta: meta };
      break;
    case 'lite':
      data = {
        ...db,
        pets: db.pets.map(p => ({ ...p, photo: '', images: [] })),
        _meta: meta
      };
      break;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vetcare-${type}-${localDateKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Respaldo descargado');
}

function restoreBackup(mode) {
  const file = document.getElementById('restoreFile').files[0];
  if (!file) { toast('Seleccioná un archivo'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      delete imported._meta;
      let added = 0;
      // Siempre fusiona por id: agrega lo que falta, nunca borra ni pisa.
      ['pets','owners','appointments','groomingAppointments','reminders','inventory','invoices'].forEach(key => {
        if (imported[key] && Array.isArray(imported[key])) {
          db[key] = db[key] || [];
          const existing = new Set(db[key].map(x=>x.id));
          imported[key].forEach(item => {
            if (item && item.id && !existing.has(item.id)) { db[key].push(item); added++; }
          });
        }
      });
      saveDB(added>0 ? ('Respaldo fusionado: '+added+' registros nuevos') : '');
      render();
      if(added===0)toast('No había registros nuevos para agregar');
    } catch (err) {
      toast('Archivo inválido');
    }
  };
  reader.readAsText(file);
}

function wipeAllData() {
  showConfirm('¿BORRAR TODOS LOS DATOS? Esta acción es irreversible y no se puede deshacer.', () => {
    db = JSON.parse(JSON.stringify(defaultData));
    saveDB('Todos los datos eliminados'); render();
  });
}

// ========================================
// [22] MODAL HELPERS — showModal, closeModal
// ========================================
