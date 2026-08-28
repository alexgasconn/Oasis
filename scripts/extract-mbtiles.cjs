#!/usr/bin/env node
/**
 * Extracts an .mbtiles (sqlite, gzip-compressed MVT) file into a static folder
 * of {z}/{x}/{y}.pbf tiles that can be served directly from public/ as static
 * assets (no server-side logic needed at runtime).
 *
 * Requires Node 22+ with the built-in experimental sqlite module:
 *   node --experimental-sqlite scripts/extract-mbtiles.js <input.mbtiles> <outDir>
 */
const { DatabaseSync } = require('node:sqlite');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const [, , input, outDir] = process.argv;
if (!input || !outDir) {
  console.error('Usage: node --experimental-sqlite scripts/extract-mbtiles.js <input.mbtiles> <outDir>');
  process.exit(1);
}

const db = new DatabaseSync(input);
const rows = db.prepare('SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles').all();
console.log(`Extracting ${rows.length} tiles from ${input} -> ${outDir}`);

let count = 0;
for (const row of rows) {
  const z = row.zoom_level;
  const x = row.tile_column;
  // MBTiles uses TMS scheme (Y flipped from XYZ)
  const y = Math.pow(2, z) - 1 - row.tile_row;

  const buf = Buffer.from(row.tile_data);
  const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;
  const data = isGzip ? zlib.gunzipSync(buf) : buf;

  const dir = path.join(outDir, String(z), String(x));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${y}.pbf`), data);

  count++;
  if (count % 500 === 0) console.log(`  ${count}/${rows.length}`);
}

console.log(`Done. Wrote ${count} tiles to ${outDir}`);
