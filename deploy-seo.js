#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration – set via env vars or falls back to GitHub Pages defaults
// ---------------------------------------------------------------------------
const CONFIG = {
  siteUrl: process.env.SITE_URL || 'https://uncommonpope-png.github.io/Profitlord',
  outputDir: process.env.OUTPUT_DIR
    ? path.resolve(process.env.OUTPUT_DIR)
    : path.resolve(__dirname, 'docs'),
  siteName: process.env.SITE_NAME || 'Profitlord',
  siteDescription:
    process.env.SITE_DESCRIPTION ||
    'Profitlord — profit tracking, business scoring, and the PLT mindset.',
};

// ---------------------------------------------------------------------------
// Load site-config.json (Stripe + PLT Press links)
// ---------------------------------------------------------------------------
const SITE_CONFIG_PATH = path.resolve(__dirname, 'site-config.json');
let SITE_CONFIG = { pressUrl: '', products: [] };
if (fs.existsSync(SITE_CONFIG_PATH)) {
  try {
    SITE_CONFIG = JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.warn('Warning: could not parse site-config.json:', e.message);
  }
}

// Global search index – accumulated during build, written to search.json
const SEARCH_INDEX = [];

// ---------------------------------------------------------------------------
// 50+ keywords
// ---------------------------------------------------------------------------
const KEYWORDS = [
  'profit tracking',
  'business scoring system',
  'PLT framework',
  'profit love tax',
  'entrepreneur decision making',
  'cashflow planning',
  'budgeting for entrepreneurs',
  'pricing strategy',
  'sales pipeline tracking',
  'customer lifetime value',
  'unit economics',
  'gross margin optimization',
  'expense control',
  'forecasting model',
  'daily profit dashboard',
  'weekly business review',
  'business KPI tracker',
  'startup finance basics',
  'small business profit tools',
  'profit mindset',
  'tax planning basics',
  'business negotiation',
  'deal evaluation framework',
  'opportunity scoring',
  'risk reward analysis',
  'time leverage strategy',
  'relationship capital',
  'brand trust compounding',
  'systems thinking for business',
  'operational excellence',
  'profit first method',
  'cash reserve strategy',
  'pricing psychology',
  'value based pricing',
  'offer design',
  'conversion rate optimization',
  'landing page copy',
  'SEO for entrepreneurs',
  'content marketing strategy',
  'sitemap and robots',
  'canonical URL',
  'open graph tags',
  'meta description',
  'google indexing basics',
  'business analytics',
  'revenue tracking',
  'profit projection',
  'financial discipline',
  'entrepreneur toolkit',
  'profitlord app',
  'profitlord dashboard',
  'passive income strategy',
  'return on investment',
  'business growth hacks',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  Written: ${filePath}`);
}

function isoDate() {
  return new Date().toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// PLT Press + Stripe block – appears on every page
// ---------------------------------------------------------------------------

function pltBlock() {
  const pressUrl = SITE_CONFIG.pressUrl || '';
  const products = SITE_CONFIG.products || [];
  const pressLink = pressUrl
    ? `<p><a href="${escapeHtml(pressUrl)}">&#128218; Visit PLT Press</a> — books and frameworks for entrepreneurs.</p>`
    : '';
  const buyBtns = products
    .map(
      (p) =>
        `<a class="buy-btn" href="${escapeHtml(p.url)}">${escapeHtml(p.name || 'Buy Now')}</a>`
    )
    .join('\n      ');
  return `<div class="plt-block">
  <h3>Get the Books</h3>
  ${pressLink}
  <div class="buy-buttons">
    ${buyBtns || '<p>No products configured.</p>'}
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Page template
// ---------------------------------------------------------------------------

function pageHtml({ title, description, canonicalPath, bodyHtml }) {
  const canonical = `${CONFIG.siteUrl}${canonicalPath}`;
  const su = escapeHtml(CONFIG.siteUrl);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:type" content="website" />
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:40px auto;max-width:900px;line-height:1.6;color:#1a1a1a;padding:0 16px}
    a{color:#0b5fff}
    header{margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #eee}
    h1{margin-bottom:4px}
    .tag{display:inline-block;padding:3px 10px;border-radius:999px;background:#f2f2f2;margin:2px 6px 2px 0;font-size:14px}
    footer{margin-top:48px;padding-top:16px;border-top:1px solid #eee;color:#666;font-size:13px}
    code{background:#f6f6f6;padding:2px 6px;border-radius:6px;font-size:13px}
    ul{line-height:2}
    .plt-block{background:#f9f5ff;border:1px solid #e0d5f5;border-radius:8px;padding:20px 24px;margin:40px 0}
    .plt-block h3{margin:0 0 8px}
    .buy-buttons{margin-top:12px}
    .buy-btn{display:inline-block;background:#6c3fff;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:bold;margin:6px 10px 6px 0}
    .buy-btn:hover{background:#5533dd}
    .search-wrap{margin:24px 0}
    #search-input{width:100%;padding:10px 14px;font-size:16px;border:1.5px solid #ccc;border-radius:8px;box-sizing:border-box}
    #search-results{list-style:none;padding:0;margin:8px 0}
    #search-results li{padding:8px 0;border-bottom:1px solid #f0f0f0}
    .product-list{list-style:none;padding:0}
    .product-list li{padding:16px 0;border-bottom:1px solid #eee}
  </style>
</head>
<body>
<header>
  <h1>${escapeHtml(CONFIG.siteName)}</h1>
  <p>${escapeHtml(CONFIG.siteDescription)}</p>
  <p>
    <a href="${su}/">Home</a> &middot;
    <a href="${su}/library/">Library</a> &middot;
    <a href="${su}/products/">Products</a> &middot;
    <a href="${su}/sitemap.xml">Sitemap</a>
  </p>
</header>

${bodyHtml}

${pltBlock()}

<footer>
  Generated by <code>deploy-seo.js</code> on ${isoDate()}.
</footer>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Simple Markdown parser (no external dependencies)
// Supports: YAML-like frontmatter, # headings, bullet lists, paragraphs
// ---------------------------------------------------------------------------

function parseFrontmatter(text) {
  const fm = { title: '', description: '', tags: [] };
  let body = text;
  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n([\s\S]*)$/);
  if (match) {
    const yamlBlock = match[1];
    body = match[2];
    for (const line of yamlBlock.split('\n')) {
      const kv = line.match(/^(\w+):[ \t]*(.*)$/);
      if (!kv) continue;
      const [, key, val] = kv;
      const v = val.trim();
      if (key === 'title') fm.title = v;
      else if (key === 'description') fm.description = v;
      else if (key === 'tags') fm.tags = v.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }
  return { fm, body };
}

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${escapeHtml(line.slice(4).trim())}</h3>`);
    } else if (line.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${escapeHtml(line.slice(3).trim())}</h2>`);
    } else if (line.startsWith('# ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h1>${escapeHtml(line.slice(2).trim())}</h1>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`  <li>${escapeHtml(line.slice(2).trim())}</li>`);
    } else if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${escapeHtml(line.trim())}</p>`);
    }
  }

  if (inList) out.push('</ul>');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Inline search script (embedded in home + library index)
