const asyncHandler = require('express-async-handler');
const FridgeItem = require('../models/FridgeItem');
const Recipe = require('../models/Recipe');
const { shoppingMergeContribution } = require('../utils/ingredientShoppingKey');

// GET /api/fridge
const getFridge = asyncHandler(async (req, res) => {
  const items = await FridgeItem.find({ user: req.user._id }).sort({ name: 1 });
  res.json(items);
});

// POST /api/fridge
// If an item with the same name already exists, the quantity is incremented.
const addFridgeItem = asyncHandler(async (req, res) => {
  const { name, quantity = 1, unit = 'pcs', category = 'other', expiresAt } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('Product name is required.');
  }

  const normalized = name.trim().toLowerCase();
  const existing = await FridgeItem.findOne({ user: req.user._id, name: normalized });

  if (existing) {
    existing.quantity += Number(quantity) || 1;
    if (expiresAt) existing.expiresAt = expiresAt;
    const updated = await existing.save();
    return res.status(200).json(updated);
  }

  const item = await FridgeItem.create({
    user: req.user._id,
    name: normalized,
    quantity,
    unit,
    category,
    expiresAt,
  });
  res.status(201).json(item);
});

// PUT /api/fridge/:id
const updateFridgeItem = asyncHandler(async (req, res) => {
  const item = await FridgeItem.findById(req.params.id);
  if (!item || item.user.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Product not found.');
  }
  Object.assign(item, req.body);
  if (req.body.name) item.name = req.body.name.trim().toLowerCase();
  const updated = await item.save();
  res.json(updated);
});

// DELETE /api/fridge/:id
const deleteFridgeItem = asyncHandler(async (req, res) => {
  const item = await FridgeItem.findById(req.params.id);
  if (!item || item.user.toString() !== req.user._id.toString()) {
    res.status(404);
    throw new Error('Product not found.');
  }
  await item.deleteOne();
  res.json({ message: 'Product removed from fridge.' });
});

// GET /api/fridge/suggestions
// Returns recipes ordered by how many ingredients are already in the fridge.
// Uses unit conversion to match ingredients intelligently (e.g., cups to grams).
const getSuggestions = asyncHandler(async (req, res) => {
  const fridgeItems = await FridgeItem.find({ user: req.user._id });

  if (fridgeItems.length === 0) {
    return res.json([]);
  }

  // Build a map of fridge items using the shopping merge key system
  // This converts all quantities to base units (grams, ml, count, etc.)
  const fridgeMap = new Map();
  for (const item of fridgeItems) {
    const { key, delta } = shoppingMergeContribution(
      item.name,
      item.quantity || 0,
      item.unit || 'pcs'
    );
    fridgeMap.set(key, (fridgeMap.get(key) || 0) + delta);
  }

  const recipes = await Recipe.find();
  const scored = recipes
    .map((recipe) => {
      const total = recipe.ingredients.length || 1;
      let owned = 0;
      const missing = [];

      // Check each ingredient against fridge using merge keys
      for (const ing of recipe.ingredients) {
        const { key } = shoppingMergeContribution(
          ing.name,
          1, // just check if we have the ingredient at all
          ing.unit || 'g'
        );

        if (fridgeMap.has(key)) {
          owned += 1;
        } else {
          missing.push({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
          });
        }
      }

      return {
        recipe,
        matchPercent: Math.round((owned / total) * 100),
        ownedCount: owned,
        missingCount: missing.length,
        missing,
      };
    })
    .filter((s) => s.ownedCount > 0)
    .sort((a, b) => b.matchPercent - a.matchPercent)
    .slice(0, 20);

  res.json(scored);
});

module.exports = {
  getFridge,
  addFridgeItem,
  updateFridgeItem,
  deleteFridgeItem,
  getSuggestions,
};
