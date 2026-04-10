/**
 * Renders 3 App Store screenshots (1242×2688, iPhone 6.5") from SVG that mirror
 * Offhrs mobile UI: design tokens from constants/design-template.ts + real logo asset.
 *
 * Run from repo root: node offhrs-mobile/scripts/render-app-store-screenshots.mjs
 * Or: cd offhrs-mobile && node scripts/render-app-store-screenshots.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'app-store-review');
const LOGO_PATH = path.join(ROOT, 'assets', 'images', 'logo.png');

const W = 1242;
const H = 2688;
const PAD = 72;

const CREAM = '#FDFCF8';
const CHARCOAL = '#2C2C2C';
const MEDIUM = '#6B6B6B';
const PRIMARY = '#38511B';
const LIGHT_BORDER = '#A8C4A0';
const HERO_BG = '#E8F0E5';
const INPUT_BG = '#F5F5F5';
const LINE = '#E5E5E5';
const TAB_BAR_BG = '#FFFFFF';
const TAB_ACTIVE_CIRCLE = '#E8F0E5';
const PLACEHOLDER = '#E0E0E0';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadLogoHref() {
  const buf = fs.readFileSync(LOGO_PATH);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/** Rounded rect path */
function rr(x, y, w, h, r) {
  return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}

function workshopCard(cx, cy, cw, ch, gradientId, title, loc, price) {
  const r = 20;
  const imgH = Math.round(ch * 0.42);
  return `
  <g transform="translate(${cx},${cy})">
    <path d="${rr(0, 0, cw, ch, r)}" fill="${HERO_BG}" stroke="${LIGHT_BORDER}" stroke-width="1"/>
    <rect x="0" y="0" width="${cw}" height="${imgH}" rx="${r}" fill="url(#${gradientId})"/>
    <rect x="0" y="${imgH - r}" width="${cw}" height="${r}" fill="url(#${gradientId})"/>
    <text x="14" y="${imgH + 36}" font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="26" font-weight="700" fill="${CHARCOAL}">${escapeXml(title)}</text>
    <text x="14" y="${imgH + 68}" font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="22" fill="${MEDIUM}">${escapeXml(loc)}</text>
    <text x="14" y="${imgH + 100}" font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="24" font-weight="600" fill="${CHARCOAL}">${escapeXml(price)}</text>
  </g>`;
}

function tabBarPill(y, activeIndex) {
  const barH = 112;
  const barW = W - PAD * 2;
  const barX = PAD;
  const rx = barH / 2;
  const n = 4;
  const slot = barW / n;
  const ink = (i) => (i === activeIndex ? PRIMARY : MEDIUM);
  let icons = '';
  for (let i = 0; i < n; i++) {
    const cx = barX + slot * i + slot / 2;
    const cy = y + barH / 2;
    const on = i === activeIndex;
    icons += `<circle cx="${cx}" cy="${cy}" r="46" fill="${on ? TAB_ACTIVE_CIRCLE : 'transparent'}"/>`;
    if (i === 0) {
      icons += `<path d="M ${cx - 18} ${cy - 2} L ${cx} ${cy - 18} L ${cx + 18} ${cy - 2} V ${cy + 16} H ${cx - 10} V ${cy + 6} H ${cx + 10} V ${cy + 16} H ${cx - 18} Z" fill="${ink(i)}"/>`;
    } else if (i === 1) {
      icons += `<circle cx="${cx - 2}" cy="${cy - 4}" r="12" fill="none" stroke="${ink(i)}" stroke-width="4"/>`;
      icons += `<line x1="${cx + 8}" y1="${cy + 8}" x2="${cx + 18}" y2="${cy + 18}" stroke="${ink(i)}" stroke-width="4" stroke-linecap="round"/>`;
    } else if (i === 2) {
      icons += `<rect x="${cx - 18}" y="${cy - 12}" width="36" height="26" rx="4" fill="none" stroke="${ink(i)}" stroke-width="4"/>`;
      icons += `<line x1="${cx - 18}" y1="${cy - 4}" x2="${cx + 18}" y2="${cy - 4}" stroke="${ink(i)}" stroke-width="4"/>`;
    } else {
      icons += `<circle cx="${cx}" cy="${cy - 6}" r="14" fill="none" stroke="${ink(i)}" stroke-width="4"/>`;
      icons += `<path d="M ${cx - 18} ${cy + 18} Q ${cx} ${cy + 8} ${cx + 18} ${cy + 18}" fill="none" stroke="${ink(i)}" stroke-width="4"/>`;
    }
  }
  return `
  <g>
    <rect x="${barX}" y="${y}" width="${barW}" height="${barH}" rx="${rx}" fill="${TAB_BAR_BG}" stroke="${PRIMARY}" stroke-width="3"/>
    ${icons}
  </g>`;
}

