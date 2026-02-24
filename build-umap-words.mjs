#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { UMAP } from "umap-js";
import seedrandom from "seedrandom";

function normalizeWord(word) {
  return word.normalize("NFC");
}

const DEFAULT_WORDS_FILE = "data/korean_words.txt";
const DEFAULT_EMBEDDING_PATH = "data/cc.ko.300.vec";

function resolveInputPath(input) {
  if (!input) {
    return "";
  }
  const windowsMatch = input.match(/^([A-Za-z]):[\\/](.*)$/);
  if (windowsMatch && process.platform !== "win32") {
    const drive = windowsMatch[1].toLowerCase();
    return path.posix.normalize(`/mnt/${drive}/${windowsMatch[2].replace(/\\/g, "/")}`);
  }
  return path.resolve(input);
}

function parseCli(argv, env) {
  const defaults = {
    words: DEFAULT_WORDS_FILE,
    embeddings: DEFAULT_EMBEDDING_PATH,
    seed: 42,
    minDist: 0.02,
    nNeighbors: 8,
    scale: 250,
    metric: "cosine",
    l2Normalize: true,
    spread: 1.0
  };

  const options = {
    words: env.npm_config_words || defaults.words,
    embeddings: env.npm_config_embeddings ?? defaults.embeddings,
    out: env.npm_config_out,
    seed: toNumber(env.npm_config_seed, defaults.seed),
    minDist: toNumber(env.npm_config_min_dist ?? env.npm_config_mindist, defaults.minDist),
    nNeighbors: toNumber(env.npm_config_n_neighbors ?? env.npm_config_nneighbors, defaults.nNeighbors),
    scale: toNumber(env.npm_config_scale, defaults.scale),
    metric: String(env.npm_config_metric ?? defaults.metric).toLowerCase(),
    l2Normalize: toBoolean(env.npm_config_l2_normalize ?? env.npm_config_l2normalize, defaults.l2Normalize),
    spread: toNumber(env.npm_config_spread, defaults.spread),
    selectedVectorsOut: env.npm_config_selected_vectors_out ?? env.npm_config_selectedvectorsout,
    missingOut: env.npm_config_missing_out ?? env.npm_config_missingout
  };

  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [flag, inlineValue] = arg.split("=", 2);
    const value = inlineValue ?? argv[i + 1];
    const consumesNext = inlineValue === undefined;

    switch (flag) {
      case "--words":
        options.words = value;
        break;
      case "--embeddings":
        options.embeddings = value;
        break;
      case "--out":
        options.out = value;
        break;
      case "--seed":
        options.seed = toNumber(value, defaults.seed);
        break;
      case "--minDist":
        options.minDist = toNumber(value, defaults.minDist);
        break;
      case "--nNeighbors":
        options.nNeighbors = toNumber(value, defaults.nNeighbors);
        break;
      case "--scale":
        options.scale = toNumber(value, defaults.scale);
        break;
      case "--metric":
        options.metric = String(value ?? defaults.metric).toLowerCase();
        break;
      case "--l2Normalize":
        options.l2Normalize = toBoolean(value, defaults.l2Normalize);
        break;
      case "--spread":
        options.spread = toNumber(value, defaults.spread);
        break;
      case "--selectedVectorsOut":
        options.selectedVectorsOut = value;
        break;
      case "--missingOut":
        options.missingOut = value;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }

    if (consumesNext) {
      i += 1;
    }
  }

  if (!options.embeddings && positional[0]) {
    options.embeddings = positional[0];
  }
  if (!options.out && positional[1]) {
    options.out = positional[1];
  }

  if (!options.embeddings || !options.out) {
    throw new Error("Missing required options. Provide --embeddings and --out (or positional: <embeddings> <out>).");
  }

  if (options.metric !== "euclidean" && options.metric !== "cosine") {
    throw new Error(`Invalid --metric '${options.metric}'. Use 'euclidean' or 'cosine'.`);
  }

  return {
    ...options,
    words: resolveInputPath(options.words),
    embeddings: resolveInputPath(options.embeddings),
    out: resolveInputPath(options.out),
    selectedVectorsOut: options.selectedVectorsOut ? path.resolve(options.selectedVectorsOut) : null,
    missingOut: path.resolve(
      options.missingOut ?? `${path.resolve(options.out)}.missing.txt`
    )
  };
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const v = String(value).trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "y") {
    return true;
  }
  if (v === "0" || v === "false" || v === "no" || v === "n") {
    return false;
  }
  return fallback;
}

function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

