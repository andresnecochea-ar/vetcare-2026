/* =====================================================================
   SELECTORES DE REGISTROS con buscador (reutilizables)
   ---------------------------------------------------------------------
   assocPicker  → selección múltiple con checkboxes (tutores de una mascota,
                  mascotas de un tutor).
   pickerOne    → selección única (el paciente de un turno, de un aviso, de un
                  recibo). Reemplaza a los <select> con una <option> por
                  paciente: con 4.734 pacientes eran imposibles de usar, y el
                  72% comparte nombre con otro (97 LOLA, 92 LUNA), así que el
                  nombre solo no alcanza para elegir bien.

   Los dos filtran sobre el mismo campo `search` y muestran como mucho
   PICKER_MAX_ROWS filas: renderizar la lista entera costaba 610 KB de HTML y
   10.491 nodos cada vez que se abría el modal.
   ===================================================================== */

// Con más de esto la lista deja de ayudar y sólo cuesta DOM. El contador de
// resultados le avisa a quien busca que hay más y conviene afinar el texto.
var PICKER_MAX_ROWS = 40;

// Estado temporal de los pickers mientras el modal esta abierto.
var _assocState = {};

function _pickerFilter(items, q, limit){
  var query = (q||'').toLowerCase().trim();
  var rows = query.length >= 2
    ? items.filter(function(it){ return (it.search||it.label||'').toLowerCase().indexOf(query) !== -1; })
    : [];
  return { total: rows.length, rows: rows.slice(0, limit || PICKER_MAX_ROWS) };
}

function _pickerMoreHTML(total, shown){
  if(total <= shown) return '';
  return '<div class="assoc-more">' + shown + ' de ' + total + ' · seguí escribiendo para afinar</div>';
}

// ---------------------------------------------------------------------
// Selección múltiple
// ---------------------------------------------------------------------

// Render inicial. items: [{id, label, search}]. selected: array de ids.
function assocPicker(containerId, items, selected){
  _assocState[containerId] = { items: items, selected: (selected||[]).slice() };
  return '<div class="assoc-picker" id="' + containerId + '">'
    + '<input type="text" class="input assoc-search" placeholder="Buscar por nombre, apellido o DNI..." '
    +   'oninput="assocFilter(\'' + containerId + '\', this.value)">'
    + '<div class="assoc-list" id="' + containerId + '-list">'
    +   _assocRows(containerId, '')
    + '</div></div>';
}

function _assocRows(containerId, q){
  var st = _assocState[containerId];
  if(!st) return '';
  // Los ya asociados van siempre arriba y no los corta el tope de filas: si no,
  // al abrir una ficha con tutores cargados podían no aparecer en la lista.
  var selected = st.items.filter(function(it){ return st.selected.indexOf(it.id) !== -1; });
  var pool = st.items.filter(function(it){ return st.selected.indexOf(it.id) === -1; });
  var found = _pickerFilter(pool, q, PICKER_MAX_ROWS);
  var rows = selected.concat(found.rows);
  if(rows.length === 0) return '<div class="assoc-empty">'+((q||'').trim().length<2?'Escribí al menos 2 caracteres':'Sin resultados')+'</div>';
  return rows.map(function(it){
    var on = st.selected.indexOf(it.id) !== -1;
    return '<label class="assoc-row">'
      + '<input type="checkbox" ' + (on?'checked':'') + ' '
      +   'onchange="assocToggle(\'' + containerId + '\', \'' + it.id + '\', this.checked)">'
      + '<span>' + escapeHtml(it.label) + '</span></label>';
  }).join('') + _pickerMoreHTML(found.total, found.rows.length);
}

function assocFilter(containerId, q){
  var list = document.getElementById(containerId + '-list');
  if(list) list.innerHTML = _assocRows(containerId, q);
}

function assocToggle(containerId, id, on){
  var st = _assocState[containerId];
  if(!st) return;
  var i = st.selected.indexOf(id);
  if(on && i === -1) st.selected.push(id);
  if(!on && i !== -1) st.selected.splice(i, 1);
}

function getAssocSelected(containerId){
  var st = _assocState[containerId];
  return st ? st.selected.slice() : [];
}

// ---------------------------------------------------------------------
// Selección única
// ---------------------------------------------------------------------

