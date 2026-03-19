# Profitlord Library

This folder contains the source markdown files for the Profitlord knowledge library.

## How it works

1. Each `.md` file in this directory becomes a page at `/docs/library/<filename>/index.html`.
2. Run `node deploy-seo.js` (or push to `main`) to regenerate the site.
3. The library index at `/docs/library/index.html` is built automatically.

## Frontmatter (optional)

You can add YAML-like frontmatter at the top of any file to set the title, description, and tags:

```
---
title: My Page Title
description: A short summary shown in search results and meta tags.
tags: profit, systems, discipline
---
```

If you omit frontmatter, the filename is used as the title.

## Adding new notes or books

1. Create a new `.md` file in this folder (e.g., `mindset.md`).
2. Optionally add frontmatter at the top.
3. Write your content using standard Markdown (`#` headings, bullet lists, paragraphs).
4. Push to `main` — the GitHub Action will regenerate and publish everything automatically.
