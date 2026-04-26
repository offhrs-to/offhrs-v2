#!/usr/bin/env node

/**
 * Apply baseline branch protection to main using GitHub REST API.
 *
 * Required env:
 * - GITHUB_TOKEN (repo admin scope / fine-grained permission for administration)
 * - GITHUB_OWNER
 * - GITHUB_REPO
 */

const token = process.env.GITHUB_TOKEN
const owner = process.env.GITHUB_OWNER
const repo = process.env.GITHUB_REPO

if (!token || !owner || !repo) {
  console.error('Missing required env: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO')
  process.exit(1)
}

const endpoint = `https://api.github.com/repos/${owner}/${repo}/branches/main/protection`

const payload = {
  required_status_checks: {
    strict: true,
    contexts: ['Secret Scan', 'Environment Validation'],
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    required_approving_review_count: 1,
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
  },
  restrictions: null,
  allow_force_pushes: false,
  allow_deletions: false,
}

const res = await fetch(endpoint, {
  method: 'PUT',
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
})

if (!res.ok) {
  const txt = await res.text()
  console.error(`GitHub API error (${res.status}): ${txt}`)
  process.exit(1)
}

console.log('Branch protection applied to main.')
