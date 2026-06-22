const { parseMeasure } = require('./parseMeasure');

const UNIT_PREFIX = new Set([
  'cup',
  'cups',
  'tablespoon',
  'tablespoons',
  'tbsp',
  'teaspoon',
  'teaspoons',
  'tsp',
  'ounce',
  'ounces',
  'oz',
  'fluid',
  'pound',
  'pounds',
  'lb',
  'lbs',
  'gram',
  'grams',
  'g',
  'kg',
  'ml',
  'l',
  'liter',
  'liters',
  'clove',
  'cloves',
  'pinch',
  'dash',
  'can',
  'cans',
  'package',
  'packages',
  'pkg',
  'stalk',
  'stalks',
  'bunch',
  'bunches',
  'slice',
  'slices',
  'piece',
  'pieces',
  'stick',
  'sticks',
  'sheet',
  'sheets',
  'head',
  'heads',
  'ear',
  'ears',
  'sprig',
  'sprigs',
  'cube',
  'cubes',
  'packet',
  'packets',
]);

function normToken(w) {
  return w.replace(/[^a-z]/gi, '').toLowerCase();
}

/**
 * Split a single ingredient line (e.g. from recipeIngredient) into schema fields.
 */
function parseIngredientLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return null;

  const { quantity, unit: afterNum } = parseMeasure(trimmed);
  const tail = (afterNum || '').trim();

  if (!tail) {
    return { name: trimmed.replace(/^[0-9./\s]+/, '').trim() || trimmed, quantity, unit: '' };
  }

  const words = tail.split(/\s+/);
  let i = 0;
  while (
    i < words.length &&
    /^(large|medium|small|fresh|dried|ripe|chopped|diced|minced|sliced)$/i.test(words[i])
  ) {
    i += 1;
  }

  let unit = '';
  if (i < words.length) {
    const w0 = normToken(words[i]);
    const w1 = i + 1 < words.length ? normToken(words[i + 1]) : '';
    if (w0 === 'fluid' && (w1 === 'ounce' || w1 === 'ounces')) {
      unit = `${words[i]} ${words[i + 1]}`;
      i += 2;
    } else if (UNIT_PREFIX.has(w0)) {
      unit = words[i];
      i += 1;
    }
  }

  const name = words.slice(i).join(' ').trim() || tail;
  return { name, quantity, unit };
}

function iso8601DurationToMinutes(s) {
  if (!s || typeof s !== 'string') return 0;
  let mins = 0;
  const d = s.match(/(\d+)D/);
  const h = s.match(/(\d+)H/);
  const m = s.match(/(\d+)M/);
  if (d) mins += parseInt(d[1], 10) * 24 * 60;
  if (h) mins += parseInt(h[1], 10) * 60;
  if (m) mins += parseInt(m[1], 10);
  return mins;
}

function parseYield(yieldVal) {
  if (yieldVal == null) return 1;
  if (typeof yieldVal === 'number' && Number.isFinite(yieldVal)) return Math.max(1, Math.round(yieldVal));
  const s = String(yieldVal);
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (m) return Math.max(1, Math.round(Number(m[1])));
  return 1;
}

function stepText(step) {
  if (step == null) return '';
  if (typeof step === 'string') return step.trim();
  if (typeof step === 'object') {
    if (typeof step.text === 'string') return step.text.trim();
    if (Array.isArray(step.text)) return step.text.map(String).join(' ').trim();
  }
  return '';
}

function normalizeInstructions(instr) {
  if (!instr) return '';
  if (typeof instr === 'string') return instr.trim();

  if (Array.isArray(instr)) {
    const parts = [];
    for (const item of instr) {
      if (typeof item === 'string') {
        parts.push(item.trim());
      } else if (item && typeof item === 'object') {
        const t = item['@type'];
        if (t === 'HowToSection' || t === 'HowToStep') {
          if (t === 'HowToSection') {
            const nested = normalizeInstructions(item.itemListElement);
            if (nested) parts.push(nested);
          } else {
            const st = stepText(item);
            if (st) parts.push(st);
          }
        } else if (Array.isArray(item.itemListElement)) {
          parts.push(normalizeInstructions(item.itemListElement));
        } else {
          const st = stepText(item);
          if (st) parts.push(st);
        }
      }
    }
    return parts.filter(Boolean).join('\n\n');
  }

  if (typeof instr === 'object' && Array.isArray(instr.itemListElement)) {
    const steps = [];
    for (const el of instr.itemListElement) {
      if (el && typeof el === 'object' && el['@type'] === 'HowToStep') {
        const st = stepText(el);
        if (st) steps.push(st);
      } else if (typeof el === 'string') {
        steps.push(el.trim());
      } else if (el && typeof el === 'object' && el.itemListElement) {
        steps.push(normalizeInstructions(el));
      }
    }
    return steps.filter(Boolean).join('\n\n');
  }

  return '';
}

