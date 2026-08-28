// Extracts drinking-water fountain nodes from a local .osm.pbf file into a static
// JSON dataset bundled with the app (public/data/fountains-catalunya.json), so the
// app has a fully offline / Overpass-independent fallback for Catalunya.
//
// Usage: node scripts/extract-fountains.cjs <input.osm.pbf> <output.json>
const fs = require('fs');
const path = require('path');
const parser = require('osm-pbf-parser');
const { Transform } = require('stream');

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error('Usage: node scripts/extract-fountains.cjs <input.osm.pbf> <output.json>');
  process.exit(1);
}

const fountains = [];
let count = 0;

const collector = new Transform({
  objectMode: true,
  transform(items, _enc, cb) {
    for (const item of items) {
      if (item.type !== 'node' || !item.tags) continue;
      const tags = item.tags;
      let potable = 'unknown';
      let isFountain = false;

      if (tags.amenity === 'drinking_water') {
        isFountain = true;
        potable = tags.drinking_water === 'no' ? 'no' : 'yes';
      } else if (tags.amenity === 'fountain' && tags.drinking_water === 'yes') {
        isFountain = true;
        potable = 'yes';
      } else if (tags.man_made === 'water_tap' && tags.drinking_water === 'yes') {
        isFountain = true;
        potable = 'yes';
      }

      if (!isFountain) continue;
      count++;
      fountains.push({
        id: String(item.id),
        lat: item.lat,
        lng: item.lon,
        type: tags.natural === 'spring' ? 'natural' : 'urban',
        potable,
        status: tags.operational_status === 'broken' ? 'broken' : 'working',
        description: tags.description || tags.name || null,
      });
    }
    cb();
  },
});

fs.createReadStream(input)
  .pipe(parser())
  .pipe(collector)
  .on('finish', () => {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(fountains));
    console.log(`Extracted ${count} fountains -> ${output}`);
  })
  .on('error', (err) => {
    console.error('Extraction failed:', err);
    process.exit(1);
  });
