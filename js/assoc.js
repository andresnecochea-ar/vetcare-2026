/* =====================================================================
   SELECTOR DE ASOCIACIONES con buscador (reutilizable)
   Usado para asociar tutores a una mascota y mascotas a un tutor.
   ===================================================================== */

// Estado temporal del picker mientras el modal esta abierto.
var _assocState = {};

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
  q = (q||'').toLowerCase().trim();
  var rows = st.items.filter(function(it){
    if(!q) return true;
    return (it.search||it.label||'').toLowerCase().indexOf(q) !== -1;
  });
  if(rows.length === 0) return '<div class="assoc-empty">Sin resultados</div>';
  return rows.map(function(it){
    var on = st.selected.indexOf(it.id) !== -1;
    return '<label class="assoc-row">'
      + '<input type="checkbox" ' + (on?'checked':'') + ' '
      +   'onchange="assocToggle(\'' + containerId + '\', \'' + it.id + '\', this.checked)">'
      + '<span>' + escapeHtml(it.label) + '</span></label>';
  }).join('');
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
