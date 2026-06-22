/* eslint-disable no-console */
/**
 * Seed script: populates the recipes collection from TheMealDB (free public API).
 * Run with:   npm run seed:recipes
 *
 * Idempotent: it upserts by externalId so you can re-run safely.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Recipe = require('../models/Recipe');
const { parseMeasure } = require('../utils/parseMeasure');

const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

// --- helpers -----------------------------------------------------------

/**
 * Extract the up-to-20 ingredient/measure pairs from a MealDB record.
 */
function extractIngredients(meal) {
  const out = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = (meal[`strIngredient${i}`] || '').trim();
    const measure = (meal[`strMeasure${i}`] || '').trim();
    if (!name) continue;
    const { quantity, unit } = parseMeasure(measure);
    out.push({ name, quantity, unit });
  }
  return out;
}

/**
 * MealDB doesn't provide calories/prep/cook. We derive plausible estimates
 * so downstream features (calorie goal, meal plans) still work.
 */
function estimateNutrition(ingredients, instructions) {
  const base = 200;
  const perIngredient = 60;
  const calories = Math.min(base + ingredients.length * perIngredient, 900);

  const instrLen = (instructions || '').length;
  const totalTime = Math.min(10 + Math.floor(instrLen / 40), 90);
  const prepTime = Math.max(5, Math.round(totalTime * 0.35));
  const cookTime = Math.max(5, totalTime - prepTime);

  return { calories, prepTime, cookTime };
}

function mealToRecipe(meal) {
  const ingredients = extractIngredients(meal);
  const { calories, prepTime, cookTime } = estimateNutrition(
    ingredients,
    meal.strInstructions
  );
  const tags = (meal.strTags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    externalId: `mealdb_${meal.idMeal}`,
    source: 'seed',
    title: meal.strMeal,
    description: '',
    instructions: meal.strInstructions || '',
    ingredients,
    prepTime,
    cookTime,
    servings: 2,
    calories,
    tags,
    category: meal.strCategory || '',
    area: meal.strArea || '',
    imageUrl: meal.strMealThumb || '',
    youtubeUrl: meal.strYoutube || '',
  };
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`);
  return res.json();
}

async function fetchAllMeals() {
  const byId = new Map();
  for (const letter of LETTERS) {
    const url = `${MEALDB_BASE}/search.php?f=${letter}`;
    try {
      const { meals } = await fetchJson(url);
      if (!meals) continue;
      for (const m of meals) {
        if (m.idMeal && !byId.has(m.idMeal)) byId.set(m.idMeal, m);
      }
      process.stdout.write(`\r[seed] fetched letter "${letter}" — total: ${byId.size}   `);
    } catch (err) {
      console.warn(`\n[seed] skipped "${letter}": ${err.message}`);
    }
  }
  process.stdout.write('\n');
  return Array.from(byId.values());
}

/**
 * Assumes mongoose is already connected. Idempotent upsert by externalId.
 */
async function runMealDbSeed({ quiet = false } = {}) {
  if (!quiet) console.log('[seed] downloading recipes from TheMealDB...');
  const meals = await fetchAllMeals();
  if (!quiet) console.log(`[seed] mapping ${meals.length} meals to Recipe schema...`);
  const docs = meals.map(mealToRecipe);

  if (!quiet) console.log('[seed] upserting into MongoDB...');
  let upserted = 0;
  for (const doc of docs) {
    await Recipe.updateOne(
      { externalId: doc.externalId },
      { $set: doc },
      { upsert: true }
    );
    upserted += 1;
    if (!quiet && upserted % 25 === 0) {
      process.stdout.write(`\r[seed] upserted: ${upserted}/${docs.length}   `);
    }
  }
  if (!quiet) process.stdout.write('\n');

  const total = await Recipe.countDocuments({ source: 'seed' });
  if (!quiet) console.log(`[seed] done. seeded recipes in DB: ${total}`);
  return total;
}

// --- main --------------------------------------------------------------

async function main() {
  if (process.env.USE_MEMORY_MONGO === 'true') {
    console.error(
      '[seed] Do not run npm run seed:recipes with USE_MEMORY_MONGO=true (each process gets a new empty DB).'
    );
    console.error(
      '[seed] Use USE_MEMORY_MONGO=false with Docker/Atlas for this script, or start the backend — it auto-seeds an empty in-memory DB.'
    );
    process.exit(1);
  }
  await connectDB();
  await runMealDbSeed({ quiet: false });
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error('[seed] failed:', err);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
}

module.exports = { runMealDbSeed, fetchAllMeals, mealToRecipe };