// items: [{id, label, sub, search}]. opts: {placeholder, emptyLabel, onChange}.
// El valor elegido se lee con getPickerOne(containerId).
function pickerOne(containerId, items, selectedId, opts){
  var options = opts || {};
  _assocState[containerId] = {
    items: items,
    selected: selectedId || '',
    placeholder: options.placeholder || 'Buscar por nombre, tutor o raza...',
    emptyLabel: options.emptyLabel || '',
    onChange: options.onChange || ''
  };
  return '<div class="picker-one" id="' + containerId + '">'
    + _pickerOneInner(containerId, '')
    + '</div>';
}

function _pickerOneInner(containerId, q){
  var st = _assocState[containerId];
  if(!st) return '';
  var chosen = st.selected ? st.items.find(function(it){ return it.id === st.selected; }) : null;

  // Con algo elegido no hace falta seguir mostrando la lista: alcanza con el
  // registro y un botón para cambiarlo.
  if(chosen){
    return '<div class="picker-one-chosen">'
      + '<div class="picker-one-chosen-main"><strong>' + escapeHtml(chosen.label) + '</strong>'
      + (chosen.sub ? '<small>' + escapeHtml(chosen.sub) + '</small>' : '') + '</div>'
      + '<button type="button" class="btn btn-sm" onclick="pickerOneClear(\'' + containerId + '\')">Cambiar</button>'
      + '</div>';
  }

  var found = _pickerFilter(st.items, q, PICKER_MAX_ROWS);
  var rows = found.rows.map(function(it){
    return '<button type="button" class="picker-one-row" onclick="pickerOneSelect(\'' + containerId + '\',\'' + it.id + '\')">'
      + '<strong>' + escapeHtml(it.label) + '</strong>'
      + (it.sub ? '<small>' + escapeHtml(it.sub) + '</small>' : '')
      + '</button>';
  }).join('');

  return '<input type="text" class="input picker-one-search" id="' + containerId + '-search"'
    + ' placeholder="' + escapeAttr(st.placeholder) + '" autocomplete="off"'
    + ' oninput="pickerOneFilter(\'' + containerId + '\', this.value)">'
    + '<div class="picker-one-list">'
    + (rows || '<div class="assoc-empty">' + escapeHtml(q ? 'Sin resultados' : (st.emptyLabel || 'Sin registros')) + '</div>')
    + '</div>'
    + _pickerMoreHTML(found.total, found.rows.length);
}

function pickerOneFilter(containerId, q){
  var st = _assocState[containerId];
  if(!st) return;
  var container = document.getElementById(containerId);
  var list = container ? container.querySelector('.picker-one-list') : null;
  if(!list) return;
  var found = _pickerFilter(st.items, q, PICKER_MAX_ROWS);
  list.innerHTML = found.rows.length
    ? found.rows.map(function(it){
        return '<button type="button" class="picker-one-row" onclick="pickerOneSelect(\'' + containerId + '\',\'' + it.id + '\')">'
          + '<strong>' + escapeHtml(it.label) + '</strong>'
          + (it.sub ? '<small>' + escapeHtml(it.sub) + '</small>' : '')
          + '</button>';
      }).join('')
    : '<div class="assoc-empty">Sin resultados</div>';
  var more = container.querySelector('.assoc-more');
  var moreHTML = _pickerMoreHTML(found.total, found.rows.length);
  if(more) more.outerHTML = moreHTML || '<span class="assoc-more-slot" hidden></span>';
  else {
    var slot = container.querySelector('.assoc-more-slot');
    if(slot && moreHTML) slot.outerHTML = moreHTML;
    else if(moreHTML) container.insertAdjacentHTML('beforeend', moreHTML);
  }
}

function _pickerOneRepaint(containerId){
  var container = document.getElementById(containerId);
  if(container) container.innerHTML = _pickerOneInner(containerId, '');
}

function pickerOneSelect(containerId, id){
  var st = _assocState[containerId];
  if(!st) return;
  st.selected = id;
  _pickerOneRepaint(containerId);
  if(st.onChange) new Function(st.onChange)();
}

function pickerOneClear(containerId){
  var st = _assocState[containerId];
  if(!st) return;
  st.selected = '';
  _pickerOneRepaint(containerId);
  var search = document.getElementById(containerId + '-search');
  if(search) search.focus();
  if(st.onChange) new Function(st.onChange)();
}

function getPickerOne(containerId){
  var st = _assocState[containerId];
  return st ? (st.selected || '') : '';
}

function setPickerOneItems(containerId, items, selectedId){
  var st = _assocState[containerId];
  if(!st) return;
  st.items = items;
  if(selectedId !== undefined) st.selected = selectedId || '';
  else if(st.selected && !items.some(function(it){ return it.id === st.selected; })) st.selected = '';
  _pickerOneRepaint(containerId);
}
