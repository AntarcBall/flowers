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

const FILTER_KEYWORD = 'spring';
const TARGET_COUNT = 300; 
const CUBE_SIZE = 1000; 

function cosineSimilarity(vecA, vecB) {
    let dot = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

console.log('Parsing vectors...');
const allWords = [];
let targetVector = null;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(' ');
    const word = parts[0];
    if (word.length < 2 && word !== 'i' && word !== 'a') continue; 
    
    const vector = parts.slice(1).map(parseFloat);
    if (vector.length !== 50) continue;

    allWords.push({ word, vector });

    if (word === FILTER_KEYWORD) {
        targetVector = vector;
    }
}

if (!targetVector) {
    console.error(`Error: Keyword '${FILTER_KEYWORD}' not found in dataset.`);
    process.exit(1);
}

console.log(`Found target vector for '${FILTER_KEYWORD}'. Calculating similarities...`);

for (const item of allWords) {
    item.similarity = cosineSimilarity(item.vector, targetVector);
}

allWords.sort((a, b) => b.similarity - a.similarity);

const selectedWords = allWords.slice(0, TARGET_COUNT);

console.log(`Top 5 related words: ${selectedWords.slice(0, 5).map(w => w.word).join(', ')}`);

const stars = [];

let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity, minZ=Infinity, maxZ=-Infinity;

for (let i = 0; i < selectedWords.length; i++) {
    const w = selectedWords[i];
    let x = w.vector[0];
    let y = w.vector[1];
    let z = w.vector[2];

    stars.push({ word: w.word, x, y, z });

    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
}

console.log(`Ranges: X[${minX.toFixed(2)}, ${maxX.toFixed(2)}] Y[${minY.toFixed(2)}, ${maxY.toFixed(2)}] Z[${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`);

stars.forEach((s, i) => {
    const nx = (s.x - minX) / (maxX - minX);
    const ny = (s.y - minY) / (maxY - minY);
    const nz = (s.z - minZ) / (maxZ - minZ);
    
    s.x = (nx - 0.5) * CUBE_SIZE;
    s.y = (ny - 0.5) * CUBE_SIZE;
    s.z = (nz - 0.5) * CUBE_SIZE;
    
    s.id = i;
    s.color = `hsl(${Math.random()*360}, 80%, 75%)`;
});

fs.writeFileSync(outputPath, JSON.stringify(stars));
console.log(`Wrote ${stars.length} filtered stars to ${outputPath}`);
