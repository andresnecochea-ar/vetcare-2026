// El backup viejo (Visual FoxPro, langDriver 0x03) guarda texto en Windows-1252,
// que en el rango 0x00-0xFF coincide con Latin-1. Se centraliza acá para no repetir
// el mismo Buffer#toString('latin1') suelto por todo el ETL.
export function decodeLegacyText(buf) {
  return buf.toString('latin1');
}
