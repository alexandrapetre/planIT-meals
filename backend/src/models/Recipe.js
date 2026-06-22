const mongoose = require('mongoose');

const recipeIngredientSchema = new mongoose.Schema(
  {
    ingredient: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, default: 'g' },
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '' },
    instructions: { type: String, default: '' },
    ingredients: [recipeIngredientSchema],
    prepTime: { type: Number, default: 0 },
    cookTime: { type: Number, default: 0 },
    servings: { type: Number, default: 1 },
    calories: { type: Number, default: 0 },
    tags: [{ type: String }],
    category: { type: String, default: '', index: true },
    area: { type: String, default: '', index: true },
    imageUrl: { type: String, default: '' },
    youtubeUrl: { type: String, default: '' },
    source: {
      type: String,
      enum: ['user', 'seed'],
      default: 'user',
      index: true,
    },
    externalId: { type: String, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recipe', recipeSchema);
