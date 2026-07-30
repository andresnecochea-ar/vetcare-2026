// ========================================
// [11f] RESULTADOS DE LABORATORIO
// Hemograma, bioquímica sanguínea y análisis de orina cargados dentro del
// estudio, comparados contra valores de referencia por especie.
// Los rangos son editables: cada laboratorio tiene los suyos.
// ========================================

// [min, max] por especie. Son valores orientativos de referencia, pensados
// para ajustarse desde Opciones a los del laboratorio de cada veterinaria.
const LAB_PANELS = {
  hemogram: {
    label: 'Hemograma',
    fields: [
      { key: 'hto', label: 'Hematocrito', unit: '%', dog: [37, 55], cat: [30, 45] },
      { key: 'hb', label: 'Hemoglobina', unit: 'g/dL', dog: [12, 18], cat: [8, 15] },
      { key: 'rbc', label: 'Eritrocitos', unit: 'M/µL', dog: [5.5, 8.5], cat: [5, 10] },
      { key: 'vcm', label: 'V.C.M.', unit: 'fL', dog: [60, 77], cat: [39, 55] },
      { key: 'hcm', label: 'Hb.C.M.', unit: 'pg', dog: [19.5, 24.5], cat: [12.5, 17.5] },
      { key: 'chcm', label: 'C.Hb.C.M.', unit: 'g/dL', dog: [32, 36], cat: [30, 36] },
      { key: 'retic', label: 'Reticulocitos', unit: '%', dog: [0, 1.5], cat: [0, 0.6] },
      { key: 'wbc', label: 'Leucocitos', unit: '/µL', dog: [6000, 17000], cat: [5500, 19500] },
      { key: 'band', label: 'Neutrófilos en banda', unit: '%', dog: [0, 3], cat: [0, 3] },
      { key: 'neutro', label: 'Neutrófilos', unit: '%', dog: [60, 77], cat: [35, 75] },
      { key: 'eosino', label: 'Eosinófilos', unit: '%', dog: [2, 10], cat: [2, 12] },
      { key: 'linfo', label: 'Linfocitos', unit: '%', dog: [12, 30], cat: [20, 55] },
      { key: 'mono', label: 'Monocitos', unit: '%', dog: [3, 10], cat: [1, 4] },
      { key: 'plaq', label: 'Plaquetas', unit: '/µL', dog: [200000, 500000], cat: [300000, 800000] },
      { key: 'otros', label: 'Otros', type: 'text' }
    ]
  },
  biochem: {
    label: 'Bioquímica sanguínea',
    fields: [
      { key: 'glucosa', label: 'Glucosa', unit: 'mg/dL', dog: [65, 118], cat: [70, 150] },
      { key: 'urea', label: 'Urea', unit: 'mg/dL', dog: [20, 56], cat: [20, 65] },
      { key: 'creatinina', label: 'Creatinina', unit: 'mg/dL', dog: [0.5, 1.5], cat: [0.8, 2] },
      { key: 'got', label: 'G.O.T. (AST)', unit: 'UI/L', dog: [15, 66], cat: [10, 100] },
      { key: 'gpt', label: 'G.P.T. (ALT)', unit: 'UI/L', dog: [10, 100], cat: [20, 107] },
      { key: 'fas', label: 'Fosfatasa alcalina', unit: 'UI/L', dog: [20, 150], cat: [10, 90] },
      { key: 'fosforo', label: 'Fósforo', unit: 'mg/dL', dog: [2.5, 6], cat: [3, 6.5] },
      { key: 'bilTotal', label: 'Bilirrubina total', unit: 'mg/dL', dog: [0.1, 0.5], cat: [0.1, 0.4] },
      { key: 'bilDirecta', label: 'Bilirrubina directa', unit: 'mg/dL', dog: [0, 0.2], cat: [0, 0.2] },
      { key: 'bilIndirecta', label: 'Bilirrubina indirecta', unit: 'mg/dL', dog: [0, 0.3], cat: [0, 0.3] },
      { key: 'proteinas', label: 'Proteínas totales', unit: 'g/dL', dog: [5.4, 7.5], cat: [5.7, 8] },
      { key: 'albumina', label: 'Albúmina', unit: 'g/dL', dog: [2.3, 3.8], cat: [2.3, 3.5] },
      { key: 'globulinas', label: 'Globulinas', unit: 'g/dL', dog: [2, 4], cat: [2.6, 5.1] },
      { key: 'colesterol', label: 'Colesterol', unit: 'mg/dL', dog: [125, 270], cat: [75, 220] },
      { key: 'otros', label: 'Otros', type: 'text' }
    ]
  },
  urine: {
    label: 'Análisis de orina',
    fields: [
      { key: 'color', label: 'Color', type: 'text' },
      { key: 'turbidez', label: 'Turbidez', type: 'text' },
      { key: 'densidad', label: 'Densidad', unit: '', dog: [1.015, 1.045], cat: [1.02, 1.06] },
      { key: 'ph', label: 'pH', unit: '', dog: [5.5, 7], cat: [5.5, 7] },
      { key: 'proteinas', label: 'Proteínas', type: 'cross' },
      { key: 'cetonicos', label: 'Cuerpos cetónicos', type: 'cross' },
      { key: 'glucosa', label: 'Glucosa', type: 'cross' },
      { key: 'hemoglobina', label: 'Hemoglobina', type: 'cross' },
      { key: 'urobilinogeno', label: 'Urobilinógeno', type: 'cross' },
      { key: 'bilirrubina', label: 'Bilirrubina', type: 'cross' },
      { key: 'leucocitos', label: 'Leucocitos', type: 'cross' },
      { key: 'otros', label: 'Otros (sedimento)', type: 'text' }
    ]
  }
};

