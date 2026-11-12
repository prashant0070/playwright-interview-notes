#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$(dirname "$0")"
npm init -y >/dev/null 2>&1 || true
npm install playwright markdown-it markdown-it-anchor highlight.js >/dev/null
npx playwright install chromium
node build-pdf.mjs "$ROOT" "$ROOT/pdfs/Playwright-Interview-Handwritten-Notes.pdf" "Playwright Interview Notes" "Handwritten-style deep study book"