function toColor(word) {
  let hash = 0;
  for (const ch of word) {
    hash = (hash * 31 + ch.codePointAt(0)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 80%, 60%)`;
}

function loadWords(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const tokens = raw
    .split(/[\r\n,]+/g)
    .map((x) => normalizeWord(x.trim()))
    .filter(Boolean);

  const seen = new Set();
  const ordered = [];
  for (const word of tokens) {
    if (!seen.has(word)) {
      seen.add(word);
      ordered.push(word);
    }
  }
  return ordered;
}

async function extractWordVectors(embeddingFile, targetWords) {
  const targetSet = new Set(targetWords);
  const found = new Map();
  const extractedLines = [];

  let expectedDim = null;
  let firstContentLine = true;

  const stream = fs.createReadStream(embeddingFile, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (firstContentLine) {
      firstContentLine = false;
      const headerMatch = line.match(/^(\d+)\s+(\d+)$/);
      if (headerMatch) {
        expectedDim = Number(headerMatch[2]);
        continue;
      }
    }

    const firstSpace = line.indexOf(" ");
    if (firstSpace <= 0) {
      continue;
    }

    const rawWord = line.slice(0, firstSpace);
    const word = normalizeWord(rawWord);

    if (!targetSet.has(word) || found.has(word)) {
      continue;
    }

    const valuesText = line.slice(firstSpace + 1).trim();
    if (!valuesText) {
      continue;
    }

    const parts = valuesText.split(/\s+/);
    if (expectedDim !== null && parts.length !== expectedDim) {
      continue;
    }

    const vector = new Array(parts.length);
    let valid = true;
    for (let i = 0; i < parts.length; i += 1) {
      const n = Number(parts[i]);
      if (!Number.isFinite(n)) {
        valid = false;
        break;
      }
      vector[i] = n;
    }

    if (!valid) {
      continue;
    }

    if (expectedDim === null) {
      expectedDim = vector.length;
    }

    if (vector.length !== expectedDim) {
      continue;
    }

    found.set(word, vector);
    extractedLines.push({ word, vector });

    if (found.size === targetSet.size) {
      break;
    }
  }

  rl.close();
  stream.close();

  return { found, extractedLines, expectedDim };
}

function toNormalized3D(points3d) {
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];

  for (const point of points3d) {
    for (let axis = 0; axis < 3; axis += 1) {
      if (point[axis] < mins[axis]) mins[axis] = point[axis];
      if (point[axis] > maxs[axis]) maxs[axis] = point[axis];
    }
  }

  return points3d.map((point) => {
    const out = [0, 0, 0];
    for (let axis = 0; axis < 3; axis += 1) {
      const span = maxs[axis] - mins[axis];
      out[axis] = span === 0 ? 0 : ((point[axis] - mins[axis]) / span) * 2 - 1;
    }
    return out;
  });
}

function l2NormalizeVectors(vectors) {
  return vectors.map((vector) => {
    let sumSq = 0;
    for (let i = 0; i < vector.length; i += 1) {
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm <= 0) {
      return vector.slice();
    }
    return vector.map((v) => v / norm);
  });
}

function cosineDistance(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  const d = 1 - dot;
  return d < 0 ? 0 : d;
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function runUmap(vectors, options) {
  if (vectors.length < 3) {
    throw new Error(`UMAP requires at least 3 vectors, received ${vectors.length}.`);
  }

  const safeNeighbors = Math.max(
    2,
    Math.min(Math.floor(options.nNeighbors), vectors.length - 1)
  );

  const rng = seedrandom(String(options.seed));
  const distanceFn = options.metric === "cosine" ? cosineDistance : euclideanDistance;
  const umap = new UMAP({
    nComponents: 3,
    nNeighbors: safeNeighbors,
    minDist: options.minDist,
    spread: options.spread,
    distanceFn,
    random: () => rng()
  });

  return umap.fit(vectors);
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeSelectedVectorFile(filePath, dim, orderedWords, foundMap) {
  if (!filePath) {
    return;
  }
  ensureParentDir(filePath);
  const lines = [];
  lines.push(`${orderedWords.length} ${dim}`);
  for (const word of orderedWords) {
    const vec = foundMap.get(word);
    lines.push(`${word} ${vec.join(" ")}`);
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function writeMissingFile(filePath, missingWords) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${missingWords.join("\n")}\n`, "utf8");
}

async function main() {
  const opts = parseCli(process.argv.slice(2), process.env);
  const targetWords = loadWords(opts.words);

  if (targetWords.length === 0) {
    throw new Error(`No words found in ${opts.words}`);
  }

  console.log(`[1/4] words loaded: ${targetWords.length}`);
  console.log(`[2/4] scanning embeddings: ${opts.embeddings}`);

  const { found, expectedDim } = await extractWordVectors(opts.embeddings, targetWords);
  const foundWords = targetWords.filter((word) => found.has(word));
  const missingWords = targetWords.filter((word) => !found.has(word));

  if (foundWords.length === 0) {
    throw new Error("No target words were found in the embedding file.");
  }

  if (expectedDim === null) {
    throw new Error("Failed to detect embedding vector dimension.");
  }

  console.log(`[3/4] vectors found: ${foundWords.length}/${targetWords.length}`);
  console.log(`umap config: metric=${opts.metric}, l2Normalize=${opts.l2Normalize}, nNeighbors=${opts.nNeighbors}, minDist=${opts.minDist}, spread=${opts.spread}, scale=${opts.scale}`);
  if (missingWords.length > 0) {
    console.log(`missing words (${missingWords.length}): ${missingWords.join(", ")}`);
  }

  let vectors = foundWords.map((word) => found.get(word));
  if (opts.l2Normalize || opts.metric === "cosine") {
    vectors = l2NormalizeVectors(vectors);
  }
  const reduced3d = runUmap(vectors, opts);
  const normalized = toNormalized3D(reduced3d);

  const output = foundWords.map((word, idx) => {
    const [nx, ny, nz] = normalized[idx];
    return {
      id: idx + 1,
      word,
      x: round6(nx * opts.scale),
      y: round6(ny * opts.scale),
      z: round6(nz * opts.scale),
      nx: round6(nx),
      ny: round6(ny),
      nz: round6(nz),
      color: toColor(word)
    };
  });

  ensureParentDir(opts.out);
  fs.writeFileSync(opts.out, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  writeSelectedVectorFile(opts.selectedVectorsOut, expectedDim, foundWords, found);
  writeMissingFile(opts.missingOut, missingWords);

  console.log(`[4/4] wrote: ${opts.out}`);
  if (opts.selectedVectorsOut) {
    console.log(`selected vectors: ${opts.selectedVectorsOut}`);
  }
  console.log(`missing report: ${opts.missingOut}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