const LAB_SPECIES = { dog: 'Canino', cat: 'Felino' };

// La especie viene como texto libre; sólo hay referencias para perro y gato.
function labSpecies(pet) {
  const value = String((pet && pet.species) || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/perr|canin|can\b|cachorr/.test(value)) return 'dog';
  if (/gat|felin|minin/.test(value)) return 'cat';
  return '';
}

function labNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

// Rango vigente: el de Opciones si fue editado, si no el orientativo.
function labRange(panelKey, fieldKey, species) {
  const field = (LAB_PANELS[panelKey]?.fields || []).find(item => item.key === fieldKey);
  if (!field || !species || field.type) return null;
  const override = db.settings?.labRanges?.[`${panelKey}.${fieldKey}.${species}`];
  if (Array.isArray(override) && override.length === 2) {
    const min = labNumber(override[0]);
    const max = labNumber(override[1]);
    if (min !== null && max !== null) return [min, max];
  }
  return field[species] || null;
}

// Compara cada valor cargado contra su rango y dice si está alto o bajo.
function labEvaluate(panelKey, values, species) {
  const panel = LAB_PANELS[panelKey];
  if (!panel) return [];
  const data = values || {};
  return panel.fields.map(field => {
    const raw = data[field.key];
    const filled = raw !== undefined && raw !== null && String(raw).trim() !== '';
    const range = labRange(panelKey, field.key, species);
    const numeric = field.type ? null : labNumber(raw);
    let status = '';
    if (filled && numeric !== null && range) {
      if (numeric < range[0]) status = 'low';
      else if (numeric > range[1]) status = 'high';
      else status = 'normal';
    }
    return {
      key: field.key,
      label: field.label,
      unit: field.unit || '',
      type: field.type || 'number',
      value: filled ? String(raw).trim() : '',
      filled,
      range,
      status
    };
  });
}

function labOutOfRange(study, species) {
  if (!study || !study.panel) return [];
  return labEvaluate(study.panel, study.results, species).filter(row => row.status === 'low' || row.status === 'high');
}

function labHasResults(study) {
  if (!study || !study.panel) return false;
  return Object.values(study.results || {}).some(value => String(value ?? '').trim() !== '');
}

