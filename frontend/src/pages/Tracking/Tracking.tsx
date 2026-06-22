import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  createMealLog,
  deleteMealLog,
  fetchMealLogs,
  setMealLogDate,
} from '../../store/slices/mealLogSlice';
import { fetchRecipes } from '../../store/slices/recipeSlice';
import {
  Button,
  Modal,
  NumberInput,
  TextInput,
} from '../../components/ui';
import type { MealLog, MealType, Recipe } from '../../types';
import {
  parseLocalDateKey,
  shiftLocalDateKey,
} from '../../utils/localDate';
import styles from './Tracking.module.css';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function getInitialsFromName(name: string): string {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

// Rough macro target split from total calories:
// protein ~25%, fat ~30%, carbs ~45% of kcal.
// kcal per gram: protein=4, fat=9, carbs=4.
function deriveMacroTargets(calorieGoal: number) {
  const safe = calorieGoal > 0 ? calorieGoal : 2000;
  return {
    calories: safe,
    protein: Math.round((safe * 0.25) / 4),
    fat: Math.round((safe * 0.3) / 9),
    carbs: Math.round((safe * 0.45) / 4),
  };
}

interface MacroRingProps {
  consumed: number;
  goal: number;
  labelShort: string;
}

function MacroRing({ consumed, goal, labelShort }: MacroRingProps) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const progress =
    goal > 0 ? Math.max(0, Math.min(1, consumed / goal)) : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className={styles.ringWrapper}>
      <svg className={styles.ring} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} className={styles.ringBg} />
        <circle
          cx="40"
          cy="40"
          r={radius}
          className={styles.ringFg}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={styles.ringCenter}>
        <span className={styles.ringCenterValue}>{Math.round(consumed)}</span>
        <span className={styles.ringCenterLabel}>{labelShort}</span>
      </div>
    </div>
  );
}

interface MacroBarProps {
  value: number;
  goal: number;
  label: string;
  colorClass: string;
  unit: string;
}

function MacroBar({ value, goal, label, colorClass, unit }: MacroBarProps) {
  const pct =
    goal > 0 ? Math.max(0, Math.min(1, value / goal)) : 0;
  return (
    <div className={styles.macroBar}>
      <div className={styles.macroBarTrack}>
        <div
          className={[styles.macroBarFill, colorClass].join(' ')}
          style={{ height: `${pct * 100}%` }}
        />
      </div>
      <div className={styles.macroBarText}>
        <span className={styles.macroBarValue}>
          {Math.round(value)}
          {unit}
        </span>
        <span className={styles.macroBarLabel}>{label}</span>
      </div>
    </div>
  );
}

interface AddMealState {
  mealType: MealType;
  selectedRecipeId: string | null;
  manualName: string;
  recipeSearch: string;
  servingGrams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

const emptyAddState = (mealType: MealType): AddMealState => ({
  mealType,
  selectedRecipeId: null,
  manualName: '',
  recipeSearch: '',
  servingGrams: 0,
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
});

export default function Tracking() {
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();

  const user = useAppSelector((state) => state.auth.user);
  const logsDate = useAppSelector((state) => state.mealLogs.date);
  const items = useAppSelector((state) => state.mealLogs.items);
  const totals = useAppSelector((state) => state.mealLogs.totals);
  const status = useAppSelector((state) => state.mealLogs.status);
  const saving = useAppSelector((state) => state.mealLogs.saving);
  const recipes = useAppSelector((state) => state.recipes.items);
  const recipeStatus = useAppSelector((state) => state.recipes.status);

  const [activeMeal, setActiveMeal] = useState<MealType>('breakfast');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addState, setAddState] = useState<AddMealState>(() =>
    emptyAddState('breakfast')
  );

  useEffect(() => {
    dispatch(fetchMealLogs({ date: logsDate }));
  }, [dispatch, logsDate]);

  useEffect(() => {
    if (recipeStatus === 'idle') {
      dispatch(fetchRecipes({ limit: 60 }));
    }
  }, [dispatch, recipeStatus]);

