#!/usr/bin/env node
/**
 * Convert a folder of markdown interview notes into a handwritten-style PDF book.
 * Usage: node build-pdf.mjs <notesDir> <outPdf> <bookTitle> <subtitle>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import hljs from 'highlight.js';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [notesDir, outPdf, bookTitle = 'Interview Notes', subtitle = 'Deep study edition'] = process.argv.slice(2);
if (!notesDir || !outPdf) {
  console.error('Usage: node build-pdf.mjs <notesDir> <outPdf> [title] [subtitle]');
  process.exit(1);
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang === 'mermaid') {
      return `<div class="diagram-frame"><pre class="mermaid">${md.utils.escapeHtml(str)}</pre></div>`;
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
}).use(markdownItAnchor, { level: [1, 2, 3], permalink: false });

function listMarkdownFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function enhanceDiagrams(html) {
  // Mermaid fences only — avoid catastrophic regex on large code blocks
  return html.replace(
    /<pre class="hljs"><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_m, code) => `<div class="diagram-frame"><pre class="mermaid">${code}</pre></div>`
  );
}

function buildBook(files) {
  const toc = [];
  const modules = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(notesDir, file), 'utf8');
    const titleMatch = raw.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].replace(/[#*`]/g, '').trim() : file;
    const id = file.replace(/\.md$/, '');
    toc.push({ id, title, file });
    let html = md.render(raw);
    html = enhanceDiagrams(html);
    modules.push(`<section class="module" id="${id}">${html}<div class="footer-note">Module: ${file} · Keep practicing out loud · Verify APIs against official docs</div></section>`);
  }

  const tocHtml = toc
    .map((t, i) => `<li><a href="#${t.id}">${String(i + 1).padStart(2, '0')}. ${t.title}</a></li>`)
    .join('\n');

  const css = fs.readFileSync(path.join(__dirname, 'handwritten.css'), 'utf8');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${bookTitle}</title>
  <style>${css}</style>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      securityLevel: 'loose',
      themeVariables: {
        fontFamily: 'Kalam, Caveat, comic sans ms, cursive',
        primaryColor: '#f7f1e6',
        primaryTextColor: '#1f1a17',
        primaryBorderColor: '#3a4f7a',
        lineColor: '#b23a2b',
        secondaryColor: '#fff4b8',
        tertiaryColor: '#efe6d6'
      }
    });
    window.__MERMAID_READY__ = mermaid.run ? mermaid.run() : Promise.resolve();
  </script>
</head>
<body>
  <section class="cover">
    <div class="stamp">handwritten study edition</div>
    <h1 class="hand-title">${bookTitle}</h1>
    <p class="subtitle">${subtitle}</p>
    <p class="meta">
      In-depth explanations · diagrams · code · interview drills<br/>
      Generated for focused revision · A4 printable PDF
    </p>
  </section>
  <section class="toc">
    <h1>Contents (your map)</h1>
    <ol>${tocHtml}</ol>
  </section>
  ${modules.join('\n')}
</body>
</html>`;
}

async function main() {
  const files = listMarkdownFiles(notesDir);
  if (!files.length) throw new Error(`No markdown in ${notesDir}`);

  const html = buildBook(files);
  const htmlPath = outPdf.replace(/\.pdf$/i, '.html');
  fs.mkdirSync(path.dirname(outPdf), { recursive: true });
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`Wrote HTML: ${htmlPath} (${files.length} modules)`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle', timeout: 120000 });
  // Wait for fonts + mermaid
  await page.waitForTimeout(2500);
  try {
    await page.waitForFunction(() => document.fonts && document.fonts.status === 'loaded', { timeout: 15000 });
  } catch {}
  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8px;width:100%;padding:0 14mm;color:#7a6a5a;font-family:Kalam,cursive;">${bookTitle}</div>`,
    footerTemplate: `<div style="font-size:8px;width:100%;padding:0 14mm;color:#7a6a5a;font-family:Kalam,cursive;display:flex;justify-content:space-between;"><span>interview study notes</span><span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
    margin: { top: '14mm', bottom: '16mm', left: '0', right: '0' },
  });
  await browser.close();
  const sizeMb = (fs.statSync(outPdf).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote PDF: ${outPdf} (${sizeMb} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
