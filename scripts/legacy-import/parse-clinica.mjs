// El memo DESCRIP de clinica.dbf concatena TODAS las visitas de un paciente en un
// solo texto, separadas por un marcador repetido:
//   *****     Fecha: DD/MM/YYYY  --  Atendido Por: NOMBRE   <contenido>
// El formato varía según la época:
//  - Registros viejos (~1998-2015): todo en una sola línea, el nombre del
//    veterinario está en un campo de ancho fijo relleno con espacios y el
//    contenido sigue inmediatamente después (sin salto de línea).
//  - Registros nuevos (~2016+): hay un salto de línea real después del nombre
//    y el texto libre ocupa una o más líneas hasta el próximo marcador.
// "Atendido Por:" es opcional: bastantes registros entre ~2011-2015 solo tienen
// "Fecha: DD/MM/YYYY --" seguido directo del texto, sin nombre de veterinario.
// Se captura en el grupo 4 para saber si hay que intentar extraer un nombre:
// cuando falta la etiqueta, el texto empieza pegado a "--" y NO hay que tratar
// la primera "palabra" como si fuera el veterinario.
// El "--" tampoco es constante: algunos marcadores son solo "Fecha: DD/MM/YYYY" pegado al texto.
const MARKER_RE = /\*{4,6}\s*Fecha:\s*(\d{2})\/(\d{2})\/(\d{4})\s*-{0,2}\s*(Atendido\s*Por:\s*)?/g;
const NAME_BOUNDARY_RE = /\n|[ \t]{3,}/;

function collapseSpaces(str) {
  return str
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

function toIsoDate(dd, mm, yyyy) {
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (year < 1980 || year > 2027 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${yyyy}-${mm}-${dd}`;
}

function classify(body) {
  const vacMatch = body.match(/^VACUNA:\s*([^-\n]+?)\s*-\s*(.*)$/is);
  if (vacMatch) {
    return { type: 'vacuna', title: `Vacuna: ${vacMatch[1].trim()}` };
  }
  const firstLine = body.split('\n')[0].trim();
  const title = firstLine.length > 0 ? firstLine.slice(0, 70) : 'Consulta';
  return { type: 'consulta', title };
}

/**
 * @param {string} text memo DESCRIP crudo de un registro de clinica.dbf
 * @returns {Array<{date: string, vet: string, body: string, type: string, title: string}>}
 */
export function parseClinicaMemo(text) {
  if (!text || !text.trim()) return [];
  const matches = [...text.matchAll(MARKER_RE)];
  if (matches.length === 0) {
    const body = collapseSpaces(text);
    if (!body) return [];
    return [{ date: '', vet: '', body, ...classify(body) }];
  }

  const entries = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const segStart = m.index + m[0].length;
    const segEnd = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const segment = text.slice(segStart, segEnd);
    const hasVetLabel = m[4] !== undefined;

    let vetRaw = '', bodyRaw = segment;
    if (hasVetLabel) {
      const boundary = segment.match(NAME_BOUNDARY_RE);
      if (boundary) {
        vetRaw = segment.slice(0, boundary.index);
        bodyRaw = segment.slice(boundary.index + boundary[0].length);
      } else {
        vetRaw = segment;
        bodyRaw = '';
      }
    }
    const vet = vetRaw.replace(/\s{2,}/g, ' ').trim();
    const body = collapseSpaces(bodyRaw);
    const date = toIsoDate(m[1], m[2], m[3]);
    if (!body) {
      // Visita registrada sin notas de texto: igual vale la pena conservar
      // la fecha/veterinario en vez de perder el rastro de la visita.
      if (!vet && !date) continue;
      entries.push({ date, vet, body: '', type: 'consulta', title: 'Visita registrada (sin notas)' });
      continue;
    }
    entries.push({ date, vet, body, ...classify(body) });
  }
  return entries;
}
