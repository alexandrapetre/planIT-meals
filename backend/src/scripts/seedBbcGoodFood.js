/* eslint-disable no-console */
/**
 * Seed / import recipes from BBC Good Food pages by parsing JSON-LD (schema.org Recipe).
 *
 * Usage:
 *   BBCGOODFOOD_URLS="https://www.bbcgoodfood.com/recipes/mexican-chicken-casserole,..." npm run seed:bbcgoodfood
 *   npm run seed:bbcgoodfood -- https://www.bbcgoodfood.com/recipes/mexican-chicken-casserole
 *
 * Optional: BBCGOODFOOD_HTML=/path/to/saved.html (single file; uses first URL for externalId slug)
 *
 * Idempotent: upserts by externalId bbcgoodfood_<slug>.
 *
 * Note: Many collection pages on bbcgoodfood.com/recipes are not single recipes — use direct
 * recipe URLs (e.g. /recipes/mexican-chicken-casserole). Premium/app-only recipes may block fetch.
 * Respect site terms and robots.txt for your use case.
 */

require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Recipe = require('../models/Recipe');
const {
  extractLdJsonScripts,
  findRecipeInBlocks,
  jsonLdRecipeToFields,
} = require('../utils/allRecipesJsonLd');
const { fetchHtml: fetchHtmlPage, DEFAULT_UA } = require('../utils/fetchHtml');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugFromUrl(url) {
  const m = String(url).match(/bbcgoodfood\.com\/recipes\/([^/?#]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function collectUrls() {
  const fromEnv = (process.env.BBCGOODFOOD_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fromArgv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const set = new Set([...fromEnv, ...fromArgv]);
  return Array.from(set);
}

async function fetchHtml(url) {
  return fetchHtmlPage(url, {
    userAgent: process.env.BBCGOODFOOD_USER_AGENT || DEFAULT_UA,
  });
}

async function upsertFromHtml(html, urlForId) {
  const blocks = extractLdJsonScripts(html);
  const recipeLd = findRecipeInBlocks(blocks);
  if (!recipeLd) {
    return { ok: false, reason: 'no Recipe JSON-LD' };
  }

  const fields = jsonLdRecipeToFields(recipeLd);
  const slug =
    (urlForId && slugFromUrl(urlForId)) ||
    (recipeLd.url && slugFromUrl(recipeLd.url)) ||
    (typeof recipeLd['@id'] === 'string' && slugFromUrl(recipeLd['@id'])) ||
    fields.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    'unknown';

  const doc = {
    ...fields,
    externalId: `bbcgoodfood_${slug}`,
    source: 'seed',
  };

  await Recipe.updateOne({ externalId: doc.externalId }, { $set: doc }, { upsert: true });
  return { ok: true, doc };
}

async function main() {
  const urls = collectUrls();
  const htmlPath = process.env.BBCGOODFOOD_HTML;

  if (!urls.length && !htmlPath) {
    console.error(
      '[bbcgoodfood] Set BBCGOODFOOD_URLS (comma-separated) or pass recipe URLs as CLI args,\n' +
        '  e.g. npm run seed:bbcgoodfood -- https://www.bbcgoodfood.com/recipes/mexican-chicken-casserole\n' +
        '  Or use BBCGOODFOOD_HTML for a saved page.'
    );
    process.exit(1);
  }

  if (process.env.USE_MEMORY_MONGO === 'true') {
    console.error(
      '[bbcgoodfood] Turn off USE_MEMORY_MONGO for this script (CLI uses a separate process from the running server).'
    );
    process.exit(1);
  }

  await connectDB();

  const delayMs = Math.max(0, parseInt(process.env.BBCGOODFOOD_DELAY_MS || '1000', 10) || 0);
  let ok = 0;
  let failed = 0;

  if (htmlPath) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const result = await upsertFromHtml(html, urls[0]);
    if (!result.ok) {
      console.error('[bbcgoodfood] No Recipe JSON-LD found in', htmlPath);
      failed += 1;
    } else {
      console.log('[bbcgoodfood] upserted', result.doc.externalId, result.doc.title);
      ok += 1;
    }
  }

  for (const url of urls) {
    if (htmlPath) break;

    const slug = slugFromUrl(url);
    if (!slug) {
      console.warn('[bbcgoodfood] skip (expected bbcgoodfood.com/recipes/<slug>):', url);
      failed += 1;
      continue;
    }

    try {
      const html = await fetchHtml(url);
      const result = await upsertFromHtml(html, url);
      if (!result.ok) {
        console.warn('[bbcgoodfood]', result.reason, url);
        failed += 1;
      } else {
        console.log('[bbcgoodfood] upserted', result.doc.externalId, result.doc.title);
        ok += 1;
      }
    } catch (e) {
      console.error('[bbcgoodfood] failed', url, e.message || e);
      failed += 1;
    }

    if (delayMs) await sleep(delayMs);
  }

  const totalSeed = await Recipe.countDocuments({ source: 'seed' });
  console.log(
    `[bbcgoodfood] done. imported this run: ${ok}, failed: ${failed}, total seed recipes: ${totalSeed}`
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[bbcgoodfood] fatal:', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