function svgHeader(logoHref, opts = {}) {
  const { showBack = false } = opts;
  return `
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C4D4B8"/><stop offset="100%" stop-color="#8FA68A"/></linearGradient>
    <linearGradient id="g2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#D4E4CF"/><stop offset="100%" stop-color="#9EB89A"/></linearGradient>
    <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#E8DCC8"/><stop offset="100%" stop-color="#B8A894"/></linearGradient>
    <linearGradient id="mapWater" x1="0%" y1="0%" x2="100%" y2="1"><stop offset="0%" stop-color="#DDE8DF"/><stop offset="40%" stop-color="#C8D9CC"/><stop offset="100%" stop-color="#B0C4B4"/></linearGradient>
    <linearGradient id="mapPark" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A8C4A0"/><stop offset="100%" stop-color="#7D9A78"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <text x="${PAD}" y="88" font-family="system-ui" font-size="38" font-weight="600" fill="${CHARCOAL}">9:41</text>
  <rect x="${W - PAD - 72}" y="52" width="72" height="36" rx="8" fill="${CHARCOAL}" opacity="0.08"/>
  <line x1="0" y1="118" x2="${W}" y2="118" stroke="${LINE}" stroke-width="2"/>
  <image href="${logoHref}" x="${PAD - 40}" y="138" width="496" height="149" preserveAspectRatio="xMidYMid meet"/>
  ${showBack ? `<text x="${PAD}" y="200" font-size="56" fill="${PRIMARY}" font-weight="400">‹</text>` : ''}
  <text x="${W - PAD - 280}" y="172" font-family="system-ui" font-size="26" fill="${MEDIUM}">Welcome</text>
  <text x="${W - PAD - 280}" y="218" font-family="system-ui" font-size="40" font-weight="700" fill="${CHARCOAL}">Alex</text>
  <circle cx="${W - PAD - 56}" cy="196" r="52" fill="${PLACEHOLDER}"/>
  <path d="M ${W - PAD - 56} ${196 - 18} a 18 18 0 1 1 0 0.1 z" fill="${MEDIUM}" opacity="0.5"/>
  `;
}

