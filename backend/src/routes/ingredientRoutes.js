const express = require('express');
const router = express.Router();
const {
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} = require('../controllers/ingredientController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(getIngredients).post(protect, createIngredient);
router.route('/:id').put(protect, updateIngredient).delete(protect, deleteIngredient);

module.exports = router;
