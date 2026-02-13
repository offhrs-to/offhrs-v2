#!/usr/bin/env node
/**
 * Generates app icons from the shared offhrs logo (assets/images/logo.png).
 * Output: icon.png and android-icon-foreground.png (1024x1024, logo centered on white).
 * Run from offhrs-mobile: node scripts/generate-app-icon.js
 */

const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const logoPath = path.join(root, 'assets', 'images', 'logo.png');
const iconSize = 1024;
const logoPadding = 0.15; // logo uses 70% of side (15% padding each side)

if (!fs.existsSync(logoPath)) {
  console.error('Logo not found at', logoPath);
  process.exit(1);
}

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Run: npm install --save-dev sharp');
    process.exit(1);
  }

  const logo = sharp(logoPath);
  const meta = await logo.metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const scale = (iconSize * (1 - 2 * logoPadding)) / Math.max(w, h);
  const scaledW = Math.round(w * scale);
  const scaledH = Math.round(h * scale);
  const left = Math.round((iconSize - scaledW) / 2);
  const top = Math.round((iconSize - scaledH) / 2);

  const resizedLogo = await logo.resize(scaledW, scaledH).toBuffer();

  const out = await sharp({
    create: {
      width: iconSize,
      height: iconSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .composite([{ input: resizedLogo, left, top }])
    .toBuffer();

  const iconPath = path.join(root, 'assets', 'images', 'icon.png');
  const androidForegroundPath = path.join(root, 'assets', 'images', 'android-icon-foreground.png');

  fs.writeFileSync(iconPath, out);
  fs.writeFileSync(androidForegroundPath, out);

  console.log('Generated:', iconPath);
  console.log('Generated:', androidForegroundPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