// ---------------------------------------------------------------------------

function searchScript(pagesData) {
  // Embed pages JSON inline so search works with no server/fetch needed.
  // URLs in pagesData are relative paths (e.g. /library/profit/).
  // Build absolute links using site URL embedded at generation time.
  const su = CONFIG.siteUrl;
  const json = JSON.stringify(pagesData);
  return `<div class="search-wrap">
  <input type="search" id="search-input" placeholder="Search pages\u2026" oninput="runSearch(this.value)" />
  <ul id="search-results"></ul>
</div>
<script>
var PAGES = ${json};
var SITE = '${su}';
function runSearch(q) {
  var r = document.getElementById('search-results');
  if (!q.trim()) { r.innerHTML = ''; return; }
  q = q.toLowerCase();
  var hits = PAGES.filter(function(p) {
    return (p.title + ' ' + p.description + ' ' + (p.tags || []).join(' ')).toLowerCase().indexOf(q) !== -1;
  });
  r.innerHTML = hits.slice(0, 20).map(function(p) {
    return '<li><a href="' + SITE + p.url + '">' + p.title + '</a><br><small>' + p.description + '</small></li>';
  }).join('');
}
</script>`;
}

// ---------------------------------------------------------------------------
// Build home page
// ---------------------------------------------------------------------------

function buildHome() {
  const links = KEYWORDS.map((k) => {
    const slug = slugify(k);
    return `  <li><a href="${escapeHtml(`${CONFIG.siteUrl}/seo/${slug}/`)}">${escapeHtml(k)}</a></li>`;
  }).join('\n');

  const bodyHtml = `<h2>Search</h2>
${searchScript(SEARCH_INDEX)}

<h2>SEO Library</h2>
<p>Auto-generated pages designed to rank and route attention. &mdash;
  <a href="${escapeHtml(CONFIG.siteUrl)}/library/">Browse the Knowledge Library</a> &middot;
  <a href="${escapeHtml(CONFIG.siteUrl)}/products/">View Products</a>
</p>
<ul>
${links}
</ul>`;

  writeFile(
    path.join(CONFIG.outputDir, 'index.html'),
    pageHtml({
      title: `${CONFIG.siteName} — Home`,
      description: CONFIG.siteDescription,
      canonicalPath: '/',
      bodyHtml,
    })
  );
}

