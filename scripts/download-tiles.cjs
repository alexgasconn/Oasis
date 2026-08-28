#!/usr/bin/env node
/**
 * Simple tile downloader for OpenStreetMap raster tiles.
 * Usage:
 *   node scripts/download-tiles.js --minLat=40.45 --minLon=-1.5 --maxLat=42.8 --maxLon=3.4 --minZ=10 --maxZ=14 --out=public/tiles/catalunya
 *
 * Notes:
 * - Be considerate with tile servers. If you have heavy needs, host your own tile server or use a proper provider.
 * - This script downloads tiles sequentially with a short delay to avoid hammering the server.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  args.forEach(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

function lon2tilex(lon, z) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, z));
}
function lat2tiley(lat, z) {
  const rad = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z));
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

(async () => {
  const args = parseArgs();
  const minLat = parseFloat(args.minLat || args.south || 40.45);
  const minLon = parseFloat(args.minLon || args.west || -1.5);
  const maxLat = parseFloat(args.maxLat || args.north || 42.8);
  const maxLon = parseFloat(args.maxLon || args.east || 3.4);
  const minZ = parseInt(args.minZ || '10', 10);
  const maxZ = parseInt(args.maxZ || '14', 10);
  const outDir = args.out || 'public/tiles/catalunya';
  const delayMs = parseInt(args.delayMs || '250', 10);
  const template = args.template || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  console.log(`Downloading tiles for bbox: ${minLat},${minLon} - ${maxLat},${maxLon} z=${minZ}-${maxZ} -> ${outDir}`);

  for (let z = minZ; z <= maxZ; z++) {
    const xMin = lon2tilex(minLon, z);
    const xMax = lon2tilex(maxLon, z);
    const yMin = lat2tiley(maxLat, z); // note: latitude inverted for y
    const yMax = lat2tiley(minLat, z);

    console.log(`Zoom ${z}: x ${xMin}..${xMax}, y ${yMin}..${yMax}`);

    let total = (xMax - xMin + 1) * (yMax - yMin + 1);
    let count = 0;
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        count++;
        const url = template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        const dest = path.join(outDir, String(z), String(x), `${y}.png`);
        try {
          if (fs.existsSync(dest)) {
            process.stdout.write(`(${z}/${count}/${total}) exists `);
          } else {
            process.stdout.write(`(${z}/${count}/${total}) dl `);
            await download(url, dest);
          }
        } catch (err) {
          process.stdout.write(`err `);
          console.error(`\nFailed ${url}:`, err.message);
        }
        process.stdout.write('\r');
        await sleep(delayMs);
      }
    }
    process.stdout.write('\n');
  }
  console.log('Done.');
})();