function nutritionCalories(nutrition) {
  if (!nutrition || typeof nutrition !== 'object') return 0;
  const cal = nutrition.calories;
  if (cal == null) return 0;
  const s = String(cal);
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function firstImageUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return firstImageUrl(image[0]);
  if (typeof image === 'object' && typeof image.url === 'string') return image.url;
  return '';
}

function isRecipeNode(node) {
  if (!node || typeof node !== 'object') return false;
  const t = node['@type'];
  if (t === 'Recipe') return true;
  if (Array.isArray(t) && t.includes('Recipe')) return true;
  return false;
}

function flattenJsonLdThings(data, out = []) {
  if (data == null) return out;
  if (Array.isArray(data)) {
    for (const x of data) flattenJsonLdThings(x, out);
    return out;
  }
  if (typeof data === 'object') {
    if (data['@graph']) flattenJsonLdThings(data['@graph'], out);
    else out.push(data);
  }
  return out;
}

/**
 * Extract all application/ld+json script payloads from HTML (may be multiple).
 */
function extractLdJsonScripts(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = (m[1] || '').trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      /* skip invalid JSON */
    }
  }
  return blocks;
}

function findRecipeInBlocks(blocks) {
  for (const block of blocks) {
    const nodes = flattenJsonLdThings(block, []);
    const recipe = nodes.find(isRecipeNode);
    if (recipe) return recipe;
  }
  return null;
}

/**
 * Map schema.org Recipe JSON-LD to our Recipe document fields (without externalId/source).
 */
function jsonLdRecipeToFields(recipe) {
  const title = (recipe.name || '').trim() || 'Untitled';
  const description = (recipe.description || '').trim();
  const instructions = normalizeInstructions(recipe.recipeInstructions) || '';

  const rawIngredients = Array.isArray(recipe.recipeIngredient)
    ? recipe.recipeIngredient
    : [];
  const ingredients = [];
  for (const line of rawIngredients) {
    if (typeof line !== 'string' || !line.trim()) continue;
    const parsed = parseIngredientLine(line);
    if (parsed) ingredients.push(parsed);
  }

  let prepTime = iso8601DurationToMinutes(recipe.prepTime);
  let cookTime = iso8601DurationToMinutes(recipe.cookTime);
  const totalFromSchema = iso8601DurationToMinutes(recipe.totalTime);
  if (!prepTime && !cookTime && totalFromSchema) {
    cookTime = totalFromSchema;
  }

  const servings = parseYield(recipe.recipeYield);
  let calories = nutritionCalories(recipe.nutrition);

  if (!calories && ingredients.length) {
    const base = 200;
    const perIngredient = 60;
    calories = Math.min(base + ingredients.length * perIngredient, 900);
  }

  if (!prepTime && !cookTime) {
    const instrLen = instructions.length;
    const totalTime = Math.min(10 + Math.floor(instrLen / 40), 90);
    prepTime = Math.max(5, Math.round(totalTime * 0.35));
    cookTime = Math.max(5, totalTime - prepTime);
  }

  const imageUrl = firstImageUrl(recipe.image);

  let youtubeUrl = '';
  if (recipe.video) {
    if (typeof recipe.video === 'string') youtubeUrl = recipe.video;
    else if (typeof recipe.video === 'object' && typeof recipe.video.contentUrl === 'string') {
      youtubeUrl = recipe.video.contentUrl;
    } else if (typeof recipe.video === 'object' && typeof recipe.video.embedUrl === 'string') {
      youtubeUrl = recipe.video.embedUrl;
    }
  }

  const keywords = recipe.keywords;
  let tags = [];
  if (Array.isArray(keywords)) {
    tags = keywords.map((k) => String(k).trim()).filter(Boolean);
  } else if (typeof keywords === 'string') {
    tags = keywords
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const category = (recipe.recipeCategory || '').toString().trim();
  const cuisine = (recipe.recipeCuisine || '').toString().trim();
  const area = cuisine || '';

  return {
    title,
    description,
    instructions,
    ingredients,
    prepTime,
    cookTime,
    servings,
    calories,
    tags,
    category,
    area,
    imageUrl,
    youtubeUrl,
  };
}

module.exports = {
  extractLdJsonScripts,
  findRecipeInBlocks,
  jsonLdRecipeToFields,
  parseIngredientLine,
};
