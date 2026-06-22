import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  deleteMealPlan,
  fetchMealPlans,
  fetchShoppingList,
  generateMealPlan,
} from '../../store/slices/mealPlanSlice';
import type { MealType, Recipe } from '../../types';
import {
  Alert,
  Button,
  Collapsible,
  DatePicker,
  FormField,
  List,
  ListItem,
  NumberInput,
} from '../../components/ui';
import { todayLocalDateKey } from '../../utils/localDate';
import RecipeDetailModal from '../../components/RecipeDetailModal/RecipeDetailModal';
import styles from './MealPlan.module.css';

export default function MealPlan() {
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const { items, status, shoppingLists, shoppingStatus, error } = useAppSelector(
    (state) => state.mealPlans
  );
  const [days, setDays] = useState(7);
  const [startDate, setStartDate] = useState(() => todayLocalDateKey());
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [detailRecipeId, setDetailRecipeId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchMealPlans());
  }, [dispatch]);

  const handleGenerate = () => {
    dispatch(generateMealPlan({ startDate, days }));
  };

  const handleShoppingList = (planId: string) => {
    const willExpand = expandedPlanId !== planId;
    setExpandedPlanId(willExpand ? planId : null);
    if (willExpand) {
      dispatch(fetchShoppingList(planId));
    }
  };

  const locale = i18n.language === 'ro' ? 'ro-RO' : 'en-US';
  const mealLabel = (type: MealType) => t(`mealPlan.mealTypes.${type}`);

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('mealPlan.title')}</h1>
      </header>

      <section className={styles.generatorCard}>
        <h2 className={styles.generatorTitle}>{t('mealPlan.generateNew')}</h2>
        <div className={styles.generatorRow}>
          <FormField label={t('mealPlan.startDate')}>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              allowClear={false}
              ariaLabel={t('mealPlan.startDate')}
            />
          </FormField>
          <FormField label={t('mealPlan.numberOfDays')}>
            <NumberInput
              value={days}
              onChange={setDays}
              min={1}
              max={30}
              allowDecimals={false}
              showSteppers
            />
          </FormField>
          <Button variant="primary" onClick={handleGenerate} disabled={status === 'loading'}>
            {status === 'loading' ? t('mealPlan.generating') : t('mealPlan.generate')}
          </Button>
        </div>
        {error && (
          <div style={{ marginTop: '1rem' }}>
            <Alert variant="error">{t(error)}</Alert>
          </div>
        )}
      </section>

      <section>
        <h2 className={styles.sectionTitle}>{t('mealPlan.yourPlans')}</h2>
        {items.length === 0 && <p className="muted">{t('mealPlan.empty')}</p>}
        <div className={styles.planList}>
          {items.map((plan) => {
            const shoppingList = shoppingLists[plan._id];
            const isExpanded = expandedPlanId === plan._id;
            return (
              <article key={plan._id} className={styles.planCard}>
                <header className={styles.planHeader}>
                  <div>
                    <h3 className={styles.planName}>{plan.name}</h3>
                    <p className={styles.planDates}>
                      {t('mealPlan.dateRange', {
                        start: new Date(plan.startDate).toLocaleDateString(locale),
                        end: new Date(plan.endDate).toLocaleDateString(locale),
                      })}
                    </p>
                  </div>
                  <div className={styles.planActions}>
                    <Button size="sm" onClick={() => handleShoppingList(plan._id)}>
                      {isExpanded ? t('mealPlan.hideList') : t('mealPlan.shoppingList')}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => dispatch(deleteMealPlan(plan._id))}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </header>

                <div className={styles.daysGrid}>
                  {plan.days.map((day, idx) => {
                    const perServingMeals = day.meals.map((meal) => {
                      const recipe =
                        typeof meal.recipe === 'object' && meal.recipe
                          ? (meal.recipe as Recipe)
                          : undefined;
                      const servings = Math.max(1, recipe?.servings || 1);
                      const perServingKcal = recipe
                        ? Math.round((recipe.calories || 0) / servings)
                        : 0;
                      return { meal, recipe, perServingKcal };
                    });
                    const dayTotal = perServingMeals.reduce(
                      (sum, m) => sum + m.perServingKcal,
                      0
                    );
                    return (
                      <div key={`${plan._id}-${idx}`} className={styles.dayCard}>
                        <h4 className={styles.dayTitle}>
                          <span>
                            {new Date(day.date).toLocaleDateString(locale, {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                          {dayTotal > 0 && (
                            <span className={styles.dayTotal}>
                              {dayTotal} {t('mealPlan.kcal')}
                            </span>
                          )}
                        </h4>
                        <div className={styles.mealList}>
                          {perServingMeals.map(({ meal, recipe, perServingKcal }, mIdx) => (
                            <div
                              key={`${plan._id}-${idx}-${mIdx}`}
                              className={styles.mealRow}
                            >
                              <span className={styles.mealType}>{mealLabel(meal.type)}</span>
                              <div className={styles.mealBody}>
                                {recipe ? (
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    className={styles.mealTitleLink}
                                    onClick={() => setDetailRecipeId(recipe._id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setDetailRecipeId(recipe._id);
                                      }
                                    }}
                                    aria-label={t('mealPlan.viewRecipe', { name: recipe.title })}
                                  >
                                    {recipe.title}
                                  </div>
                                ) : (
                                  <span className={styles.mealTitle}>
                                    {t('mealPlan.emptyRecipe')}
                                  </span>
                                )}
                                {recipe && (
                                  <span className={styles.mealCal}>
                                    {perServingKcal} {t('mealPlan.kcal')}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isExpanded && (
                  <div className={styles.shoppingList}>
                    <h4 className={styles.shoppingTitle}>{t('mealPlan.shoppingListTitle')}</h4>
                    {shoppingStatus === 'loading' && !shoppingList && (
                      <p className="muted">{t('mealPlan.shoppingGenerating')}</p>
                    )}
                    {shoppingList && (
                      <>
                        {shoppingList.items.length === 0 ? (
                          <p className="muted">{t('mealPlan.allCovered')}</p>
                        ) : (
                          <List className={styles.shoppingItems}>
                            {shoppingList.items.map((item, i) => (
                              <ListItem
                                key={`${plan._id}-sl-${i}`}
                                className={styles.shoppingItem}
                              >
                                <span className={styles.shoppingName}>{item.name}</span>
                                <span className={styles.shoppingQty}>
                                  {t('mealPlan.missingAmount', {
                                    qty: item.missing,
                                    unit: item.unit,
                                  })}
                                </span>
                                {item.inFridge > 0 && (
                                  <span className="muted">
                                    {t('mealPlan.inFridgeInfo', {
                                      inFridge: item.inFridge,
                                      unit: item.unit,
                                      needed: item.needed,
                                    })}
                                  </span>
                                )}
                              </ListItem>
                            ))}
                          </List>
                        )}
                        {shoppingList.alreadyCovered.length > 0 && (
                          <Collapsible
                            summary={t('mealPlan.coveredCount', {
                              count: shoppingList.alreadyCovered.length,
                            })}
                          >
                            <div className={styles.coveredList}>
                              {shoppingList.alreadyCovered.map((item, i) => (
                                <div key={`${plan._id}-ok-${i}`}>
                                  {t('mealPlan.coveredItem', {
                                    name: item.name,
                                    needed: item.needed,
                                    unit: item.unit,
                                  })}
                                </div>
                              ))}
                            </div>
                          </Collapsible>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <RecipeDetailModal
        open={detailRecipeId !== null}
        recipeId={detailRecipeId}
        onClose={() => setDetailRecipeId(null)}
      />
    </div>
  );
}
