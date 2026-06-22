const express = require('express');
const router = express.Router();
const {
  getRecipes,
  getRecipeFacets,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} = require('../controllers/recipeController');
const { protect } = require('../middleware/authMiddleware');

router.get('/facets', getRecipeFacets);
router.route('/').get(getRecipes).post(protect, createRecipe);
router
  .route('/:id')
  .get(getRecipeById)
  .put(protect, updateRecipe)
  .delete(protect, deleteRecipe);

module.exports = router;
