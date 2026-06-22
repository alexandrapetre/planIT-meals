/* eslint-disable no-console */
/**
 * Seed / import recipes from AllRecipes recipe pages by parsing JSON-LD (schema.org Recipe).
 *
 * Usage:
 *   ALLRECIPES_URLS="https://www.allrecipes.com/recipe/123/slug/,https://..." npm run seed:allrecipes
 *   npm run seed:allrecipes -- https://www.allrecipes.com/recipe/123/slug/
 *
 * Optional: ALLRECIPES_HTML=/path/to/saved.html (single file; uses first URL only for externalId)
 *
 * Idempotent: upserts by externalId allrecipes_<numericId>.
 *
 * Note: AllRecipes may block automated requests from some networks; if fetch fails, save the page
 * HTML locally and use ALLRECIPES_HTML. Respect site terms and robots.txt for your use case.
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

function allRecipesIdFromUrl(url) {
  const m = String(url).match(/\/recipe\/(\d+)\//i);
  return m ? m[1] : null;
}

function collectUrls() {
  const fromEnv = (process.env.ALLRECIPES_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fromArgv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const set = new Set([...fromEnv, ...fromArgv]);
  return Array.from(set);
}

async function fetchHtml(url) {
  return fetchHtmlPage(url, {
    userAgent: process.env.ALLRECIPES_USER_AGENT || DEFAULT_UA,
  });
}

async function main() {
  const urls = collectUrls();
  const htmlPath = process.env.ALLRECIPES_HTML;

  if (!urls.length && !htmlPath) {
    console.error(
      '[allrecipes] Set ALLRECIPES_URLS (comma-separated) or pass URLs as CLI args, or ALLRECIPES_HTML for a saved file.'
    );
    process.exit(1);
  }

  if (process.env.USE_MEMORY_MONGO === 'true') {
    console.error(
      '[allrecipes] Turn off USE_MEMORY_MONGO for this script (CLI uses a separate process from the running server).'
    );
    process.exit(1);
  }

  await connectDB();

  const delayMs = Math.max(0, parseInt(process.env.ALLRECIPES_DELAY_MS || '750', 10) || 0);
  let ok = 0;
  let failed = 0;

  if (htmlPath) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const blocks = extractLdJsonScripts(html);
    const recipeLd = findRecipeInBlocks(blocks);
    if (!recipeLd) {
      console.error('[allrecipes] No Recipe JSON-LD found in', htmlPath);
      failed += 1;
    } else {
      const fields = jsonLdRecipeToFields(recipeLd);
      const id =
        (urls[0] && allRecipesIdFromUrl(urls[0])) ||
        (recipeLd.url && allRecipesIdFromUrl(recipeLd.url)) ||
        (typeof recipeLd['@id'] === 'string' && allRecipesIdFromUrl(recipeLd['@id'])) ||
        'unknown';
      const doc = {
        ...fields,
        externalId: `allrecipes_${id}`,
        source: 'seed',
      };
      await Recipe.updateOne({ externalId: doc.externalId }, { $set: doc }, { upsert: true });
      console.log('[allrecipes] upserted', doc.externalId, doc.title);
      ok += 1;
    }
  }

  for (const url of urls) {
    if (htmlPath) break;
    const id = allRecipesIdFromUrl(url);
    if (!id) {
      console.warn('[allrecipes] skip (not an allrecipes.com/recipe/<id>/ URL):', url);
      failed += 1;
      continue;
    }

    try {
      const html = await fetchHtml(url);
      const blocks = extractLdJsonScripts(html);
      const recipeLd = findRecipeInBlocks(blocks);
      if (!recipeLd) {
        console.warn('[allrecipes] no Recipe JSON-LD in page:', url);
        failed += 1;
      } else {
        const fields = jsonLdRecipeToFields(recipeLd);
        const doc = {
          ...fields,
          externalId: `allrecipes_${id}`,
          source: 'seed',
        };
        await Recipe.updateOne({ externalId: doc.externalId }, { $set: doc }, { upsert: true });
        console.log('[allrecipes] upserted', doc.externalId, doc.title);
        ok += 1;
      }
    } catch (e) {
      console.error('[allrecipes] failed', url, e.message || e);
      failed += 1;
    }

    if (delayMs) await sleep(delayMs);
  }

  const totalSeed = await Recipe.countDocuments({ source: 'seed' });
  console.log(`[allrecipes] done. imported this run: ${ok}, failed: ${failed}, total seed recipes: ${totalSeed}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[allrecipes] fatal:', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