// ---------------------------------------------------------------------------
// Build keyword pages
// ---------------------------------------------------------------------------

function buildKeywordPages() {
  for (const k of KEYWORDS) {
    const slug = slugify(k);
    const canonicalPath = `/seo/${slug}/`;
    const title = `${k} — ${CONFIG.siteName}`;
    const description = `Learn about ${k} with a practical framework. Built for entrepreneurs who want clear decisions and clean profit.`;

    const tags = ['Profit', 'Systems', 'Decision', 'Discipline', 'Leverage', 'Focus']
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join('');

    const bodyHtml = `<h2>${escapeHtml(k)}</h2>
<p>${escapeHtml(description)}</p>

<h3>What it means</h3>
<p>${escapeHtml(k)} is a lever. If you can measure it, you can improve it. Every entrepreneur who masters ${escapeHtml(k)} gains a durable edge.</p>

<h3>How Profitlord uses it</h3>
<ol>
  <li>Track the number.</li>
  <li>Compare it over time.</li>
  <li>Attach actions to outcomes.</li>
</ol>

<h3>Key ideas</h3>
<div>${tags}</div>

<p><a href="${escapeHtml(CONFIG.siteUrl)}/">&larr; Back to Home</a></p>`;

    writeFile(
      path.join(CONFIG.outputDir, 'seo', slug, 'index.html'),
      pageHtml({ title, description, canonicalPath, bodyHtml })
    );

    SEARCH_INDEX.push({
      title,
      url: canonicalPath,
      description,
      tags: ['Profit', 'Systems', 'Decision', 'Discipline', 'Leverage', 'Focus'],
    });
  }
}

// ---------------------------------------------------------------------------
// Build library pages from library/*.md
// ---------------------------------------------------------------------------

function buildLibraryMarkdownPages() {
  const libraryDir = path.resolve(__dirname, 'library');
  if (!fs.existsSync(libraryDir)) {
    console.log('  No library/ directory found, skipping library build.');
    return [];
  }

  const mdFiles = fs.readdirSync(libraryDir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort();

  const libPages = [];

  for (const file of mdFiles) {
    const slug = file.replace(/\.md$/, '');
    const text = fs.readFileSync(path.join(libraryDir, file), 'utf8');
    const { fm, body } = parseFrontmatter(text);

    const title = fm.title || (slug.charAt(0).toUpperCase() + slug.slice(1));
    const description = fm.description || `Profitlord library: ${title}`;
    const tags = fm.tags.length ? fm.tags : [slug];
    const canonicalPath = `/library/${slug}/`;

    const contentHtml = markdownToHtml(body);
    const tagsHtml = tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(' ');

    const bodyHtml = `${contentHtml}
<p>${tagsHtml}</p>
<p><a href="${escapeHtml(CONFIG.siteUrl)}/library/">&larr; Back to Library</a></p>`;

    writeFile(
      path.join(CONFIG.outputDir, 'library', slug, 'index.html'),
      pageHtml({
        title: `${title} — ${CONFIG.siteName}`,
        description,
        canonicalPath,
        bodyHtml,
      })
    );

    libPages.push({ title, url: canonicalPath, description, tags, slug });

    SEARCH_INDEX.push({
      title: `${title} — ${CONFIG.siteName}`,
      url: canonicalPath,
      description,
      tags,
    });
  }

  return libPages;
}

function buildLibraryIndex(libPages) {
  const su = escapeHtml(CONFIG.siteUrl);
  const listHtml = libPages
    .map((p) => {
      const tagsHtml = p.tags
        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
        .join(' ');
      return `  <li>
    <a href="${su}${escapeHtml(p.url)}">${escapeHtml(p.title)}</a> ${tagsHtml}<br>
    <small>${escapeHtml(p.description)}</small>
  </li>`;
    })
    .join('\n');

  const bodyHtml = `<h2>Knowledge Library</h2>
<p>Frameworks, strategies, and systems from Profitlord. Each page is a building block.</p>

${searchScript(SEARCH_INDEX)}

<ul>
${listHtml}
</ul>
<p><a href="${su}/">&larr; Back to Home</a></p>`;

  writeFile(
    path.join(CONFIG.outputDir, 'library', 'index.html'),
    pageHtml({
      title: `Library — ${CONFIG.siteName}`,
      description:
        'Explore the Profitlord knowledge library: profit systems, offer design, and business frameworks.',
      canonicalPath: '/library/',
      bodyHtml,
    })
  );
}

// ---------------------------------------------------------------------------
// Build products page
// ---------------------------------------------------------------------------

function buildProductsPage() {
  const products = SITE_CONFIG.products || [];
  const pressUrl = SITE_CONFIG.pressUrl || '';
  const su = escapeHtml(CONFIG.siteUrl);

  const productListHtml = products
    .map((p, i) => {
      const name = escapeHtml(p.name || `Product ${i + 1}`);
      const url = escapeHtml(p.url);
      return `  <li>
    <strong>${name}</strong><br>
    <a class="buy-btn" href="${url}">Buy Now</a>
  </li>`;
    })
    .join('\n');

  const bodyHtml = `<h2>Products</h2>
${pressUrl ? `<p>Available on <a href="${escapeHtml(pressUrl)}">PLT Press</a>.</p>` : ''}
<ul class="product-list">
${productListHtml}
</ul>
<p><a href="${su}/">&larr; Back to Home</a></p>`;

  writeFile(
    path.join(CONFIG.outputDir, 'products', 'index.html'),
    pageHtml({
      title: `Products — ${CONFIG.siteName}`,
      description: 'Profitlord products: books, frameworks, and tools for entrepreneurs.',
      canonicalPath: '/products/',
      bodyHtml,
    })
  );

  SEARCH_INDEX.push({
    title: `Products — ${CONFIG.siteName}`,
    url: '/products/',
    description: 'Profitlord products: books, frameworks, and tools for entrepreneurs.',
    tags: ['products', 'buy', 'books', 'stripe'],
  });
}

// ---------------------------------------------------------------------------
// Build search.json
// ---------------------------------------------------------------------------

function buildSearchJson() {
  writeFile(
    path.join(CONFIG.outputDir, 'search.json'),
    JSON.stringify(SEARCH_INDEX, null, 2)
  );
}

// ---------------------------------------------------------------------------

function collectHtmlUrls(rootDir) {
  const urls = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        const rel = path.relative(rootDir, full).replace(/\\/g, '/');
        const urlPath = rel === 'index.html' ? '/' : '/' + rel.replace(/index\.html$/, '');
        urls.push(urlPath);
      }
    }
  }

  if (fs.existsSync(rootDir)) walk(rootDir);
  return Array.from(new Set(urls)).sort();
}

