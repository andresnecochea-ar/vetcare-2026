// ========================================
// [11g] DOCUMENTOS CLÍNICOS Y PLANTILLAS
// Encabezado único para todo lo que se imprime, certificado médico con
// texto configurable y plantillas de examen físico por tipo de atención.
// ========================================

// Un solo lugar del que salen los datos que encabezan los impresos.
function clinicInfo() {
  const s = db.settings || {};
  return {
    name: s.clinicName || db.clinicName || 'VetCare',
    address: s.clinicAddress || s.receiptAddress || '',
    phone: s.clinicPhone || s.receiptPhone || '',
    email: s.clinicEmail || '',
    license: s.clinicLicense || '',
    taxId: s.receiptTaxId || ''
  };
}

function clinicContactLine() {
  const info = clinicInfo();
  return [info.address, info.phone, info.email, info.license ? 'Mat. ' + info.license : '']
    .filter(Boolean).map(escapeHtml).join(' · ');
}

function documentPrintHead(title) {
  return '<html><head><title>' + escapeHtml(title) + '</title><meta charset="utf-8"><style>'
    + 'body{font-family:Georgia,serif;max-width:760px;margin:28px auto;padding:0 20px;color:#222}'
    + '.doc-head{border-bottom:2px solid #6F2DBD;padding-bottom:10px;margin-bottom:16px}'
    + '.doc-head h1{font-size:1.35rem;margin:0}'
    + '.doc-head .clinic{color:#666;font-size:.85rem;margin-top:4px}'
    + 'h2{font-size:1rem;margin:18px 0 6px;color:#6F2DBD}'
    + '.meta{background:#f7f2fb;padding:12px;border-radius:6px;font-size:.9rem;line-height:1.6}'
    + 'table{width:100%;border-collapse:collapse;margin-top:10px;font-size:.9rem}'
    + 'th,td{border-bottom:1px solid #ddd;padding:7px 6px;text-align:left}'
    + 'th{color:#666;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em}'
    + '.vitals{display:flex;gap:20px;background:#f1e7fb;padding:12px;border-radius:6px;margin:12px 0}'
    + '.vit{text-align:center}.vit strong{display:block;font-size:1.2rem}.vit small{color:#666;font-size:.8rem}'
    + 'p{margin:6px 0;line-height:1.7}'
    + '.body-text{white-space:pre-line;line-height:1.8;margin-top:12px}'
    + '.sign{margin-top:52px;border-top:1px solid #888;width:260px;padding-top:6px;font-size:.85rem}'
    + '@media print{button{display:none}}</style></head><body>'
    + '<div class="doc-head"><h1>' + escapeHtml(clinicInfo().name) + ' — ' + escapeHtml(title) + '</h1>'
    + (clinicContactLine() ? '<div class="clinic">' + clinicContactLine() + '</div>' : '')
    + '</div>';
}

function documentPatientMeta(pet) {
  const owner = (pet.ownerIds || []).map(id => db.owners.find(o => o.id === id)).find(Boolean);
  return '<div class="meta">Paciente: <strong>' + escapeHtml(pet.name) + '</strong>'
    + ' · ' + escapeHtml(pet.species || '—') + ' ' + escapeHtml(pet.breed || '')
    + (pet.sex ? ' · ' + escapeHtml(pet.sex) : '')
    + (pet.birthdate ? ' · Nac. ' + formatDate(pet.birthdate) : '')
    + (pet.microchip ? '<br>Microchip: ' + escapeHtml(pet.microchip) : '')
    + '<br>Tutor: ' + (owner ? escapeHtml(owner.name) : '—')
    + '</div>';
}

// Abre la ventana de impresión con el documento ya armado.
function printDocument(title, bodyHtml) {
  const w = window.open('', '_blank');
  if (!w) { toast('El navegador bloqueó la ventana de impresión', 'error'); return null; }
  w.document.write(documentPrintHead(title) + bodyHtml
    + '<br><button onclick="window.print()">Imprimir</button></body></html>');
  w.document.close();
  return w;
}

// ----------------------------------------
// Certificado médico
// ----------------------------------------

var DEFAULT_CERTIFICATE_TEMPLATE = 'Por medio del presente certifico que el paciente [paciente], de especie [especie] y raza [raza], propiedad de [tutor], fue examinado en la fecha [fecha] y se encuentra clínicamente apto.\n\nSe extiende el presente certificado a pedido del interesado.';

function certificateTemplate() {
  const stored = db.settings && db.settings.certificateTemplate;
  return stored && stored.trim() ? stored : DEFAULT_CERTIFICATE_TEMPLATE;
}

