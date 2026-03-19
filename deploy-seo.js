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

/** Escape special HTML characters to prevent broken markup when injecting values into attributes. */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

/**
 * Convert a file path relative to the output root into a URL path.
 * e.g. "about/index.html" -> "/about/"  |  "index.html" -> "/"
 */
function toUrlPath(relativeFilePath) {
  const normalized = relativeFilePath.replace(/\\/g, '/');
  const withoutIndex = normalized.replace(/index\.html$/, '');
  return '/' + withoutIndex;
}

/**
 * Recursively collect all *.html file paths (relative to `base`) under `dir`.
 */
function collectHtmlFiles(dir, base) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

function generateSitemap(outputDir, siteUrl) {
  const relFiles = collectHtmlFiles(outputDir, outputDir);

  // Always include the root if no pages were found
  const now = new Date().toISOString().split('T')[0];

  let urlEntries;
  if (relFiles.length > 0) {
    urlEntries = relFiles
      .map((rel) => {
        const urlPath = toUrlPath(rel);
        const mtime = fs.statSync(path.join(outputDir, rel)).mtime.toISOString().split('T')[0];
        return `  <url>\n    <loc>${siteUrl}${urlPath}</loc>\n    <lastmod>${mtime}</lastmod>\n  </url>`;
      })
      .join('\n');
  } else {
    urlEntries = `  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${now}</lastmod>\n  </url>`;
  }

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

  const relFiles = collectHtmlFiles(outputDir, outputDir);

  if (relFiles.length === 0) {
    console.log('  No HTML files found to inject meta tags into.');
    return;
  }

  for (const rel of relFiles) {
    const file = path.join(outputDir, rel);
    let html = fs.readFileSync(file, 'utf8');

    // Skip if canonical tag already present
    if (html.includes('<link rel="canonical"')) {
      console.log(`  Skipped (already has canonical): ${file}`);
      continue;
    }

    const canonicalUrl = `${siteUrl}${toUrlPath(rel)}`;

    const metaTags = [
      `  <meta name="description" content="${escapeHtml(siteDescription)}">`,
      `  <meta property="og:title" content="${escapeHtml(siteName)}">`,
      `  <meta property="og:description" content="${escapeHtml(siteDescription)}">`,
      `  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
      `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
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

  if (siteUrl === 'https://example.com') {
    console.warn('\nWARNING: SITE_URL is not set. Using placeholder "https://example.com".');
    console.warn('         Set the SITE_URL environment variable before deploying to production.\n');
  } else {
    console.log('');
  }

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