function buildSitemap() {
  const pages = collectHtmlUrls(CONFIG.outputDir);
  const lastmod = isoDate();

  const urlEntries = pages
    .map(
      (p) => `  <url>\n    <loc>${CONFIG.siteUrl}${p}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
    )
    .join('\n');

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

  writeFile(path.join(CONFIG.outputDir, 'sitemap.xml'), content);
}

// ---------------------------------------------------------------------------
// Build robots.txt
// ---------------------------------------------------------------------------

function buildRobots() {
  const content = `User-agent: *
Allow: /

Sitemap: ${CONFIG.siteUrl}/sitemap.xml
`;
  writeFile(path.join(CONFIG.outputDir, 'robots.txt'), content);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { siteUrl, outputDir } = CONFIG;

  console.log('=== Profitlord Master Build ===');
  console.log(`Site URL  : ${siteUrl}`);
  console.log(`Output dir: ${outputDir}`);
  console.log('');

  ensureDir(outputDir);

  console.log('[1/8] Building keyword pages …');
  buildKeywordPages();

  console.log('[2/8] Building library markdown pages …');
  const libPages = buildLibraryMarkdownPages();

  console.log('[3/8] Building products page …');
  buildProductsPage();

  // Add static entries for pages that have search UIs (home + library index)
  // These are added to SEARCH_INDEX before generating the pages so the
  // embedded search data is complete.
  SEARCH_INDEX.push({
    title: `${CONFIG.siteName} — Home`,
    url: '/',
    description: CONFIG.siteDescription,
    tags: ['home', 'profit', 'seo', 'profitlord'],
  });
  SEARCH_INDEX.push({
    title: `Library — ${CONFIG.siteName}`,
    url: '/library/',
    description:
      'Explore the Profitlord knowledge library: profit systems, offer design, and business frameworks.',
    tags: ['library', 'knowledge', 'systems'],
  });

  console.log('[4/8] Building library index …');
  buildLibraryIndex(libPages);

  console.log('[5/8] Building home page …');
  buildHome();

  console.log('[6/8] Building search.json …');
  buildSearchJson();

  console.log('[7/8] Building sitemap.xml …');
  buildSitemap();

  console.log('[8/8] Building robots.txt …');
  buildRobots();

  const totalPages = KEYWORDS.length + libPages.length + 1 /* products */ + 1 /* library index */ + 1 /* home */;
  console.log('');
  console.log('✅ Build complete.');
  console.log(`   Pages generated : ${totalPages}`);
  console.log(`   Library pages   : ${libPages.length}`);
  console.log(`   Output directory: ${outputDir}`);
  console.log(`   Sitemap         : ${path.join(outputDir, 'sitemap.xml')}`);
  console.log(`   Robots          : ${path.join(outputDir, 'robots.txt')}`);
  console.log(`   Search index    : ${path.join(outputDir, 'search.json')}`);
}

main();
