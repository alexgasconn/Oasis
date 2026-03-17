import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = path.join(process.cwd(), 'public', 'icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generate() {
  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(process.cwd(), 'public', 'icon-192.png'));
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(process.cwd(), 'public', 'icon-512.png'));
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(process.cwd(), 'public', 'apple-touch-icon.png'));
  console.log('Icons generated successfully');
}

generate().catch(console.error);
