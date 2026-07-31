// Lector minimalista de tablas dBase/Visual FoxPro (.dbf) + memos (.fpt).
// Sin dependencias externas: el formato está documentado y es estable.
import fs from 'node:fs';
import path from 'node:path';
import { decodeLegacyText } from './cp1252.mjs';

const MEMO_BLOCK_SIZE = 64; // estándar FoxPro; se re-lee del header del .fpt si difiere

function findSibling(dbfPath, ext) {
  const dir = path.dirname(dbfPath);
  const base = path.basename(dbfPath, path.extname(dbfPath));
  const candidates = fs.readdirSync(dir);
  const match = candidates.find(
    (f) => f.toLowerCase() === `${base}${ext}`.toLowerCase()
  );
  return match ? path.join(dir, match) : null;
}

export class DbfTable {
  constructor(dbfPath) {
    this.dbfPath = dbfPath;
    this.fd = fs.openSync(dbfPath, 'r');
    this._readHeader();
    this.fptPath = findSibling(dbfPath, '.fpt');
    this.fptFd = null;
    this.fptBlockSize = MEMO_BLOCK_SIZE;
  }

  _readHeader() {
    const hb = Buffer.alloc(32);
    fs.readSync(this.fd, hb, 0, 32, 0);
    const numRecords = hb.readUInt32LE(4);
    const headerSize = hb.readUInt16LE(8);
    const recordSize = hb.readUInt16LE(10);
    const numFields = Math.floor((headerSize - 32 - 1) / 32);
    const fb = Buffer.alloc(numFields * 32);
    fs.readSync(this.fd, fb, 0, fb.length, 32);
    const fields = [];
    let offset = 1; // byte 0 del registro es el flag de borrado
    for (let i = 0; i < numFields; i++) {
      const f = fb.subarray(i * 32, i * 32 + 32);
      if (f[0] === 0x0d) break;
      let nameEnd = f.indexOf(0, 0);
      if (nameEnd === -1) nameEnd = 11;
      const name = f.subarray(0, nameEnd).toString('latin1');
      const type = String.fromCharCode(f[11]);
      const length = f[16];
      const decimals = f[17];
      fields.push({ name, type, length, decimals, offset });
      offset += length;
    }
    this.header = { numRecords, headerSize, recordSize, fields };
  }

  _openFpt() {
    if (this.fptFd !== null || !this.fptPath) return;
    this.fptFd = fs.openSync(this.fptPath, 'r');
    const hb = Buffer.alloc(8);
    fs.readSync(this.fptFd, hb, 0, 8, 0);
    const blockSize = hb.readUInt16BE(6);
    if (blockSize > 0) this.fptBlockSize = blockSize;
  }

  _readMemo(blockNum) {
    if (!blockNum) return '';
    this._openFpt();
    if (this.fptFd === null) return '';
    const hb = Buffer.alloc(8);
    fs.readSync(this.fptFd, hb, 0, 8, blockNum * this.fptBlockSize);
    const len = hb.readUInt32BE(4);
    if (len <= 0) return '';
    const data = Buffer.alloc(len);
    fs.readSync(this.fptFd, data, 0, len, blockNum * this.fptBlockSize + 8);
    return decodeLegacyText(data);
  }

  get recordCount() {
    return this.header.numRecords;
  }

  get fieldNames() {
    return this.header.fields.map((f) => f.name);
  }

  /** Lee un registro crudo por índice (0-based). Memos se resuelven a texto. */
  readRecord(index) {
    const buf = Buffer.alloc(this.header.recordSize);
    fs.readSync(this.fd, buf, 0, this.header.recordSize, this.header.headerSize + index * this.header.recordSize);
    const deleted = buf[0] === 0x2a;
    const rec = { _deleted: deleted };
    for (const f of this.header.fields) {
      const raw = buf.subarray(f.offset, f.offset + f.length);
      if (f.type === 'M') {
        const blockNum = f.length === 4 ? raw.readUInt32LE(0) : parseInt(decodeLegacyText(raw).trim() || '0', 10);
        rec[f.name] = this._readMemo(blockNum);
      } else if (f.type === 'L') {
        rec[f.name] = String.fromCharCode(raw[0]);
      } else {
        rec[f.name] = decodeLegacyText(raw).trim();
      }
    }
    return rec;
  }

  /** Itera todos los registros. Por defecto omite los marcados como borrados (soft-delete). */
  *records({ includeDeleted = false } = {}) {
    for (let i = 0; i < this.header.numRecords; i++) {
      const rec = this.readRecord(i);
      if (!includeDeleted && rec._deleted) continue;
      yield rec;
    }
  }

  close() {
    fs.closeSync(this.fd);
    if (this.fptFd !== null) fs.closeSync(this.fptFd);
  }
}
