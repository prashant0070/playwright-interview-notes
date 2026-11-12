#!/usr/bin/env node
/**
 * Convert curriculum markdown into a clean notebook-style PDF.
 * Usage: node build-pdf.mjs <notesDir> <outPdf> [title] [subtitle]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import hljs from 'highlight.js';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [notesDir, outPdf, bookTitle = 'Interview Notes', subtitle = 'Notebook study edition'] = process.argv.slice(2);

if (!notesDir || !outPdf) {
  console.error('Usage: node build-pdf.mjs <notesDir> <outPdf> [title] [subtitle]');
  process.exit(1);
}

const SKIP = new Set([
  'readme.md',
  'changelog.md',
  'contributing.md',
  'code_of_conduct.md',
  'license.md',
]);

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang === 'mermaid') {
      return `<div class="diagram-frame"><div class="diagram-label">diagram</div><pre class="mermaid">${md.utils.escapeHtml(str)}</pre></div>`;
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
}).use(markdownItAnchor, { level: [2, 3], permalink: false });

function listCurriculumFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    .filter((f) => !SKIP.has(f.toLowerCase()))
    .filter((f) => /^\d{2}-/.test(f)) // only numbered notes: 00-, 01-, ...
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** "01 — Title" / "Pattern 3: Title" → clean display title (no double index) */
function cleanTitle(rawTitle, file) {
  let t = rawTitle.replace(/[#*`]/g, '').trim();
  t = t.replace(/^\d{1,2}\s*[—–\-:.]\s*/u, '');
  t = t.replace(/^Pattern\s+\d+\s*:\s*/i, '');
  t = t.replace(/^Module\s+\d+\s*[—–\-:.]\s*/i, '');
  return t || file;
}

function fileIndex(file) {
  const m = file.match(/^(\d{2})-/);
  return m ? m[1] : null;
}

function stripLeadingH1(markdown) {
  // Avoid repeating the same chapter title under TOC numbering
  return markdown.replace(/^#\s+.+?\n+/, '');
}

function buildBook(files) {
  const toc = [];
  const modules = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(notesDir, file), 'utf8');
    const titleMatch = raw.match(/^#\s+(.+)$/m);
    const index = fileIndex(file);
    const title = cleanTitle(titleMatch ? titleMatch[1] : file, file);
    const id = `ch-${index || file.replace(/\.md$/, '')}`;

    toc.push({ id, index, title, file });

    const bodyMd = stripLeadingH1(raw);
    let html = md.render(bodyMd);
    modules.push(`
<section class="module" id="${id}">
  <h1><span class="num">${index}.</span> ${md.utils.escapeHtml(title)}</h1>
  ${html}
  <div class="module-footer">Chapter ${index} · ${md.utils.escapeHtml(file)}</div>
</section>`);
  }

  const tocHtml = toc
    .map(
      (t) =>
        `<li><span class="num">${t.index}.</span><a href="#${t.id}">${md.utils.escapeHtml(t.title)}</a></li>`
    )
    .join('\n');

  const css = fs.readFileSync(path.join(__dirname, 'handwritten.css'), 'utf8');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${md.utils.escapeHtml(bookTitle)}</title>
  <style>${css}
  h1 .num { color: var(--accent); margin-right: 0.25em; }
  </style>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      securityLevel: 'loose',
      themeVariables: {
        fontFamily: 'Patrick Hand, Caveat, cursive',
        primaryColor: '#fbf7eb',
        primaryTextColor: '#1a1a1a',
        primaryBorderColor: '#1f4e79',
        lineColor: '#1f4e79',
        secondaryColor: '#fff4b8',
        tertiaryColor: '#efe8d8'
      }
    });
  </script>
</head>
<body>
  <section class="cover">
    <div class="stamp">notebook study edition</div>
    <h1 class="hand-title">${md.utils.escapeHtml(bookTitle)}</h1>
    <p class="subtitle">${md.utils.escapeHtml(subtitle)}</p>
    <p class="meta">Ruled copy style · one index per chapter · explanations, diagrams &amp; code</p>
  </section>
  <section class="toc">
    <h1>Contents</h1>
    <ol class="toc-list">
      ${tocHtml}
    </ol>
  </section>
  ${modules.join('\n')}
</body>
</html>`;
}

async function main() {
  const files = listCurriculumFiles(notesDir);
  if (!files.length) throw new Error(`No numbered curriculum markdown in ${notesDir}`);

  const html = buildBook(files);
  const htmlPath = outPdf.replace(/\.pdf$/i, '.html');
  fs.mkdirSync(path.dirname(outPdf), { recursive: true });
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`HTML: ${htmlPath} (${files.length} chapters)`);
  console.log('Chapters:', files.map((f) => fileIndex(f)).join(', '));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
  try {
    await page.waitForFunction(() => document.fonts && document.fonts.status === 'loaded', { timeout: 15000 });
  } catch {}

  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8px;width:100%;padding:0 12mm;color:#666;font-family:Patrick Hand,cursive;">${bookTitle.replace(/[<>&]/g, '')}</div>`,
    footerTemplate: `<div style="font-size:8px;width:100%;padding:0 12mm;color:#666;font-family:Patrick Hand,cursive;display:flex;justify-content:space-between;"><span>notebook notes</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: '12mm', bottom: '14mm', left: '0', right: '0' },
  });
  await browser.close();
  console.log(`PDF: ${outPdf} (${(fs.statSync(outPdf).size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
