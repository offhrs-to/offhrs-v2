#!/usr/bin/env node
/**
 * Phase 5 — lightweight concurrency smoke test for critical routes.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node scripts/load-test-endpoints.mjs
 *   BASE_URL=https://your-preview.vercel.app node scripts/load-test-endpoints.mjs
 *
 * Options (env):
 *   CONCURRENT   — parallel requests per wave (default: 10)
 *   WAVES       — number of waves (default: 5)
 *   BYPASS      — optional Vercel protection bypass token (?x-vercel-protection-bypass=...)
 *
 * Expects GET /api/webhooks/cal to return 200 {"ok":true}.
 * Hits POST /api/book with empty body expecting 400 (validation path, no Stripe).
 */

const base = process.env.BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000'
const concurrent = Number(process.env.CONCURRENT || 10)
const waves = Number(process.env.WAVES || 5)
const bypass = process.env.BYPASS?.trim()

const calUrl = bypass
  ? `${base}/api/webhooks/cal?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`
  : `${base}/api/webhooks/cal`

async function oneCalGet(i, wave) {
  const res = await fetch(calUrl, { method: 'GET', headers: { Accept: 'application/json' } })
  const text = await res.text()
  let ok = res.ok
  try {
    const j = JSON.parse(text)
    ok = ok && j.ok === true
  } catch {
    ok = false
  }
  return { i, wave, route: 'GET /api/webhooks/cal', status: res.status, ok }
}

async function oneBookPost(i, wave) {
  const res = await fetch(`${base}/api/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return { i, wave, route: 'POST /api/book', status: res.status, ok: res.status === 400 }
}

async function wave(w) {
  const tasks = []
  for (let i = 0; i < concurrent; i++) {
    tasks.push(oneCalGet(i, w))
    tasks.push(oneBookPost(i, w))
  }
  return Promise.all(tasks)
}

async function main() {
  console.error(`Load smoke: ${base} | ${concurrent * 2} req/wave × ${waves} waves`)

  let failed = 0
  const t0 = Date.now()

  for (let w = 1; w <= waves; w++) {
    const results = await wave(w)
    for (const r of results) {
      if (!r.ok) {
        failed++
        console.error(`FAIL wave=${w} ${r.route} status=${r.status}`)
      }
    }
    console.error(`Wave ${w}/${waves} done (${concurrent * 2} requests)`)
  }

  const ms = Date.now() - t0
  const total = concurrent * 2 * waves
  console.error(`Finished ${total} requests in ${ms}ms (${((total / ms) * 1000).toFixed(1)} rps avg)`)

  if (failed > 0) {
    console.error(`Failures: ${failed}`)
    process.exit(1)
  }
  console.error('All checks passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
