import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const assetsRoot = path.join(repoRoot, 'public', 'assets');
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
// q=72 keeps transparent UI assets visibly crisp while still cutting most of
// the oversized source images down enough for fast browser delivery.
const WEBP_QUALITY = Number.parseInt(process.env.WEBP_QUALITY || '72', 10);

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    yield fullPath;
  }
}

async function optimizeImage(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) return null;

  const targetPath = `${filePath.slice(0, -extension.length)}.webp`;
  const [sourceStat, targetStat] = await Promise.all([
    fs.stat(filePath),
    fs.stat(targetPath).catch(() => null),
  ]);

  if (targetStat && targetStat.mtimeMs >= sourceStat.mtimeMs) {
    return { filePath, targetPath, skipped: true, savedBytes: 0 };
  }

  await sharp(filePath)
    // Respect EXIF orientation on uploaded photography while leaving assets
    // without orientation metadata unchanged.
    .rotate()
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toFile(targetPath);

  const optimizedStat = await fs.stat(targetPath);
  return {
    filePath,
    targetPath,
    skipped: false,
    savedBytes: Math.max(0, sourceStat.size - optimizedStat.size),
  };
}

async function main() {
  const results = [];
  for await (const filePath of walk(assetsRoot)) {
    const result = await optimizeImage(filePath);
    if (result) results.push(result);
  }

  const converted = results.filter((result) => !result.skipped);
  const skipped = results.length - converted.length;
  const savedBytes = converted.reduce((sum, result) => sum + result.savedBytes, 0);

  console.log(`Optimized ${converted.length} assets to WebP (${skipped} unchanged).`);
  console.log(`Estimated bytes saved: ${(savedBytes / (1024 * 1024)).toFixed(2)} MiB.`);
}

main().catch((error) => {
  console.error('Asset optimization failed:', error);
  process.exitCode = 1;
});
