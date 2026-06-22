const express = require('express');
const router = express.Router();
const {
  getMealPlans,
  getMealPlanById,
  createMealPlan,
  generateMealPlan,
  updateMealPlan,
  deleteMealPlan,
  getShoppingList,
} = require('../controllers/mealPlanController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/').get(getMealPlans).post(createMealPlan);
router.post('/generate', generateMealPlan);
router.get('/:id/shopping-list', getShoppingList);
router.route('/:id').get(getMealPlanById).put(updateMealPlan).delete(deleteMealPlan);

module.exports = router;