function buildHome(logoHref) {
  const tabY = H - 160;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${svgHeader(logoHref)}
  <text x="${PAD}" y="380" font-family="Georgia, Times, serif" font-size="64" fill="${CHARCOAL}">Discover your new passion</text>
  <text x="${PAD}" y="460" font-family="system-ui" font-size="32" font-weight="700" fill="${CHARCOAL}">Your mastery progression</text>
  <g transform="translate(${PAD}, 500)">
    ${[0, 1, 2, 3, 4, 5]
      .map((i) => {
        const cx = 56 + i * 108;
        return `<circle cx="${cx}" cy="40" r="40" fill="${HERO_BG}" stroke="${PRIMARY}" stroke-width="4"/>`;
      })
      .join('')}
  </g>
  <text x="${PAD}" y="660" font-family="system-ui" font-size="32" font-weight="700" fill="${CHARCOAL}">Upcoming workshops in Toronto</text>
  ${workshopCard(PAD, 690, 380, 420, 'g1', 'Hand-building Pottery', 'Leslieville', '$85')}
  ${workshopCard(PAD + 398, 690, 380, 420, 'g2', 'Intro to Latte Art', 'King West', '$45')}
  ${workshopCard(PAD + 796, 690, 320, 420, 'g3', 'Floral Arranging', 'The Junction', '$120')}
  <text x="${PAD}" y="1180" font-family="system-ui" font-size="32" font-weight="700" fill="${CHARCOAL}">Workshops near you</text>
  <text x="${PAD}" y="1230" font-family="system-ui" font-size="28" fill="${MEDIUM}">Explore nearby classes</text>
  ${workshopCard(PAD, 1250, 380, 420, 'g2', 'Weekend Woodworking', 'East York', '$95')}
  ${workshopCard(PAD + 398, 1250, 380, 420, 'g1', 'Natural Soap Making', 'Roncesvalles', '$65')}
  ${workshopCard(PAD + 796, 1250, 320, 420, 'g3', 'Scent Blending', 'Ossington', '$55')}
  <g transform="translate(${PAD + 180}, 1720)">
    ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${i * 22}" cy="0" r="8" fill="${i === 0 ? CHARCOAL : '#CFCFCF'}"/>`).join('')}
  </g>
  ${tabBarPill(tabY, 0)}
</svg>`;
}

function categoryTile(x, y, tw, th, label, gradId) {
  const labH = 44;
  const upper = th - labH;
  return `
  <g transform="translate(${x},${y})">
    <rect width="${tw}" height="${th}" rx="28" fill="${INPUT_BG}" stroke="${LIGHT_BORDER}" stroke-width="2"/>
    <rect x="0" y="0" width="${tw}" height="${upper}" rx="28" fill="url(#${gradId})"/>
    <rect x="0" y="${upper - 28}" width="${tw}" height="28" fill="url(#${gradId})"/>
    <rect x="0" y="${th - labH}" width="${tw}" height="${labH}" fill="rgba(0,0,0,0.35)"/>
    <text x="${tw / 2}" y="${th - 16}" text-anchor="middle" font-family="system-ui" font-size="22" font-weight="700" fill="#FFFFFF">${escapeXml(label)}</text>
  </g>`;
}

function buildWorkshopsHub(logoHref) {
  const gap = 20;
  const tw = (W - PAD * 2 - gap) / 2;
  const th = Math.round(tw * 0.74);
  const gridY = 920;
  const cats = [
    ['Beauty & Fragrance', 'cg1'],
    ['Culinary', 'cg2'],
    ['Coffee', 'cg3'],
    ['Floral', 'cg4'],
    ['Pottery', 'cg5'],
    ['Other', 'cg6'],
  ];
  const grads = `
    <linearGradient id="mapWater" x1="0%" y1="0%" x2="100%" y2="1"><stop offset="0%" stop-color="#DDE8DF"/><stop offset="40%" stop-color="#C8D9CC"/><stop offset="100%" stop-color="#B0C4B4"/></linearGradient>
    <linearGradient id="mapPark" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A8C4A0"/><stop offset="100%" stop-color="#7D9A78"/></linearGradient>
    <linearGradient id="cg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E8D4E0"/><stop offset="100%" stop-color="#C49AAD"/></linearGradient>
    <linearGradient id="cg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F5E6D3"/><stop offset="100%" stop-color="#C9A574"/></linearGradient>
    <linearGradient id="cg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4C4B0"/><stop offset="100%" stop-color="#8B6914"/></linearGradient>
    <linearGradient id="cg4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E8F0E5"/><stop offset="100%" stop-color="#5D755D"/></linearGradient>
    <linearGradient id="cg5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D8E0E8"/><stop offset="100%" stop-color="#7A8FA8"/></linearGradient>
    <linearGradient id="cg6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E8E8E8"/><stop offset="100%" stop-color="#9A9A9A"/></linearGradient>
  `;
  let tiles = '';
  cats.forEach(([label, gid], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    tiles += categoryTile(PAD + col * (tw + gap), gridY + row * (th + gap), tw, th, label, gid);
  });
  const tabY = H - 160;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${grads}</defs>
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <text x="${PAD}" y="88" font-family="system-ui" font-size="38" font-weight="600" fill="${CHARCOAL}">9:41</text>
  <line x1="0" y1="118" x2="${W}" y2="118" stroke="${LINE}" stroke-width="2"/>
  <image href="${logoHref}" x="${PAD - 40}" y="138" width="496" height="149" preserveAspectRatio="xMidYMid meet"/>
  <rect x="${PAD}" y="320" width="${W - PAD * 2}" height="80" rx="40" fill="${INPUT_BG}" stroke="${LIGHT_BORDER}" stroke-width="2"/>
  <text x="${PAD + 36}" y="372" font-family="system-ui" font-size="30" fill="${MEDIUM}">Search workshops…</text>
  <text x="${PAD}" y="460" font-family="system-ui" font-size="32" font-weight="700" fill="${CHARCOAL}">Browse nearby</text>
  <rect x="${PAD}" y="490" width="${W - PAD * 2}" height="420" rx="32" fill="url(#mapWater)" stroke="${LIGHT_BORDER}" stroke-width="2"/>
  <path d="M ${PAD + 80} ${520} L ${PAD + 200} ${600} L ${PAD + 120} ${720} Z" fill="url(#mapPark)" opacity="0.85"/>
  <path d="M ${PAD + 400} ${550} L ${PAD + 900} ${580} L ${PAD + 850} ${650} L ${PAD + 380} ${620} Z" fill="#E8E8E8" opacity="0.9"/>
  <circle cx="${PAD + 280}" cy="${650}" r="18" fill="${PRIMARY}" stroke="#FFFFFF" stroke-width="4"/>
  <circle cx="${PAD + 520}" cy="${720}" r="18" fill="${PRIMARY}" stroke="#FFFFFF" stroke-width="4"/>
  <circle cx="${PAD + 780}" cy="${600}" r="18" fill="${PRIMARY}" stroke="#FFFFFF" stroke-width="4"/>
  <text x="${PAD}" y="960" font-family="system-ui" font-size="32" font-weight="700" fill="${CHARCOAL}">What sparks your curiosity?</text>
  ${tiles}
  <rect x="${PAD}" y="${gridY + 3 * (th + gap) + 40}" width="${W - PAD * 2}" height="140" rx="28" fill="${HERO_BG}" stroke="${LIGHT_BORDER}" stroke-width="2"/>
  <text x="${PAD + 28}" y="${gridY + 3 * (th + gap) + 88}" font-family="system-ui" font-size="28" font-weight="700" fill="${CHARCOAL}">Found a workshop you like? Tap the heart on a listing</text>
  <text x="${PAD + 28}" y="${gridY + 3 * (th + gap) + 128}" font-family="system-ui" font-size="28" fill="${CHARCOAL}">to save it to your profile.</text>
  ${tabBarPill(tabY, 1)}
</svg>`;
}

