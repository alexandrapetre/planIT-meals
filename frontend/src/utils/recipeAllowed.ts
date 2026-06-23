/**
 * Client-side mirror of the backend's isRecipeAllowed() logic in aiPlanner.js.
 * Keep the rule sets in sync with the backend when updating dietary rules.
 */
import type { Recipe, UserPreferences } from '../types';

const EXCLUDED_CATEGORIES = ['Dessert', 'Side'];
const TREAT_EXCLUDE_PATTERNS = [/chocolate/i, /\bcakes?\b/i];

const DIETARY_RULES: Record<string, { categories: string[]; ingredientPatterns: RegExp[] }> = {
  vegetarian: {
    categories: ['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood'],
    ingredientPatterns: [/chicken/i, /beef/i, /pork/i, /lamb/i, /bacon/i, /ham\b/i, /veal/i, /turkey/i, /duck/i, /sausage/i, /anchov/i, /fish/i, /shrimp/i, /prawn/i, /salmon/i, /tuna/i],
  },
  vegan: {
    categories: ['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood'],
    ingredientPatterns: [
      /chicken/i, /beef/i, /pork/i, /lamb/i, /bacon/i, /ham\b/i, /veal/i, /turkey/i, /duck/i, /sausage/i, /anchov/i, /fish/i, /shrimp/i, /prawn/i, /salmon/i, /tuna/i,
      /\bmilk\b/i, /cheese/i, /butter/i, /cream/i, /yogurt/i, /egg/i, /honey/i, /gelatin/i, /whey/i, /casein/i,
    ],
  },
  glutenFree: {
    categories: ['Pasta'],
    ingredientPatterns: [/flour/i, /\bbread\b/i, /pasta/i, /wheat/i, /\brye\b/i, /barley/i, /couscous/i, /noodle/i, /spaghetti/i, /lasagn/i],
  },
  lactoseFree: {
    categories: [],
    ingredientPatterns: [/\bmilk\b/i, /cheese/i, /butter/i, /cream/i, /yogurt/i, /whey/i, /casein/i],
  },
  keto: {
    categories: ['Pasta'],
    ingredientPatterns: [/sugar/i, /pasta/i, /\brice\b/i, /potato/i, /\bbread\b/i, /flour/i],
  },
  lowCarb: {
    categories: ['Pasta'],
    ingredientPatterns: [/pasta/i, /\brice\b/i, /potato/i, /\bbread\b/i],
  },
  mediterranean: { categories: [], ingredientPatterns: [] },
};

const ALLERGY_PATTERNS: Record<string, RegExp[]> = {
  nuts: [/almond/i, /cashew/i, /hazelnut/i, /pecan/i, /pistachio/i, /walnut/i, /\bnut\b/i],
  peanuts: [/peanut/i],
  eggs: [/\begg/i],
  soy: [/\bsoy/i, /tofu/i, /edamame/i, /tempeh/i],
  fish: [/\bfish\b/i, /salmon/i, /tuna/i, /cod\b/i, /anchov/i, /sardine/i, /trout/i, /mackerel/i, /halibut/i],
  shellfish: [/shrimp/i, /prawn/i, /crab/i, /lobster/i, /oyster/i, /clam/i, /mussel/i, /scallop/i, /squid/i, /octopus/i],
  sesame: [/sesame/i, /tahini/i],
};

function anyMatch(patterns: RegExp[], text: string): boolean {
  return patterns.some((re) => re.test(text));
}

function recipeMatchesPatterns(recipe: Recipe, patterns: RegExp[]): boolean {
  if (!patterns.length) return false;
  if (anyMatch(patterns, recipe.title ?? '')) return true;
  if (anyMatch(patterns, (recipe.tags ?? []).join(' '))) return true;
  return (recipe.ingredients ?? []).some((ing) => anyMatch(patterns, ing.name ?? ''));
}

export function isRecipeAllowed(recipe: Recipe, prefs: UserPreferences | undefined): boolean {
  if (!recipe) return false;

  const category = recipe.category ?? '';
  if (EXCLUDED_CATEGORIES.includes(category)) return false;
  if (recipeMatchesPatterns(recipe, TREAT_EXCLUDE_PATTERNS)) return false;

  const restrictions = prefs?.dietaryRestrictions ?? [];
  const allergies = prefs?.allergies ?? [];

  const blockedCategories = new Set<string>();
  const blockedPatterns: RegExp[] = [];

  for (const key of restrictions) {
    const rule = DIETARY_RULES[key];
    if (!rule) continue;
    rule.categories.forEach((c) => blockedCategories.add(c));
    blockedPatterns.push(...rule.ingredientPatterns);
  }

  if (blockedCategories.has(category)) return false;
  if (recipeMatchesPatterns(recipe, blockedPatterns)) return false;

  for (const key of allergies) {
    const patterns = ALLERGY_PATTERNS[key];
    if (patterns && recipeMatchesPatterns(recipe, patterns)) return false;
  }

  return true;
}
