#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration – edit these values or set the corresponding env vars
//   SITE_URL   : canonical origin of your site  (required before going live)
//   OUTPUT_DIR : directory that contains your built HTML/asset files
// ---------------------------------------------------------------------------
const CONFIG = {
  siteUrl: process.env.SITE_URL || 'https://example.com', // replace with your real domain
  outputDir: process.env.OUTPUT_DIR || path.resolve(__dirname, 'public'),
  siteName: 'Profitlord',
  siteDescription: 'Lord of profit – your ultimate profit tracking tool.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  Created directory: ${dir}`);
  }
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  Written: ${filePath}`);
}

// ---------------------------------------------------------------------------
// 1. Generate robots.txt
// ---------------------------------------------------------------------------

function generateRobotsTxt(outputDir, siteUrl) {
  const content = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');

  writeFile(path.join(outputDir, 'robots.txt'), content);
}

// ---------------------------------------------------------------------------
// 2. Generate sitemap.xml
//    Scans *.html files in outputDir and builds a <urlset> for each page.
// ---------------------------------------------------------------------------

function collectHtmlFiles(dir, base) {
  const urls = [];
  if (!fs.existsSync(dir)) return urls;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);

    if (entry.isDirectory()) {
      urls.push(...collectHtmlFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const urlPath = '/' + rel.replace(/\\/g, '/').replace(/index\.html$/, '');
      urls.push(urlPath);
    }
  }
  return urls;
}

function generateSitemap(outputDir, siteUrl) {
  const pages = collectHtmlFiles(outputDir, outputDir);

  // Always include the root if no pages were found
  if (pages.length === 0) {
    pages.push('/');
  }

  const now = new Date().toISOString().split('T')[0];

  const urlEntries = pages
    .map(
      (p) => `  <url>\n    <loc>${siteUrl}${p}</loc>\n    <lastmod>${now}</lastmod>\n  </url>`
    )
    .join('\n');

  const content = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntries,
    '</urlset>',
    '',
  ].join('\n');

  writeFile(path.join(outputDir, 'sitemap.xml'), content);
}

// ---------------------------------------------------------------------------
// 3. Inject SEO meta tags into every HTML file that lacks them
// ---------------------------------------------------------------------------

function injectMetaTags(outputDir, siteUrl, siteName, siteDescription) {
  if (!fs.existsSync(outputDir)) return;

  const htmlFiles = collectHtmlFiles(outputDir, outputDir).map((rel) =>
    path.join(outputDir, rel.endsWith('/') ? rel + 'index.html' : rel)
  );

  // Also grab any html files that collectHtmlFiles may have resolved to paths
  // that don't exist on disk (edge case for root '/').
  const existingFiles = htmlFiles.filter((f) => fs.existsSync(f));

  if (existingFiles.length === 0) {
    console.log('  No HTML files found to inject meta tags into.');
    return;
  }

  for (const file of existingFiles) {
    let html = fs.readFileSync(file, 'utf8');

    // Skip if canonical tag already present
    if (html.includes('<link rel="canonical"')) {
      console.log(`  Skipped (already has canonical): ${file}`);
      continue;
    }

    const relPath = '/' + path.relative(outputDir, file).replace(/\\/g, '/').replace(/index\.html$/, '');
    const canonicalUrl = `${siteUrl}${relPath}`;

    const metaTags = [
      `  <meta name="description" content="${siteDescription}">`,
      `  <meta property="og:title" content="${siteName}">`,
      `  <meta property="og:description" content="${siteDescription}">`,
      `  <meta property="og:url" content="${canonicalUrl}">`,
      `  <link rel="canonical" href="${canonicalUrl}">`,
    ].join('\n');

    if (html.includes('</head>')) {
      html = html.replace('</head>', `${metaTags}\n</head>`);
    } else {
      // No </head> tag – prepend meta tags at the top
      html = metaTags + '\n' + html;
    }

    writeFile(file, html);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { siteUrl, outputDir, siteName, siteDescription } = CONFIG;

  console.log('=== Profitlord SEO Deployment ===');
  console.log(`Site URL  : ${siteUrl}`);
  console.log(`Output dir: ${outputDir}`);
  console.log('');

  ensureDir(outputDir);

  console.log('[1/3] Generating robots.txt …');
  generateRobotsTxt(outputDir, siteUrl);

  console.log('[2/3] Generating sitemap.xml …');
  generateSitemap(outputDir, siteUrl);

  console.log('[3/3] Injecting SEO meta tags into HTML files …');
  injectMetaTags(outputDir, siteUrl, siteName, siteDescription);

  console.log('');
  console.log('SEO deployment complete.');
}

main();