// Reemplaza los marcadores por los datos reales del paciente y la consulta.
function fillCertificate(pet, encounter) {
  const owner = (pet.ownerIds || []).map(id => db.owners.find(o => o.id === id)).find(Boolean);
  const values = {
    paciente: pet.name || '',
    especie: pet.species || '',
    raza: pet.breed || '',
    tutor: owner ? owner.name : '',
    fecha: formatDate(encounter?.date || localDateKey()),
    profesional: encounter?.vet || '',
    clinica: clinicInfo().name,
    diagnostico: encounter?.diagnosis || '',
    tratamiento: encounter?.treatment || ''
  };
  return certificateTemplate().replace(/\[(\w+)\]/gi, (match, key) => {
    const value = values[key.toLowerCase()];
    return value === undefined ? match : value;
  });
}

function openMedicalCertificate(petId, encounterId) {
  const pet = db.pets.find(p => p.id === petId);
  if (!pet) return;
  const encounter = encounterId ? (pet.history || []).find(h => h.id === encounterId) : null;
  showModal(`
    <div class="modal-header">
      <div><div class="page-eyebrow">Documento cl&iacute;nico</div><h2>Certificado m&eacute;dico de ${escapeHtml(pet.name)}</h2></div>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label for="certText">Texto del certificado</label>
        <textarea id="certText" rows="9">${escapeHtml(fillCertificate(pet, encounter))}</textarea>
        <small style="color:var(--text-mute)">Pod&eacute;s editarlo antes de imprimir. El texto base se configura en Opciones.</small>
      </div>
      <div class="form-group">
        <label for="certVet">Profesional que firma</label>
        <input type="text" id="certVet" value="${escapeAttr(encounter?.vet || '')}" placeholder="Nombre y matr&iacute;cula">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="printMedicalCertificate('${petId}')">Imprimir</button>
    </div>
  `, true);
}

function printMedicalCertificate(petId) {
  const pet = db.pets.find(p => p.id === petId);
  if (!pet) return;
  const text = document.getElementById('certText')?.value || '';
  const vet = document.getElementById('certVet')?.value.trim() || '';
  printDocument('Certificado médico',
    documentPatientMeta(pet)
    + '<div class="body-text">' + escapeHtml(text) + '</div>'
    + '<p style="margin-top:24px">Fecha de emisión: ' + formatDate(localDateKey()) + '</p>'
    + '<div class="sign">' + escapeHtml(vet || 'Profesional actuante') + '</div>');
  closeModal();
}

// ----------------------------------------
// Plantillas de examen físico
// ----------------------------------------

var DEFAULT_EXAM_TEMPLATES = [
  {
    id: 'general',
    name: 'Examen general',
    text: 'Actitud / sensorio:\nMucosas:\nTiempo de llenado capilar:\nGanglios linfáticos:\nAuscultación cardíaca:\nAuscultación pulmonar:\nPalpación abdominal:\nPiel y pelaje:\nHidratación:\nEstado corporal (1-9):'
  },
  {
    id: 'postquirurgico',
    name: 'Control post-quirúrgico',
    text: 'Herida quirúrgica:\nPuntos:\nDolor a la palpación:\nSecreción:\nApetito:\nDeposiciones y micción:\nActitud general:'
  },
  {
    id: 'sano',
    name: 'Control sano / vacunación',
    text: 'Peso:\nEstado general:\nMucosas:\nAuscultación:\nDesparasitación al día:\nPlan vacunal:\nObservaciones del tutor:'
  }
];

function examTemplates() {
  const stored = db.settings && db.settings.examTemplates;
  return Array.isArray(stored) && stored.length ? stored : DEFAULT_EXAM_TEMPLATES;
}

function examTemplateOptionsHTML() {
  return examTemplates()
    .map(template => `<option value="${escapeAttr(template.id)}">${escapeHtml(template.name)}</option>`)
    .join('');
}

// Inserta la plantilla en el examen físico sin pisar lo ya escrito.
function applyExamTemplate() {
  const select = document.getElementById('hExamTemplate');
  const field = document.getElementById('hExam');
  if (!select || !field) return;
  const template = examTemplates().find(item => item.id === select.value);
  if (!template) { toast('Elegí una plantilla', 'error'); return; }
  const current = field.value.trim();
  field.value = current ? `${current}\n\n${template.text}` : template.text;
  field.focus();
  toast('Plantilla insertada');
}

function openExamTemplates() {
  const templates = examTemplates();
  const admin = canManageSettings();
  showModal(`
    <div class="modal-header"><h3>Plantillas de examen f&iacute;sico</h3><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <p style="color:var(--text-soft);font-size:var(--fs-sm);margin-bottom:12px">Se insertan en el examen f&iacute;sico de la consulta. Sirven para no olvidar nada y para que la historia quede pareja entre profesionales.</p>
      ${templates.map(template => `
        <div class="exam-template">
          <div class="exam-template-head">
            <strong>${escapeHtml(template.name)}</strong>
            ${admin ? `<div>
              <button class="btn btn-sm" onclick="openExamTemplateForm('${escapeAttr(template.id)}')">Editar</button>
              <button class="btn btn-sm btn-danger" onclick="deleteExamTemplate('${escapeAttr(template.id)}')" title="Eliminar">${iconX()}</button>
            </div>` : ''}
          </div>
          <pre>${escapeHtml(template.text)}</pre>
        </div>`).join('')}
    </div>
    <div class="modal-footer">
      ${admin ? '<button class="btn" onclick="resetExamTemplates()">Restablecer originales</button><button class="btn btn-primary" onclick="openExamTemplateForm()">+ Nueva plantilla</button>' : '<small style="color:var(--text-mute)">Solo una persona administradora puede modificarlas.</small>'}
      <button class="btn" onclick="closeModal()">Cerrar</button>
    </div>
  `, true);
}

