const asyncHandler = require('express-async-handler');
const Ingredient = require('../models/Ingredient');

// GET /api/ingredients
const getIngredients = asyncHandler(async (req, res) => {
  const ingredients = await Ingredient.find().sort({ name: 1 });
  res.json(ingredients);
});

// POST /api/ingredients
const createIngredient = asyncHandler(async (req, res) => {
  const exists = await Ingredient.findOne({ name: req.body.name });
  if (exists) {
    res.status(400);
    throw new Error('Ingredient already exists.');
  }
  const ingredient = await Ingredient.create(req.body);
  res.status(201).json(ingredient);
});

// PUT /api/ingredients/:id
const updateIngredient = asyncHandler(async (req, res) => {
  const ingredient = await Ingredient.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!ingredient) {
    res.status(404);
    throw new Error('Ingredient not found.');
  }
  res.json(ingredient);
});

// DELETE /api/ingredients/:id
const deleteIngredient = asyncHandler(async (req, res) => {
  const ingredient = await Ingredient.findByIdAndDelete(req.params.id);
  if (!ingredient) {
    res.status(404);
    throw new Error('Ingredient not found.');
  }
  res.json({ message: 'Ingredient deleted.' });
});

module.exports = {
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
};
