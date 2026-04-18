/**
 * Scale 11" iPad screenshots (e.g. 1668×2420) to App Store Connect 13" slot: 2064×2752.
 * Uses uniform scaling + pillarboxing/letterboxing (no stretch). Background: app cream #FDFCF8.
 *
 * Usage:
 *   node scripts/resize-app-store-ipad-13-screenshots.mjs --input ./my-screenshots --output ./out
 *   node scripts/resize-app-store-ipad-13-screenshots.mjs --input "C:/path/to/pngs"
 *
 * If --output is omitted, writes to assets/app-store-ipad-13/ next to this script's package root.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const TARGET_W = 2064;
const TARGET_H = 2752;
/** Matches DesignColors.creamBg */
const BG = { r: 253, g: 252, b: 248, alpha: 1 };

function parseArgs() {
  const argv = process.argv.slice(2);
  let input = null;
  let output = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' || argv[i] === '-i') {
      input = argv[++i];
    } else if (argv[i] === '--output' || argv[i] === '-o') {
      output = argv[++i];
    }
  }
  return { input, output };
}

async function main() {
  const { input, output: outArg } = parseArgs();
  if (!input) {
    console.error(
      'Usage: node scripts/resize-app-store-ipad-13-screenshots.mjs --input <folder-with-png-jpg> [--output <folder>]\n'
    );
    process.exit(1);
  }

  const inputDir = path.resolve(input);
  const outputDir = outArg
    ? path.resolve(outArg)
    : path.join(ROOT, 'assets', 'app-store-ipad-13');

  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    console.error(`Not a directory: ${inputDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const entries = fs.readdirSync(inputDir).filter((name) => /\.(png|jpe?g)$/i.test(name));
  if (entries.length === 0) {
    console.error(`No .png / .jpg files in ${inputDir}`);
    process.exit(1);
  }

  entries.sort();

  for (const name of entries) {
    const inPath = path.join(inputDir, name);
    const base = path.basename(name, path.extname(name));
    const outPath = path.join(outputDir, `${base}-${TARGET_W}x${TARGET_H}.png`);

    await sharp(inPath)
      .resize(TARGET_W, TARGET_H, {
        fit: 'contain',
        position: 'centre',
        background: BG,
      })
      .png()
      .toFile(outPath);

    const meta = await sharp(outPath).metadata();
    console.log(`OK ${name} → ${path.relative(process.cwd(), outPath)} (${meta.width}×${meta.height})`);
  }

  console.log(`\nDone. ${entries.length} file(s) in ${outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
