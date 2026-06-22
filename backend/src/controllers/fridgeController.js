const asyncHandler = require('express-async-handler');
const FridgeItem = require('../models/FridgeItem');
const Recipe = require('../models/Recipe');

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
const getSuggestions = asyncHandler(async (req, res) => {
  const fridgeItems = await FridgeItem.find({ user: req.user._id });
  const fridgeNames = new Set(fridgeItems.map((i) => i.name.toLowerCase()));

  if (fridgeNames.size === 0) {
    return res.json([]);
  }

  const recipes = await Recipe.find();
  const scored = recipes
    .map((recipe) => {
      const total = recipe.ingredients.length || 1;
      const owned = recipe.ingredients.filter((ing) =>
        fridgeNames.has((ing.name || '').toLowerCase())
      );
      const missing = recipe.ingredients.filter(
        (ing) => !fridgeNames.has((ing.name || '').toLowerCase())
      );
      return {
        recipe,
        matchPercent: Math.round((owned.length / total) * 100),
        ownedCount: owned.length,
        missingCount: missing.length,
        missing: missing.map((m) => ({ name: m.name, quantity: m.quantity, unit: m.unit })),
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
