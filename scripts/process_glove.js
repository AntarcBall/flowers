import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const glovePath = path.resolve(__dirname, '../data/glove.6B.50d.txt');
const outputPath = path.resolve(__dirname, '../client/public/stars.json');

console.log('Reading GloVe file...');
const rawData = fs.readFileSync(glovePath, 'utf8');
const lines = rawData.split('\n').filter(l => l.trim() !== '');

console.log(`Total lines: ${lines.length}`);

const TARGET_COUNT = 10000;
const CUBE_SIZE = 1000; 

const stars = [];

for (let i = 0; i < Math.min(lines.length, TARGET_COUNT); i++) {
    const line = lines[i];
    const parts = line.split(' ');
    const word = parts[0];
    const vector = parts.slice(1).map(parseFloat);
    
    let x = vector[0];
    let y = vector[1];
    let z = vector[2];

    stars.push({ word, x, y, z });
}

let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity, minZ=Infinity, maxZ=-Infinity;

stars.forEach(s => {
    minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
    minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y);
    minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
});

console.log(`Ranges: X[${minX}, ${maxX}] Y[${minY}, ${maxY}] Z[${minZ}, ${maxZ}]`);

stars.forEach((s, i) => {
    const nx = (s.x - minX) / (maxX - minX);
    const ny = (s.y - minY) / (maxY - minY);
    const nz = (s.z - minZ) / (maxZ - minZ);
    
    s.x = (nx - 0.5) * CUBE_SIZE;
    s.y = (ny - 0.5) * CUBE_SIZE;
    s.z = (nz - 0.5) * CUBE_SIZE;
    
    s.id = i;
    s.color = `hsl(${Math.random()*360}, 80%, 70%)`;
});

fs.writeFileSync(outputPath, JSON.stringify(stars));
console.log(`Wrote ${stars.length} stars to ${outputPath}`);