function labRangeText(row) {
  if (!row.range) return '—';
  return `${row.range[0]} – ${row.range[1]}${row.unit ? ' ' + row.unit : ''}`;
}

function labStatusLabel(status) {
  return status === 'low' ? 'Bajo' : status === 'high' ? 'Alto' : status === 'normal' ? 'Normal' : '';
}

// Resumen corto para la lista de estudios y la línea de tiempo.
function labSummaryHTML(study, species) {
  if (!labHasResults(study)) return '';
  const out = labOutOfRange(study, species);
  if (!species) return '<span class="lab-chip">Resultados cargados</span>';
  return out.length
    ? `<span class="lab-chip is-out">${out.length} valor${out.length === 1 ? '' : 'es'} fuera de rango</span>`
    : '<span class="lab-chip is-ok">Todo dentro de rango</span>';
}

function labResultsTableHTML(pet, study) {
  const species = labSpecies(pet);
  const rows = labEvaluate(study.panel, study.results, species).filter(row => row.filled);
  if (!rows.length) return '<div class="empty-state">Sin valores cargados</div>';
  return `
    <div class="table-wrap lab-table">
      <table>
        <thead><tr><th>Determinación</th><th>Resultado</th><th>Referencia${species ? ' (' + LAB_SPECIES[species].toLowerCase() + ')' : ''}</th><th></th></tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr class="${row.status ? 'is-' + row.status : ''}">
              <th scope="row">${escapeHtml(row.label)}</th>
              <td>${escapeHtml(row.value)}${row.unit ? ' ' + escapeHtml(row.unit) : ''}</td>
              <td>${escapeHtml(labRangeText(row))}</td>
              <td>${row.status && row.status !== 'normal' ? `<span class="lab-flag is-${row.status}">${row.status === 'high' ? '▲' : '▼'} ${labStatusLabel(row.status)}</span>` : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${species ? '' : '<small style="color:var(--text-mute)">La especie del paciente no es canina ni felina: se guardan los valores pero no se comparan con referencias.</small>'}`;
}

