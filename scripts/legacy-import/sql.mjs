export function sqlStr(value) {
  const v = (value ?? '').toString().replace(/\0/g, '');
  return `'${v.replace(/'/g, "''")}'`;
}

/**
 * Escritor de INSERTs en lote para un WriteStream. Agrupa filas en statements
 * de a `batchSize` para no generar un único INSERT gigantesco.
 */
// D1 rechaza statements de más de ~100 KB (SQLITE_TOOBIG), y algunas filas
// (historia clínica) tienen descripciones largas, así que el lote se corta
// tanto por cantidad de filas como por tamaño acumulado en bytes.
const MAX_BATCH_BYTES = 60_000;

export class BatchInsertWriter {
  constructor(stream, table, columns, batchSize = 200) {
    this.stream = stream;
    this.table = table;
    this.columns = columns;
    this.batchSize = batchSize;
    this.buffer = [];
    this.bufferBytes = 0;
    this.total = 0;
  }

  push(row) {
    const values = this.columns.map((c) => sqlStr(row[c]));
    const tuple = `(${values.join(',')})`;
    if (this.buffer.length > 0 && this.bufferBytes + tuple.length > MAX_BATCH_BYTES) this._flush();
    this.buffer.push(tuple);
    this.bufferBytes += tuple.length + 2;
    this.total++;
    if (this.buffer.length >= this.batchSize) this._flush();
  }

  _flush() {
    if (this.buffer.length === 0) return;
    this.stream.write(
      `INSERT INTO ${this.table} (${this.columns.join(',')}) VALUES\n${this.buffer.join(',\n')};\n`
    );
    this.buffer = [];
    this.bufferBytes = 0;
  }

  end() {
    this._flush();
  }
}