  const calorieGoal = user?.preferences?.dailyCalorieGoal ?? 2000;
  const targets = useMemo(() => deriveMacroTargets(calorieGoal), [calorieGoal]);

  const itemsByMeal = useMemo(() => {
    const map: Record<MealType, MealLog[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const item of items) {
      map[item.mealType]?.push(item);
    }
    return map;
  }, [items]);

  const current = parseLocalDateKey(logsDate);
  const weekday = current.toLocaleDateString(i18n.language, { weekday: 'long' });
  const dayAndMonth = current.toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
  });
  const initials = getInitialsFromName(user?.name || '');

  const goPrev = () => dispatch(setMealLogDate(shiftLocalDateKey(logsDate, -1)));
  const goNext = () => dispatch(setMealLogDate(shiftLocalDateKey(logsDate, 1)));

  const openAdd = () => {
    setAddState(emptyAddState(activeMeal));
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setOpenMenuId(null);
  };

  const filteredRecipes = useMemo(() => {
    const q = addState.recipeSearch.trim().toLowerCase();
    const list = recipes.slice(0, 100);
    if (!q) return list.slice(0, 30);
    return list
      .filter((r) => r.title.toLowerCase().includes(q))
      .slice(0, 30);
  }, [addState.recipeSearch, recipes]);

  const pickRecipe = (recipe: Recipe) => {
    setAddState((prev) => ({
      ...prev,
      selectedRecipeId: recipe._id,
      manualName: recipe.title,
      calories: recipe.calories || prev.calories,
    }));
  };

  const clearRecipe = () => {
    setAddState((prev) => ({
      ...prev,
      selectedRecipeId: null,
    }));
  };

  const canSubmit =
    (addState.manualName.trim().length > 0 || addState.selectedRecipeId) &&
    !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const payload = {
      date: logsDate,
      mealType: addState.mealType,
      recipe: addState.selectedRecipeId || undefined,
      name: addState.manualName.trim() || undefined,
      servingGrams: addState.servingGrams,
      calories: addState.calories,
      protein: addState.protein,
      fat: addState.fat,
      carbs: addState.carbs,
    };
    const res = await dispatch(createMealLog(payload));
    if (createMealLog.fulfilled.match(res)) {
      closeAdd();
      setActiveMeal(addState.mealType);
    }
  };

  const handleDelete = async (id: string) => {
    setOpenMenuId(null);
    await dispatch(deleteMealLog(id));
  };

  const currentMealItems = itemsByMeal[activeMeal] ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.dateNav}>
          <div
            role="button"
            tabIndex={0}
            className={styles.dateNavArrow}
            aria-label={t('tracking.prevDay')}
            onClick={goPrev}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                goPrev();
              }
            }}
          >
            ‹
          </div>
          <div className={styles.dateNavIcon} aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </div>
          <div className={styles.dateNavText}>
            <span className={styles.dateNavDay}>{weekday}</span>
            <span className={styles.dateNavDate}>{dayAndMonth}</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            className={styles.dateNavArrow}
            aria-label={t('tracking.nextDay')}
            onClick={goNext}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                goNext();
              }
            }}
          >
            ›
          </div>
        </div>
        <Link to="/profile" className={styles.avatar} aria-label={t('nav.profile')}>
          {initials}
        </Link>
      </div>

      <div className={styles.macrosCard}>
        <div className={styles.macroStat}>
          <span className={styles.macroStatValue}>
            {Math.round(totals.protein)}
          </span>
          <span className={styles.macroStatLabel}>
            {t('tracking.macros.protein')}
          </span>
        </div>
        <div className={styles.macroStat}>
          <span className={styles.macroStatValue}>
            {Math.round(totals.fat)}
          </span>
          <span className={styles.macroStatLabel}>
            {t('tracking.macros.fat')}
          </span>
        </div>
        <div className={styles.macroStat}>
          <span className={styles.macroStatValue}>
            {Math.round(totals.carbs)}
          </span>
          <span className={styles.macroStatLabel}>
            {t('tracking.macros.carbs')}
          </span>
        </div>
        <MacroRing
          consumed={totals.calories}
          goal={targets.calories}
          labelShort={t('tracking.macros.kcal')}
        />
      </div>

      <div className={styles.mealTabs} role="tablist">
        {MEAL_TYPES.map((type) => {
          const isActive = activeMeal === type;
          return (
            <div
              key={type}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              className={[
                styles.mealTab,
                isActive && styles.mealTabActive,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setActiveMeal(type)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveMeal(type);
                }
              }}
            >
              <span className={styles.mealTabLabel}>
                {t(`tracking.mealTypes.${type}`)}
              </span>
              <span className={styles.mealTabTime}>
                {t(`tracking.mealTimes.${type}`)}
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.mealList}>
        {status === 'loading' && items.length === 0 ? (
          <div className={styles.loading}>{t('common.loading')}</div>
        ) : currentMealItems.length === 0 ? (
          <div className={styles.emptyState}>{t('tracking.emptyMeal')}</div>
        ) : (
          currentMealItems.map((item) => (
            <div key={item._id} className={styles.mealCard}>
              <div className={styles.mealCardHead}>
                <div className={styles.mealImage}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" />
                  ) : (
                    <span aria-hidden="true">🍽</span>
                  )}
                </div>
                <div className={styles.mealInfo}>
                  <span className={styles.mealName}>{item.name}</span>
                  <span className={styles.mealMeta}>
                    {Math.round(item.calories)} {t('tracking.macros.kcal')}
                    {item.servingGrams > 0
                      ? ` · ${item.servingGrams}${t('tracking.macros.grams')}`
                      : ''}
                  </span>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={t('tracking.itemMenu')}
                  className={[
                    styles.mealMenu,
                    openMenuId === item._id && styles.mealMenuActive,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    setOpenMenuId((prev) => (prev === item._id ? null : item._id))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenMenuId((prev) =>
                        prev === item._id ? null : item._id
                      );
                    }
                  }}
                >
                  ⋯
                </div>
                {openMenuId === item._id && (
                  <div className={styles.menuDropdown}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={[styles.menuItem, styles.menuItemDanger].join(
                        ' '
                      )}
                      onClick={() => handleDelete(item._id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleDelete(item._id);
                        }
                      }}
                    >
                      {t('common.delete')}
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.macroBars}>
                <MacroBar
                  value={item.protein}
                  goal={targets.protein}
                  label={t('tracking.macros.protein')}
                  colorClass={styles.macroBarFillProtein}
                  unit={t('tracking.macros.grams')}
                />
                <MacroBar
                  value={item.fat}
                  goal={targets.fat}
                  label={t('tracking.macros.fat')}
                  colorClass={styles.macroBarFillFat}
                  unit={t('tracking.macros.grams')}
                />
                <MacroBar
                  value={item.carbs}
                  goal={targets.carbs}
                  label={t('tracking.macros.carbs')}
                  colorClass={styles.macroBarFillCarbs}
                  unit={t('tracking.macros.grams')}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={t('tracking.addMeal')}
        className={styles.fab}
        onClick={openAdd}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openAdd();
          }
        }}
      >
        +
      </div>

      <Modal
        open={addOpen}
        onClose={closeAdd}
        title={t('tracking.addMeal')}
        size="default"
        footer={
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={closeAdd}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        }
      >
        <div className={styles.modalForm}>
          <div className={styles.modalField}>
            <span className={styles.modalLabel}>
              {t('tracking.field.mealType')}
            </span>
            <div className={styles.mealTypePick}>
              {MEAL_TYPES.map((type) => (
                <div
                  key={type}
                  role="button"
                  tabIndex={0}
                  className={[
                    styles.mealTypePickItem,
                    addState.mealType === type &&
                      styles.mealTypePickItemActive,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    setAddState((prev) => ({ ...prev, mealType: type }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setAddState((prev) => ({ ...prev, mealType: type }));
                    }
                  }}
                >
                  {t(`tracking.mealTypes.${type}`)}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.modalField}>
            <span className={styles.modalLabel}>
              {t('tracking.field.fromRecipe')}
            </span>
            <TextInput
              value={addState.recipeSearch}
              onChange={(value) =>
                setAddState((prev) => ({ ...prev, recipeSearch: value }))
              }
              placeholder={t('tracking.field.searchRecipe')}
            />
            <div className={styles.recipeSearchResult}>
              {filteredRecipes.map((recipe) => {
                const isSelected = addState.selectedRecipeId === recipe._id;
                return (
                  <div
                    key={recipe._id}
                    role="button"
                    tabIndex={0}
                    className={[
                      styles.recipeSearchItem,
                      isSelected && styles.recipeSearchItemActive,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() =>
                      isSelected ? clearRecipe() : pickRecipe(recipe)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        isSelected ? clearRecipe() : pickRecipe(recipe);
                      }
                    }}
                  >
                    {recipe.imageUrl ? (
                      <img
                        src={recipe.imageUrl}
                        alt=""
                        className={styles.recipeSearchImage}
                      />
                    ) : (
                      <div className={styles.recipeSearchImage} />
                    )}
                    <div className={styles.recipeSearchInfo}>
                      <span className={styles.recipeSearchTitle}>
                        {recipe.title}
                      </span>
                      <span className={styles.recipeSearchMeta}>
                        {recipe.calories
                          ? `${recipe.calories} ${t('tracking.macros.kcal')}`
                          : t('tracking.field.noCalories')}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredRecipes.length === 0 && (
                <div className={styles.emptyState}>
                  {t('tracking.field.noRecipes')}
                </div>
              )}
            </div>
          </div>

          <div className={styles.modalField}>
            <span className={styles.modalLabel}>
              {t('tracking.field.name')}
            </span>
            <TextInput
              value={addState.manualName}
              onChange={(value) =>
                setAddState((prev) => ({ ...prev, manualName: value }))
              }
              placeholder={t('tracking.field.namePlaceholder')}
            />
          </div>

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <span className={styles.modalLabel}>
                {t('tracking.field.servingGrams')}
              </span>
              <NumberInput
                value={addState.servingGrams}
                onChange={(value) =>
                  setAddState((prev) => ({ ...prev, servingGrams: value }))
                }
                min={0}
                allowDecimals={false}
              />
            </div>
            <div className={styles.modalField}>
              <span className={styles.modalLabel}>
                {t('tracking.field.calories')}
              </span>
              <NumberInput
                value={addState.calories}
                onChange={(value) =>
                  setAddState((prev) => ({ ...prev, calories: value }))
                }
                min={0}
                allowDecimals={false}
              />
            </div>
          </div>

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <span className={styles.modalLabel}>
                {t('tracking.macros.protein')} (
                {t('tracking.macros.grams')})
              </span>
              <NumberInput
                value={addState.protein}
                onChange={(value) =>
                  setAddState((prev) => ({ ...prev, protein: value }))
                }
                min={0}
              />
            </div>
            <div className={styles.modalField}>
              <span className={styles.modalLabel}>
                {t('tracking.macros.fat')} ({t('tracking.macros.grams')})
              </span>
              <NumberInput
                value={addState.fat}
                onChange={(value) =>
                  setAddState((prev) => ({ ...prev, fat: value }))
                }
                min={0}
              />
            </div>
          </div>

          <div className={styles.modalField}>
            <span className={styles.modalLabel}>
              {t('tracking.macros.carbs')} ({t('tracking.macros.grams')})
            </span>
            <NumberInput
              value={addState.carbs}
              onChange={(value) =>
                setAddState((prev) => ({ ...prev, carbs: value }))
              }
              min={0}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