function buildMap(logoHref) {
  const tabY = H - 160;
  const sheetY = 1500;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="mapBg" x1="0%" y1="0%" x2="100%" y2="1"><stop offset="0%" stop-color="#CFDED8"/><stop offset="100%" stop-color="#A8BFAE"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <text x="${PAD}" y="88" font-family="system-ui" font-size="38" font-weight="600" fill="${CHARCOAL}">9:41</text>
  <line x1="0" y1="118" x2="${W}" y2="118" stroke="${LINE}" stroke-width="2"/>
  <text x="${PAD}" y="200" font-size="56" fill="${PRIMARY}">‹</text>
  <image href="${logoHref}" x="${PAD + 30}" y="138" width="496" height="149" preserveAspectRatio="xMidYMid meet"/>
  <rect x="${PAD}" y="320" width="${W - PAD * 2}" height="80" rx="40" fill="${INPUT_BG}" stroke="${LIGHT_BORDER}" stroke-width="2"/>
  <text x="${PAD + 36}" y="372" font-family="system-ui" font-size="30" fill="${MEDIUM}">Search workshops…</text>
  <rect x="0" y="420" width="${W}" height="${sheetY - 420}" fill="url(#mapBg)"/>
  <path d="M ${200} 520 L ${450} 480 L ${700} 620 L ${500} 800 Z" fill="#B8CBB8" opacity="0.9"/>
  <path d="M ${600} 700 L ${900} 650 L ${1000} 900 L ${650} 950 Z" fill="#D8D8D8" opacity="0.85"/>
  <circle cx="420" cy="680" r="22" fill="${PRIMARY}" stroke="#FFF" stroke-width="5"/>
  <circle cx="720" cy="820" r="22" fill="${PRIMARY}" stroke="#FFF" stroke-width="5"/>
  <circle cx="900" cy="600" r="22" fill="${PRIMARY}" stroke="#FFF" stroke-width="5"/>
  <path d="M 0 ${sheetY} L ${W} ${sheetY} L ${W} ${H} L 0 ${H} Z" fill="#FFFFFF" stroke="${LIGHT_BORDER}" stroke-width="2"/>
  <rect x="${W / 2 - 40}" y="${sheetY + 24}" width="80" height="10" rx="5" fill="${PLACEHOLDER}"/>
  <text x="${W / 2}" y="${sheetY + 70}" text-anchor="middle" font-family="system-ui" font-size="22" fill="${MEDIUM}">Drag to resize map or list</text>
  <rect x="${PAD}" y="${sheetY + 100}" width="200" height="64" rx="32" fill="${PRIMARY}"/>
  <text x="${PAD + 100}" y="${sheetY + 142}" text-anchor="middle" font-family="system-ui" font-size="28" font-weight="700" fill="#FFFFFF">See full list</text>
  <rect x="${PAD}" y="${sheetY + 200}" width="140" height="140" rx="70" fill="${INPUT_BG}"/>
  <text x="${PAD + 180}" y="${sheetY + 250}" font-family="system-ui" font-size="32" font-weight="600" fill="${CHARCOAL}">Wheel-throwing intensive</text>
  <text x="${PAD + 180}" y="${sheetY + 295}" font-family="system-ui" font-size="26" fill="${MEDIUM}">Sat, Mar 14 · 2:00 PM</text>
  <text x="${PAD + 180}" y="${sheetY + 335}" font-family="system-ui" font-size="24" fill="${MEDIUM}">4.8 ★ average · 12 reviews</text>
  ${tabBarPill(tabY, 1)}
</svg>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const logoHref = loadLogoHref();
  const shots = [
    { name: '01-home-discover.png', svg: buildHome(logoHref) },
    { name: '02-workshops-browse.png', svg: buildWorkshopsHub(logoHref) },
    { name: '03-workshop-map.png', svg: buildMap(logoHref) },
  ];
  for (const { name, svg } of shots) {
    const out = path.join(OUT_DIR, name);
    await sharp(Buffer.from(svg)).png().toFile(out);
    console.log('Wrote', out);
  }
  console.log('Done. 1242×2688 PNGs for App Store Connect (iPhone 6.5").');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
