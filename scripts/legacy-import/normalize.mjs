const SPECIES_MAP = {
  FELINO: 'Gato',
  CANINO: 'Perro',
  CANINI: 'Perro',
  CANNO: 'Perro',
  CANINA: 'Perro',
  OTRA: 'Otro',
};

export function normalizeSpecies(raw) {
  const clean = (raw || '').trim().toUpperCase().replace(/\s+.*$/, ''); // corta basura tipo "FELINO  !!"
  return SPECIES_MAP[clean] || (clean ? titleCase(raw.trim()) : '');
}

export function normalizeSex(raw) {
  const v = (raw || '').trim().toUpperCase();
  if (v === 'H') return 'Hembra';
  if (v === 'M') return 'Macho';
  return '';
}

function titleCase(str) {
  return str
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
}

/** Convierte una fecha DBF tipo 'YYYYMMDD' a 'YYYY-MM-DD', o '' si es inválida/vacía. */
export function dbfDateToIso(raw) {
  if (!raw || raw.length !== 8) return '';
  const year = parseInt(raw.slice(0, 4), 10);
  const month = parseInt(raw.slice(4, 6), 10);
  const day = parseInt(raw.slice(6, 8), 10);
  if (year < 1900 || year > 2027 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export function collapseSpaces(str) {
  return (str || '').replace(/\s{2,}/g, ' ').trim();
}

export function isLikelyEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((str || '').trim());
}

export function titleCaseName(str) {
  return titleCase(str || '');
}
