const asyncHandler = require('express-async-handler');
const Recipe = require('../models/Recipe');

// GET /api/recipes
const getRecipes = asyncHandler(async (req, res) => {
  const { search, tag, category, area, source, limit = 60, skip = 0 } = req.query;
  const query = {};
  if (search) query.title = { $regex: search, $options: 'i' };
  if (tag) query.tags = tag;
  if (category) query.category = category;
  if (area) query.area = area;
  if (source) query.source = source;

  const parsedLimit = Math.min(Number(limit) || 60, 200);
  const parsedSkip = Math.max(Number(skip) || 0, 0);

  const [recipes, total] = await Promise.all([
    Recipe.find(query)
      .sort({ createdAt: -1 })
      .skip(parsedSkip)
      .limit(parsedLimit),
    Recipe.countDocuments(query),
  ]);

  res.json({ items: recipes, total, limit: parsedLimit, skip: parsedSkip });
});

// GET /api/recipes/facets
// Returns distinct categories and areas to populate filter dropdowns.
const getRecipeFacets = asyncHandler(async (_req, res) => {
  const [categories, areas] = await Promise.all([
    Recipe.distinct('category', { category: { $ne: '' } }),
    Recipe.distinct('area', { area: { $ne: '' } }),
  ]);
  res.json({
    categories: categories.filter(Boolean).sort(),
    areas: areas.filter(Boolean).sort(),
  });
});

// GET /api/recipes/:id
const getRecipeById = asyncHandler(async (req, res) => {
  const recipe = await Recipe.findById(req.params.id).populate('ingredients.ingredient');
  if (!recipe) {
    res.status(404);
    throw new Error('Recipe not found.');
  }
  res.json(recipe);
});

// POST /api/recipes
const createRecipe = asyncHandler(async (req, res) => {
  const recipe = await Recipe.create({
    ...req.body,
    createdBy: req.user._id,
    source: 'user',
  });
  res.status(201).json(recipe);
});

// PUT /api/recipes/:id
const updateRecipe = asyncHandler(async (req, res) => {
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) {
    res.status(404);
    throw new Error('Recipe not found.');
  }
  if (!recipe.createdBy || recipe.createdBy.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You cannot modify this recipe.');
  }
  Object.assign(recipe, req.body);
  const updated = await recipe.save();
  res.json(updated);
});

// DELETE /api/recipes/:id
const deleteRecipe = asyncHandler(async (req, res) => {
  const recipe = await Recipe.findById(req.params.id);
  if (!recipe) {
    res.status(404);
    throw new Error('Recipe not found.');
  }
  if (!recipe.createdBy || recipe.createdBy.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You cannot delete this recipe.');
  }
  await recipe.deleteOne();
  res.json({ message: 'Recipe deleted.' });
});

module.exports = {
  getRecipes,
  getRecipeFacets,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
};