function openExamTemplateForm(id) {
  if (!canManageSettings()) { toast('Tu rol no permite cambiar la configuración'); return; }
  const template = id ? examTemplates().find(item => item.id === id) : null;
  showModal(`
    <div class="modal-header"><h3>${id ? 'Editar' : 'Nueva'} plantilla</h3><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label for="tplName">Nombre</label><input type="text" id="tplName" value="${escapeAttr(template?.name || '')}" placeholder="Ej: Control cardiol&oacute;gico"></div>
      <div class="form-group"><label for="tplText">Contenido</label><textarea id="tplText" rows="10" placeholder="Una l&iacute;nea por dato a completar">${escapeHtml(template?.text || '')}</textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="openExamTemplates()">Volver</button>
      <button class="btn btn-primary" onclick="saveExamTemplate(${id ? `'${escapeAttr(id)}'` : ''})">Guardar</button>
    </div>
  `, true);
}

function saveExamTemplate(id) {
  if (!canManageSettings()) { toast('Tu rol no permite cambiar la configuración'); return; }
  const name = document.getElementById('tplName').value.trim();
  const text = document.getElementById('tplText').value;
  if (!name || !text.trim()) { toast('Completá nombre y contenido', 'error'); return; }
  if (!db.settings) db.settings = {};
  const list = [...examTemplates()];
  if (id) {
    const index = list.findIndex(item => item.id === id);
    if (index > -1) list[index] = { ...list[index], name, text };
  } else {
    list.push({ id: uid(), name, text });
  }
  db.settings.examTemplates = list;
  saveDB('Plantilla guardada');
  openExamTemplates();
}

function deleteExamTemplate(id) {
  if (!canManageSettings()) { toast('Tu rol no permite cambiar la configuración'); return; }
  showConfirm('¿Eliminar esta plantilla?', () => {
    db.settings.examTemplates = examTemplates().filter(item => item.id !== id);
    saveDB('Plantilla eliminada');
    openExamTemplates();
  });
}

function resetExamTemplates() {
  if (!canManageSettings()) { toast('Tu rol no permite cambiar la configuración'); return; }
  showConfirm('¿Restablecer las plantillas originales?', () => {
    if (db.settings) delete db.settings.examTemplates;
    saveDB('Plantillas restablecidas');
    openExamTemplates();
  });
}

// ----------------------------------------
// Texto base del certificado, en Opciones
// ----------------------------------------

function openCertificateTemplate() {
  const admin = canManageSettings();
  showModal(`
    <div class="modal-header"><h3>Texto del certificado m&eacute;dico</h3><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <p style="color:var(--text-soft);font-size:var(--fs-sm)">Us&aacute; <strong>[paciente]</strong>, <strong>[especie]</strong>, <strong>[raza]</strong>, <strong>[tutor]</strong>, <strong>[fecha]</strong>, <strong>[profesional]</strong>, <strong>[diagnostico]</strong> y <strong>[tratamiento]</strong>: se reemplazan solos al emitirlo.</p>
      <textarea id="certTemplate" rows="10" class="input" style="margin-top:10px" ${admin ? '' : 'disabled'}>${escapeHtml(certificateTemplate())}</textarea>
    </div>
    <div class="modal-footer">
      ${admin ? '<button class="btn" onclick="resetCertificateTemplate()">Restablecer original</button><button class="btn btn-primary" onclick="saveCertificateTemplate()">Guardar</button>' : '<button class="btn btn-primary" onclick="closeModal()">Cerrar</button>'}
    </div>
  `, true);
}

function saveCertificateTemplate() {
  if (!canManageSettings()) { toast('Tu rol no permite cambiar la configuración'); return; }
  const text = document.getElementById('certTemplate').value;
  if (!text.trim()) { toast('El texto no puede quedar vacío', 'error'); return; }
  if (!db.settings) db.settings = {};
  db.settings.certificateTemplate = text;
  saveDB('Texto del certificado actualizado');
  closeModal();
}

function resetCertificateTemplate() {
  if (!canManageSettings()) { toast('Tu rol no permite cambiar la configuración'); return; }
  if (db.settings) delete db.settings.certificateTemplate;
  saveDB('Texto del certificado restablecido');
  closeModal();
  openCertificateTemplate();
}

// Superficie mínima para las pruebas automatizadas de documentos y plantillas.
globalThis.VetCareDocuments = {
  clinicInfo,
  fillCertificate,
  templates: examTemplates,
  defaultCertificate: () => DEFAULT_CERTIFICATE_TEMPLATE
};
