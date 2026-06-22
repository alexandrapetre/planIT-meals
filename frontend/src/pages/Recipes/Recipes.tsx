import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store';
import api from '../../api/axios';
import {
  createRecipe,
  deleteRecipe,
  fetchRecipeFacets,
  fetchRecipes,
  RecipePayload,
  FetchRecipesParams,
} from '../../store/slices/recipeSlice';
import type { Recipe, RecipeIngredient } from '../../types';
import RecipeDetailModal from '../../components/RecipeDetailModal/RecipeDetailModal';
import {
  Alert,
  Button,
  FieldSet,
  FormField,
  Modal,
  NumberInput,
  TextArea,
  TextInput,
} from '../../components/ui';
import { shuffleArray } from '../../utils/shuffleArray';
import styles from './Recipes.module.css';

const emptyForm: RecipePayload = {
  title: '',
  description: '',
  instructions: '',
  ingredients: [],
  prepTime: 0,
  cookTime: 0,
  servings: 1,
  calories: 0,
  tags: [],
  category: '',
  area: '',
  imageUrl: '',
};

const ALL_FILTER = '__all__';
const MINE_FILTER = '__mine__';

export default function Recipes() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { items, status, error, total, limit, skip, facets } = useAppSelector(
    (state) => state.recipes
  );
  const currentUserId = useAppSelector((state) => state.auth.user?._id);
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_FILTER);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [form, setForm] = useState<RecipePayload>(emptyForm);
  const [ingredientInput, setIngredientInput] = useState<RecipeIngredient>({
    name: '',
    quantity: 0,
    unit: 'g',
  });

  const loadRecipes = (params?: FetchRecipesParams) => {
    const effective: FetchRecipesParams = { ...params };
    if (activeCategory === MINE_FILTER) {
      effective.source = 'user';
    } else if (activeCategory !== ALL_FILTER) {
      effective.category = activeCategory;
    }
    if (search) effective.search = search;
    dispatch(fetchRecipes(effective));
  };

  useEffect(() => {
    const initialSearch = searchParams.get('search') ?? '';
    dispatch(
      fetchRecipes(
        initialSearch ? { search: initialSearch, limit: 60 } : undefined
      )
    );
    dispatch(fetchRecipeFacets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // Open a recipe modal from the ?open=<id> query param (e.g. navigated from Dashboard).
  // Prefer hitting the local list; fall back to a direct fetch if not loaded yet.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;
    let cancelled = false;

    const found = items.find((r) => r._id === openId);
    if (found) {
      setDetailRecipe(found);
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
      return;
    }

    (async () => {
      try {
        const { data } = await api.get<Recipe>(`/recipes/${openId}`);
        if (cancelled) return;
        setDetailRecipe(data);
        const next = new URLSearchParams(searchParams);
        next.delete('open');
        setSearchParams(next, { replace: true });
      } catch {
        // silently ignore - user will just see the list
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, searchParams, setSearchParams]);

  useEffect(() => {
    loadRecipes({ skip: 0, limit: 60 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadRecipes({ skip: 0, limit: 60 });
  };

  const handleLoadMore = () => {
    loadRecipes({ skip: skip + limit, limit });
  };

  const listShuffleKey = useMemo(() => Math.random(), []);
  const displayItems = useMemo(
    () => shuffleArray(items),
    [items, listShuffleKey]
  );

  const filterChips = useMemo(() => {
    const base = [
      { id: ALL_FILTER, label: t('recipes.filterAll') },
      { id: MINE_FILTER, label: t('recipes.filterMine') },
    ];
    return base.concat(
      facets.categories.map((cat) => ({ id: cat, label: cat }))
    );
  }, [facets.categories, t]);

  const addIngredient = () => {
    if (!ingredientInput.name.trim()) return;
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, ingredientInput] }));
    setIngredientInput({ name: '', quantity: 0, unit: 'g' });
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = await dispatch(createRecipe(form));
    if (createRecipe.fulfilled.match(result)) {
      setForm(emptyForm);
      setCreateOpen(false);
    }
  };

  const canDeleteDetail =
    detailRecipe?.createdBy != null &&
    detailRecipe.createdBy === currentUserId;

  const handleDeleteDetail = async () => {
    if (!detailRecipe) return;
    const result = await dispatch(deleteRecipe(detailRecipe._id));
    if (deleteRecipe.fulfilled.match(result)) {
      setDetailRecipe(null);
    }
  };

  const hasMore = items.length < total;

  return (
    <div>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>{t('recipes.title')}</h1>
        </div>
        <form onSubmit={handleSearchSubmit} className={styles.searchRow}>
          <div className={styles.searchInput}>
            <TextInput
              value={search}
              onChange={setSearch}
              placeholder={t('recipes.searchPlaceholder')}
              ariaLabel={t('recipes.search')}
            />
          </div>
          <Button type="submit">{t('recipes.search')}</Button>
        </form>
        <div className={styles.filters}>
          {filterChips.map((chip) => (
            <div
              key={chip.id}
              role="button"
              tabIndex={0}
              className={[
                styles.filterChip,
                activeCategory === chip.id && styles.filterChipActive,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setActiveCategory(chip.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveCategory(chip.id);
                }
              }}
            >
              {chip.label}
            </div>
          ))}
        </div>
      </header>

      {error && <Alert variant="error">{t(error)}</Alert>}

      <p className={styles.resultCount}>
        {t('recipes.resultCount', { count: total })}
      </p>

      {items.length === 0 && status !== 'loading' ? (
        <div className={styles.emptyState}>
          <p>{t('recipes.empty')}</p>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {displayItems.map((recipe) => (
              <div
                key={recipe._id}
                role="button"
                tabIndex={0}
                className={styles.card}
                onClick={() => setDetailRecipe(recipe)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailRecipe(recipe);
                  }
                }}
              >
                <div className={styles.cardImageWrapper}>
                  {recipe.imageUrl ? (
                    <img
                      className={styles.cardImage}
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.cardImagePlaceholder}>
                      <span aria-hidden="true">🍽</span>
                    </div>
                  )}
                  {recipe.category && (
                    <span className={styles.cardCategoryBadge}>
                      {recipe.category}
                    </span>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{recipe.title}</h3>
                  {recipe.area && (
                    <div className={styles.cardArea}>{recipe.area}</div>
                  )}
                  <div className={styles.cardMeta}>
                    <span className={styles.cardMetaItem}>
                      ⏱ {recipe.prepTime + recipe.cookTime} {t('recipes.minutes')}
                    </span>
                    <span className={styles.cardMetaItem}>
                      🔥 {recipe.calories} {t('recipes.kcal')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className={styles.loadMoreWrapper}>
              <Button
                variant="ghost"
                onClick={handleLoadMore}
                disabled={status === 'loading'}
              >
                {status === 'loading'
                  ? t('common.loading')
                  : t('recipes.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label={t('recipes.addFab')}
        className={styles.fab}
        onClick={() => setCreateOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCreateOpen(true);
          }
        }}
      >
        +
      </div>

      <RecipeDetailModal
        open={detailRecipe !== null}
        recipe={detailRecipe}
        onClose={() => setDetailRecipe(null)}
        canDelete={canDeleteDetail}
        onDelete={handleDeleteDetail}
      />

      {/* create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('recipes.addNew')}
        size="large"
      >
        <form onSubmit={handleCreateSubmit} className={styles.createForm}>
          <FormField label={t('recipes.fieldTitle')} required>
            <TextInput
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              ariaLabel={t('recipes.fieldTitle')}
            />
          </FormField>
          <div className={styles.row2}>
            <FormField label={t('recipes.fieldCategory')}>
              <TextInput
                value={form.category ?? ''}
                onChange={(v) => setForm({ ...form, category: v })}
              />
            </FormField>
            <FormField label={t('recipes.fieldArea')}>
              <TextInput
                value={form.area ?? ''}
                onChange={(v) => setForm({ ...form, area: v })}
              />
            </FormField>
          </div>
          <FormField label={t('recipes.fieldImage')}>
            <TextInput
              value={form.imageUrl ?? ''}
              onChange={(v) => setForm({ ...form, imageUrl: v })}
              placeholder="https://..."
            />
          </FormField>
          <FormField label={t('recipes.fieldDescription')}>
            <TextArea
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
            />
          </FormField>
          <FormField label={t('recipes.fieldInstructions')}>
            <TextArea
              value={form.instructions}
              onChange={(v) => setForm({ ...form, instructions: v })}
            />
          </FormField>
          <div className={styles.row3}>
            <FormField label={t('recipes.fieldPrepTime')}>
              <NumberInput
                value={form.prepTime}
                onChange={(v) => setForm({ ...form, prepTime: v })}
                min={0}
                allowDecimals={false}
              />
            </FormField>
            <FormField label={t('recipes.fieldCookTime')}>
              <NumberInput
                value={form.cookTime}
                onChange={(v) => setForm({ ...form, cookTime: v })}
                min={0}
                allowDecimals={false}
              />
            </FormField>
            <FormField label={t('recipes.fieldServings')}>
              <NumberInput
                value={form.servings}
                onChange={(v) => setForm({ ...form, servings: v })}
                min={1}
                allowDecimals={false}
              />
            </FormField>
          </div>
          <FormField label={t('recipes.fieldCalories')}>
            <NumberInput
              value={form.calories}
              onChange={(v) => setForm({ ...form, calories: v })}
              min={0}
              allowDecimals={false}
            />
          </FormField>
          <FieldSet legend={t('recipes.ingredients')}>
            <div className={styles.row3}>
              <TextInput
                value={ingredientInput.name}
                onChange={(v) =>
                  setIngredientInput({ ...ingredientInput, name: v })
                }
                placeholder={t('recipes.ingredientName')}
              />
              <NumberInput
                value={ingredientInput.quantity}
                onChange={(v) =>
                  setIngredientInput({ ...ingredientInput, quantity: v })
                }
                placeholder={t('recipes.ingredientQuantity')}
                min={0}
              />
              <TextInput
                value={ingredientInput.unit}
                onChange={(v) =>
                  setIngredientInput({ ...ingredientInput, unit: v })
                }
                placeholder={t('recipes.ingredientUnit')}
              />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <Button variant="ghost" size="sm" onClick={addIngredient}>
                {t('recipes.addIngredient')}
              </Button>
            </div>
            {form.ingredients.length > 0 && (
              <div
                className={styles.ingredientPreview}
                style={{ marginTop: '0.75rem' }}
              >
                {form.ingredients.map((ing, idx) => (
                  <div key={`${ing.name}-${idx}`}>
                    {ing.quantity} {ing.unit} {ing.name}
                  </div>
                ))}
              </div>
            )}
          </FieldSet>
          <div>
            <Button type="submit" variant="primary">
              {t('recipes.addCta')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
