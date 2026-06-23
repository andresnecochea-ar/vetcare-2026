function renderBackup() {
  const sizeKB = (JSON.stringify(db).length / 1024).toFixed(1);
  const turnos = db.appointments.length + db.groomingAppointments.length;
  return `
    <div class="page-header">
      <div class="title"><small>Seguridad de datos</small><h1>Respaldo y restauración</h1></div>
    </div>
    <div class="card">
      <h3>Estado actual</h3>
      <p style="margin-bottom:12px"><span style="color:var(--color-mint-hover);font-weight:var(--fw-bold)">● Datos guardados en la nube</span> — se sincronizan automáticamente en Cloudflare.</p>
      <p style="color:var(--text-soft);margin-top:6px">${db.pets.length} pacientes · ${db.owners.length} tutores · ${turnos} turnos · ${db.reminders.length} avisos · <strong>${sizeKB} KB</strong></p>
      <p style="color:var(--text-mute);font-size:var(--fs-xs);margin-top:6px">Tus datos están seguros en el servidor. La copia local es un respaldo adicional opcional que podés guardar en tu computadora.</p>
    </div>

    <h3 style="margin-top:24px;margin-bottom:8px">Descargar copia local</h3>
    <p style="color:var(--text-soft);font-size:var(--fs-sm);margin-bottom:12px">Guardá un archivo <strong>.vetcare</strong> en tu computadora como resguardo extra.</p>
    <div class="backup-options">
      <div class="backup-card">
        <h4>Respaldo completo</h4>
        <p>Todos los datos, incluidas las fotos de mascotas e imágenes de estudios.</p>
        <button class="btn btn-primary" onclick="exportVetcare('full')">↓ Descargar todo</button>
      </div>
      <div class="backup-card">
        <h4>Liviano (sin imágenes)</h4>
        <p>Todos los datos excepto las fotos. Archivo más chico, ideal para enviar por mail.</p>
        <button class="btn" onclick="exportVetcare('lite')">↓ Descargar</button>
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
      data = { pets: db.pets.map(p => ({...p, history: [], images: [], vaccines: p.vaccines||[]})), owners: db.owners, _meta: meta };
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
  a.download = `vetcare-${type}-${new Date().toISOString().split('T')[0]}.json`;
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
      saveDB();
      render();
      toast(added>0 ? ('Respaldo fusionado: '+added+' registros nuevos') : 'No había registros nuevos para agregar');
    } catch (err) {
      toast('Archivo inválido');
    }
  };
  reader.readAsText(file);
}

function wipeAllData() {
  showConfirm('¿BORRAR TODOS LOS DATOS? Esta acción es irreversible y no se puede deshacer.', () => {
    db = JSON.parse(JSON.stringify(defaultData));
    saveDB(); render(); toast('Todos los datos eliminados', 'error');
  });
}

// ========================================
// [22] MODAL HELPERS — showModal, closeModal
// ========================================
