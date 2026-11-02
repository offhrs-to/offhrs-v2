/**
 * Build counsel PDFs from local terms source (not production).
 * Usage: node docs/legal-review/generate-pdfs.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const outDir = __dirname

const POLICY_LAST_UPDATED = (() => {
  const src = fs.readFileSync(path.join(root, 'src/lib/policy-pages.ts'), 'utf8')
  const m = src.match(/POLICY_LAST_UPDATED\s*=\s*'([^']+)'/)
  if (!m) throw new Error('Could not read POLICY_LAST_UPDATED')
  return m[1]
})()

const PAGES = [
  { slug: 'terms-of-use', file: '01-terms-of-use.pdf', title: 'Terms of Use' },
  { slug: 'privacy-policy', file: '02-privacy-policy.pdf', title: 'Privacy Policy' },
  { slug: 'service-terms', file: '03-service-terms.pdf', title: 'Service Terms' },
  { slug: 'data-protection', file: '04-data-protection.pdf', title: 'Data Protection Addendum' },
  { slug: 'cookies', file: '05-cookies.pdf', title: 'Cookie Policy' },
  { slug: 'content-policy', file: '06-content-policy.pdf', title: 'Content Policy' },
  {
    slug: 'marketplace-seller-addendum',
    file: '07-marketplace-seller-addendum.pdf',
    title: 'Marketplace Seller Addendum',
  },
]

function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c
  }
  throw new Error('Chrome/Edge not found')
}

function parseCookieRows(tsx, constName) {
  const re = new RegExp(`const ${constName}: Row\\[\\] = (\\[[\\s\\S]*?\\n\\])`)
  const m = tsx.match(re)
  if (!m) throw new Error(`Could not parse cookie rows: ${constName}`)
  // Source is JS object-literal-ish; evaluate safely via Function
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${m[1]});`)()
}

function cookieTableHtml(rows) {
  const head =
    '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:10pt;margin:12px 0;"><thead><tr>' +
    ['Cookie name', 'Provider', 'Set on', 'Why we use it', 'Duration']
      .map((h) => `<th align="left">${h}</th>`)
      .join('') +
    '</tr></thead><tbody>'
  const body = rows
    .map(
      (r) =>
        `<tr><td><code>${escapeHtml(r.name)}</code></td><td>${escapeHtml(r.provider)}</td><td>${escapeHtml(r.setOn)}</td><td>${escapeHtml(r.purpose)}</td><td>${escapeHtml(r.duration)}</td></tr>`
    )
    .join('')
  return `${head}${body}</tbody></table>`
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function jsxBodyToHtml(tsx, { slug } = {}) {
  const m = tsx.match(/<LegalPageLayout[^>]*>([\s\S]*?)<\/LegalPageLayout>/)
  if (!m) throw new Error('LegalPageLayout children not found')
  let body = m[1]

  if (slug === 'cookies') {
    const necessary = parseCookieRows(tsx, 'necessary')
    const functionality = parseCookieRows(tsx, 'functionality')
    const advertising = parseCookieRows(tsx, 'advertising')
    body = body
      .replace(/<CookieTable\s+rows=\{necessary\}\s*\/>/g, cookieTableHtml(necessary))
      .replace(/<CookieTable\s+rows=\{functionality\}\s*\/>/g, cookieTableHtml(functionality))
      .replace(/<CookieTable\s+rows=\{advertising\}\s*\/>/g, cookieTableHtml(advertising))
  }

  // Next.js <Link href={policyHref('...')}> → plain <a>
  body = body.replace(
    /<Link\s+href=\{policyHref\('([^']+)'\)\}>/g,
    (_all, slug) => `<a href="https://offhrs.app/terms/${slug}">`
  )
  body = body.replace(/<\/Link>/g, '</a>')

  // Strip JSX expressions that are only whitespace / empty fragments
  body = body.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  body = body.replace(/\{'\s*'\}/g, ' ')
  body = body.replace(/\{"\s*"\}/g, ' ')
  body = body.replace(/\{\s*`([^`]*)`\s*\}/g, '$1')
  body = body.replace(/\{\s*'([^']*)'\s*\}/g, '$1')
  body = body.replace(/\{\s*"([^"]*)"\s*\}/g, '$1')
  // JSX entity shortcuts used in source
  body = body.replace(/&ldquo;/g, '“')
  body = body.replace(/&rdquo;/g, '”')
  body = body.replace(/&lsquo;/g, '‘')
  body = body.replace(/&rsquo;/g, '’')
  body = body.replace(/&mdash;/g, '—')
  body = body.replace(/&ndash;/g, '–')
  body = body.replace(/&rsaquo;/g, '›')
  body = body.replace(/&amp;/g, '&')
  body = body.replace(/className="[^"]*"/g, '')
  body = body.replace(/\s+>/g, '>')
  // Collapse leftover empty braces if any
  if (/\{[^}]+\}/.test(body)) {
    const leftovers = body.match(/\{[^}]+\}/g)
    throw new Error(`Unconverted JSX expressions in ${slug}: ${leftovers?.slice(0, 5).join(', ')}`)
  }
  return body.trim()
}

function wrapDocument({ title, bodyHtml, canonical }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title} | offhrs</title>
  <style>
    @page { margin: 0.75in; }
    body {
      font-family: "Segoe UI", Georgia, serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #111;
      max-width: 720px;
      margin: 0 auto;
      padding: 24px;
    }
    h1 { font-size: 22pt; margin: 0 0 4px; }
    .meta { color: #444; font-size: 10pt; margin-bottom: 28px; }
    h2 { font-size: 14pt; margin-top: 1.6em; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    h3 { font-size: 12pt; margin-top: 1.2em; }
    p, li { margin: 0.55em 0; }
    ul { padding-left: 1.25em; }
    a { color: #1a1a1a; }
    .banner {
      background: #fff8e6;
      border: 1px solid #f0e0b0;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 10pt;
    }
    .note {
      background: #f6f6f6;
      border: 1px solid #e5e5e5;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 10pt;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">offhrs · Last updated: ${POLICY_LAST_UPDATED}<br/>
  Canonical: <a href="${canonical}">${canonical}</a><br/>
  PDF generated from source for counsel review · ${new Date().toISOString().slice(0, 10)}</p>
  <article>
${bodyHtml}
  </article>
</body>
</html>`
}

function printPdf(chrome, htmlPath, pdfPath) {
  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath)
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/')
  const r = spawnSync(
    chrome,
    ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, fileUrl],
    { encoding: 'utf8', timeout: 60000 }
  )
  if (r.status !== 0 && !fs.existsSync(pdfPath)) {
    throw new Error(`Chrome print failed for ${pdfPath}: ${r.stderr || r.stdout || r.status}`)
  }
  // Chrome sometimes exits non-zero but still writes the PDF
  if (!fs.existsSync(pdfPath)) throw new Error(`PDF not written: ${pdfPath}`)
}

function main() {
  const chrome = findChrome()
  console.log('Chrome:', chrome)
  console.log('Policy date:', POLICY_LAST_UPDATED)

  const htmlDir = path.join(outDir, '_html')
  fs.mkdirSync(htmlDir, { recursive: true })

  for (const page of PAGES) {
    const tsxPath = path.join(root, 'src/app/terms', page.slug, 'page.tsx')
    const tsx = fs.readFileSync(tsxPath, 'utf8')
    const bodyHtml = jsxBodyToHtml(tsx, { slug: page.slug })
      .replace(/className=\{[^}]+\}/g, '')
      // restore common entity aliases that counsel PDFs should keep readable
      .replace(/class="[^"]*"/g, (attr) => {
        if (attr.includes('bg-amber') || attr.includes('text-sm')) return 'class="banner"'
        if (attr.includes('bg-gray')) return 'class="note"'
        return ''
      })

    // Re-map leftover className-stripped banners: look for amber/gray patterns already gone.
    // Source uses className on a few callouts — convert those paragraphs by content heuristics later if needed.

    const canonical = `https://offhrs.app/terms/${page.slug}`
    const html = wrapDocument({ title: page.title, bodyHtml, canonical })
    const htmlPath = path.join(htmlDir, `${page.slug}.html`)
    fs.writeFileSync(htmlPath, html, 'utf8')

    const pdfPath = path.join(outDir, page.file)
    printPdf(chrome, htmlPath, pdfPath)
    console.log(`${page.file}: ${fs.statSync(pdfPath).size} bytes`)
  }

  // Cover: pandoc MD → HTML → PDF
  const coverMd = path.join(outDir, '00-COVER-AND-QUESTIONS.md')
  const coverHtml = path.join(outDir, '00-COVER-AND-QUESTIONS.html')
  const coverPdf = path.join(outDir, '00-COVER-AND-QUESTIONS.pdf')
  execFileSync('pandoc', [coverMd, '-o', coverHtml, '--standalone', '-V', 'title=offhrs legal review'], {
    stdio: 'inherit',
  })
  printPdf(chrome, coverHtml, coverPdf)
  console.log(`00-COVER-AND-QUESTIONS.pdf: ${fs.statSync(coverPdf).size} bytes`)
  console.log('Done.')
}

main()