// Punto de entrada desde la ficha: si ya hay valores se muestran, si no se
// carga directo.
function openStudyResults(petId, studyId) {
  const pet = db.pets.find(p => p.id === petId);
  const study = pet ? (pet.studies || []).find(s => s.id === studyId) : null;
  if (!study || !study.panel) return;
  if (!labHasResults(study)) {
    if (canEditClinical()) openLabResults(petId, studyId);
    else toast('El estudio todavía no tiene resultados cargados');
    return;
  }
  const panel = LAB_PANELS[study.panel];
  const out = labOutOfRange(study, labSpecies(pet));
  showModal(`
    <div class="modal-header">
      <div><div class="page-eyebrow">${escapeHtml(panel.label)}</div><h2>${escapeHtml(study.title || panel.label)} · ${escapeHtml(pet.name)}</h2></div>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="lab-result-head">
        <span>${study.date ? formatDate(study.date) : 'Sin fecha'}</span>
        ${labSummaryHTML(study, labSpecies(pet))}
      </div>
      ${labResultsTableHTML(pet, study)}
      ${out.length ? `<p class="lab-out-summary">Fuera de rango: ${out.map(row => escapeHtml(row.label)).join(', ')}.</p>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="printLabResults('${petId}','${studyId}')">Imprimir</button>
      ${canEditClinical() ? `<button class="btn btn-primary" onclick="openLabResults('${petId}','${studyId}')">Editar valores</button>` : ''}
      <button class="btn" onclick="closeModal()">Cerrar</button>
    </div>
  `, true);
}

function openLabResults(petId, studyId) {
  if (!canEditClinical()) { toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  const study = pet ? (pet.studies || []).find(s => s.id === studyId) : null;
  if (!study) return;
  if (!study.panel) { toast('Elegí primero el tipo de panel en el estudio', 'error'); return; }
  const panel = LAB_PANELS[study.panel];
  const species = labSpecies(pet);
  const rows = labEvaluate(study.panel, study.results, species);

  showModal(`
    <div class="modal-header">
      <div><div class="page-eyebrow">${escapeHtml(panel.label)}</div><h2>${escapeHtml(study.title || panel.label)} · ${escapeHtml(pet.name)}</h2></div>
      <button class="close-btn" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="lab-form">
        ${rows.map(row => `
          <div class="lab-field">
            <label for="lab-${row.key}">${escapeHtml(row.label)}${row.unit ? ` <small>(${escapeHtml(row.unit)})</small>` : ''}</label>
            <input type="${row.type === 'number' ? 'text' : 'text'}" id="lab-${row.key}" value="${escapeAttr(row.value)}"
              placeholder="${row.type === 'cross' ? '+ / ++ / +++' : row.range ? labRangeText(row) : ''}"
              oninput="previewLabField('${study.panel}','${row.key}','${species}')">
            <small class="lab-hint" id="lab-hint-${row.key}">${row.range ? 'Ref. ' + escapeHtml(labRangeText(row)) : ''}</small>
          </div>`).join('')}
      </div>
      <small style="color:var(--text-mute)">Los valores de referencia son orientativos y se ajustan desde Opciones.</small>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveLabResults('${petId}','${studyId}')">Guardar resultados</button>
    </div>
  `, true);
  rows.forEach(row => previewLabField(study.panel, row.key, species));
}

// Marca el campo mientras se escribe, para no tener que guardar y volver.
function previewLabField(panelKey, fieldKey, species) {
  const input = document.getElementById('lab-' + fieldKey);
  const hint = document.getElementById('lab-hint-' + fieldKey);
  if (!input || !hint) return;
  const [row] = labEvaluate(panelKey, { [fieldKey]: input.value }, species).filter(item => item.key === fieldKey);
  input.classList.remove('is-low', 'is-high', 'is-normal');
  if (row.status) input.classList.add('is-' + row.status);
  if (!row.range) return;
  hint.textContent = row.status && row.status !== 'normal'
    ? `${labStatusLabel(row.status)} · ref. ${labRangeText(row)}`
    : `Ref. ${labRangeText(row)}`;
  hint.classList.toggle('is-out', row.status === 'low' || row.status === 'high');
}

function saveLabResults(petId, studyId) {
  if (!canEditClinical()) { toast('Tu rol no permite modificar información clínica'); return; }
  const pet = db.pets.find(p => p.id === petId);
  const study = pet ? (pet.studies || []).find(s => s.id === studyId) : null;
  if (!study || !LAB_PANELS[study.panel]) return;
  const values = {};
  LAB_PANELS[study.panel].fields.forEach(field => {
    const value = document.getElementById('lab-' + field.key)?.value.trim() || '';
    if (value) values[field.key] = value;
  });
  study.results = values;
  // Cargar el resultado cierra el pedido pendiente.
  if (Object.keys(values).length && study.status === 'requested') study.status = 'received';
  saveDB('Resultados guardados');
  closeModal();
  openPetDetail(petId);
}

function printLabResults(petId, studyId) {
  const pet = db.pets.find(p => p.id === petId);
  const study = pet ? (pet.studies || []).find(s => s.id === studyId) : null;
  if (!study || !study.panel) return;
  const species = labSpecies(pet);
  const rows = labEvaluate(study.panel, study.results, species).filter(row => row.filled);
  if (!rows.length) { toast('No hay valores para imprimir'); return; }
  printDocument(LAB_PANELS[study.panel].label,
    documentPatientMeta(pet)
    + (study.date ? '<p>Fecha del estudio: ' + formatDate(study.date) + '</p>' : '')
    + '<table><thead><tr><th>Determinación</th><th>Resultado</th><th>Referencia</th><th></th></tr></thead><tbody>'
    + rows.map(row => '<tr>'
      + '<td>' + escapeHtml(row.label) + '</td>'
      + '<td>' + escapeHtml(row.value) + (row.unit ? ' ' + escapeHtml(row.unit) : '') + '</td>'
      + '<td>' + escapeHtml(labRangeText(row)) + '</td>'
      + '<td>' + (row.status && row.status !== 'normal' ? labStatusLabel(row.status).toUpperCase() : '') + '</td>'
      + '</tr>').join('')
    + '</tbody></table>'
    + '<div class="sign">Profesional actuante</div>');
}

// ----------------------------------------
// Valores de referencia editables
// ----------------------------------------

function openLabRanges() {
  const panels = Object.entries(LAB_PANELS);
  const admin = canManageSettings();
  showModal(`
    <div class="modal-header"><h3>Valores de referencia de laboratorio</h3><button class="close-btn" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <p style="color:var(--text-soft);font-size:var(--fs-sm);margin-bottom:12px">Se usan para marcar resultados altos y bajos. Los que vienen cargados son orientativos: ajustalos a los de tu laboratorio.</p>
      ${panels.map(([panelKey, panel]) => {
        const numeric = panel.fields.filter(field => !field.type);
        if (!numeric.length) return '';
        return `
          <details class="lab-ranges">
            <summary>${escapeHtml(panel.label)}</summary>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Determinación</th><th>Canino</th><th>Felino</th></tr></thead>
                <tbody>
                  ${numeric.map(field => ['dog', 'cat'].reduce((row, species) => {
                    const range = labRange(panelKey, field.key, species) || ['', ''];
                    return row + `<td class="lab-range-cell">
                      <input type="text" inputmode="decimal" value="${escapeAttr(String(range[0]))}" aria-label="Mínimo ${escapeAttr(field.label)} ${LAB_SPECIES[species]}" ${admin ? '' : 'disabled'} onchange="saveLabRange('${panelKey}','${field.key}','${species}',0,this.value)">
                      <span>–</span>
                      <input type="text" inputmode="decimal" value="${escapeAttr(String(range[1]))}" aria-label="Máximo ${escapeAttr(field.label)} ${LAB_SPECIES[species]}" ${admin ? '' : 'disabled'} onchange="saveLabRange('${panelKey}','${field.key}','${species}',1,this.value)">
                    </td>`;
                  }, `<tr><th scope="row">${escapeHtml(field.label)}${field.unit ? ` <small>${escapeHtml(field.unit)}</small>` : ''}</th>`) + '</tr>').join('')}
                </tbody>
              </table>
            </div>
          </details>`;
      }).join('')}
    </div>
    <div class="modal-footer">
      ${admin ? '<button class="btn" onclick="resetLabRanges()">Restablecer originales</button>' : '<small style="color:var(--text-mute)">Solo una persona administradora puede modificarlos.</small>'}
      <button class="btn btn-primary" onclick="closeModal()">Listo</button>
    </div>
  `, true);
}

function saveLabRange(panelKey, fieldKey, species, index, value) {
  if (!canManageSettings()) { toast('Tu rol no permite cambiar la configuración'); return; }
  if (!db.settings) db.settings = {};
  if (!db.settings.labRanges) db.settings.labRanges = {};
  const key = `${panelKey}.${fieldKey}.${species}`;
  const current = labRange(panelKey, fieldKey, species) || ['', ''];
  const next = [...current];
  next[index] = labNumber(value);
  if (next[0] === null || next[1] === null) { toast('Cargá un número válido', 'error'); return; }
  if (next[0] > next[1]) { toast('El mínimo no puede ser mayor que el máximo', 'error'); return; }
  db.settings.labRanges[key] = next;
  saveDB('Valor de referencia actualizado');
}

function resetLabRanges() {
  if (!canManageSettings()) { toast('Tu rol no permite cambiar la configuración'); return; }
  showConfirm('¿Restablecer todos los valores de referencia originales?', () => {
    if (db.settings) delete db.settings.labRanges;
    saveDB('Valores de referencia restablecidos');
    closeModal();
    openLabRanges();
  });
}

// Superficie mínima para las pruebas automatizadas del laboratorio.
globalThis.VetCareLabs = {
  species: labSpecies,
  evaluate: labEvaluate,
  outOfRange: labOutOfRange,
  hasResults: labHasResults,
  panels: LAB_PANELS
};
