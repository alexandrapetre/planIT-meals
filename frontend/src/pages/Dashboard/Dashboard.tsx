import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchRecipeCatalogTotal, fetchRecipes } from '../../store/slices/recipeSlice';
import { fetchMealPlans } from '../../store/slices/mealPlanSlice';
import { fetchFridge } from '../../store/slices/fridgeSlice';
import { Alert, TextInput } from '../../components/ui';
import type { MealType } from '../../types';
import { getExpiredItems, getExpiringSoonItems } from '../../utils/fridgeExpiry';
import { shuffleArray } from '../../utils/shuffleArray';
import styles from './Dashboard.module.css';

type PreferenceIconKey =
  | 'vegetarian'
  | 'vegan'
  | 'glutenFree'
  | 'lactoseFree'
  | 'keto'
  | 'lowCarb'
  | 'mediterranean'
  | 'nuts'
  | 'peanuts'
  | 'eggs'
  | 'soy'
  | 'fish'
  | 'shellfish'
  | 'sesame';

const PREF_ICONS: Record<PreferenceIconKey, string> = {
  vegetarian: '🥬',
  vegan: '🌱',
  glutenFree: '🌾',
  lactoseFree: '🥛',
  keto: '🥑',
  lowCarb: '🥒',
  mediterranean: '🫒',
  nuts: '🌰',
  peanuts: '🥜',
  eggs: '🥚',
  soy: '🫘',
  fish: '🐟',
  shellfish: '🦐',
  sesame: '⚫',
};

function mealTypeForHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 22) return 'dinner';
  return 'snack';
}

function categoryForMealType(meal: MealType): string | undefined {
  switch (meal) {
    case 'breakfast':
      return 'Breakfast';
    case 'snack':
      return 'Dessert';
    default:
      return undefined;
  }
}

function formatDurationMinutes(total: number, t: TFunction): string {
  if (total >= 60) {
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (minutes === 0 && hours === 1) return t('dashboard.hour');
    return t('dashboard.hoursMinutes', { hours, minutes });
  }
  return t('dashboard.minutes', { count: total });
}

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const user = useAppSelector((state) => state.auth.user);
  const suggestionItems = useAppSelector((state) => state.recipes.items);
  const recipesTotal = useAppSelector((state) => state.recipes.catalogTotal);
  const mealPlans = useAppSelector((state) => state.mealPlans.items);
  const fridge = useAppSelector((state) => state.fridge.items);

  const [search, setSearch] = useState('');

  const mealType = useMemo(() => mealTypeForHour(new Date().getHours()), []);

  const carouselShuffleKey = useMemo(() => Math.random(), []);
  const shuffledSuggestions = useMemo(
    () => shuffleArray(suggestionItems),
    [suggestionItems, carouselShuffleKey]
  );

  useEffect(() => {
    const category = categoryForMealType(mealType);
    dispatch(fetchRecipes({ limit: 12, category }));
    dispatch(fetchRecipeCatalogTotal());
    dispatch(fetchMealPlans());
    dispatch(fetchFridge());
  }, [dispatch, mealType]);

  const today = useMemo(() => new Date(), []);
  const weekday = today.toLocaleDateString(i18n.language, { weekday: 'long' });
  const dayAndMonth = today.toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
  });

  const initials = useMemo(() => {
    if (!user?.name) return '?';
    return user.name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [user?.name]);

  const avoidItems = useMemo(() => {
    const diet = user?.preferences?.dietaryRestrictions ?? [];
    const allergies = user?.preferences?.allergies ?? [];
    return [
      ...diet.map((key) => ({
        key,
        icon: PREF_ICONS[key as PreferenceIconKey] ?? '⚠️',
        label: t(`profile.dietary.${key}`, { defaultValue: key }),
      })),
      ...allergies.map((key) => ({
        key,
        icon: PREF_ICONS[key as PreferenceIconKey] ?? '⚠️',
        label: t(`profile.allergies.${key}`, { defaultValue: key }),
      })),
    ];
  }, [user, t]);

  const goToSearch = () => {
    const query = search.trim();
    navigate(query ? `/recipes?search=${encodeURIComponent(query)}` : '/recipes');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goToSearch();
  };

  const expiredFridgeCount = useMemo(() => getExpiredItems(fridge).length, [fridge]);
  const expiringSoonCount = useMemo(() => getExpiringSoonItems(fridge).length, [fridge]);

  const desktopStats = [
    {
      labelKey: 'dashboard.recipes',
      value: recipesTotal,
      to: '/recipes',
      linkKey: 'dashboard.manageRecipes',
    },
    {
      labelKey: 'dashboard.fridge',
      value: fridge.length,
      to: '/fridge',
      linkKey: 'dashboard.viewFridge',
    },
    {
      labelKey: 'dashboard.mealPlans',
      value: mealPlans.length,
      to: '/meal-plan',
      linkKey: 'dashboard.viewPlans',
    },
    {
      labelKey: 'dashboard.calorieGoal',
      value: user?.preferences?.dailyCalorieGoal ?? 2000,
      to: '/profile',
      linkKey: 'dashboard.configureProfile',
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/meal-plan" className={styles.dateChip}>
          <span className={styles.dateChipIcon} aria-hidden="true">
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
          </span>
          <span className={styles.dateChipText}>
            <span className={styles.dateChipDay}>{weekday}</span>
            <span className={styles.dateChipDate}>{dayAndMonth}</span>
          </span>
          <span className={styles.dateChipChevron} aria-hidden="true">
            ›
          </span>
        </Link>
        <Link to="/profile" className={styles.avatar} aria-label={t('nav.profile')}>
          {initials}
        </Link>
      </div>

      {expiredFridgeCount > 0 && (
        <Alert variant="error" className={styles.expiryAlert}>
          {t('fridge.expiredBanner', { count: expiredFridgeCount })}{' '}
          <Link to="/fridge">{t('fridge.expiredBannerAction')}</Link>
        </Alert>
      )}

      {expiredFridgeCount === 0 && expiringSoonCount > 0 && (
        <Alert variant="warning" className={styles.expiryAlert}>
          {t('fridge.expiringSoonBanner', { count: expiringSoonCount })}{' '}
          <Link to="/fridge">{t('fridge.expiredBannerAction')}</Link>
        </Alert>
      )}

      <div className={styles.greeting}>
        <span className={styles.greetingOverline}>{t('dashboard.overline')}</span>
        <h1 className={styles.greetingTitle}>
          {t(`dashboard.suggestions.${mealType}`)}
        </h1>
      </div>

      <form onSubmit={handleSearchSubmit} className={styles.searchBar}>
        <div className={styles.searchBarInput}>
          <TextInput
            value={search}
            onChange={setSearch}
            placeholder={t('dashboard.searchPlaceholder')}
            ariaLabel={t('dashboard.searchPlaceholder')}
          />
        </div>
        <div
          className={styles.searchBarIcon}
          role="button"
          tabIndex={0}
          aria-label={t('common.search')}
          onClick={goToSearch}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              goToSearch();
            }
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </div>
      </form>

      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('dashboard.whatToAvoid')}</h2>
          <Link to="/profile" className={styles.sectionLink}>
            {t('dashboard.editPreferences')}
          </Link>
        </div>
        <div className={styles.avoidTiles}>
          {avoidItems.map((item) => (
            <div key={item.key} className={styles.avoidTile}>
              <div className={styles.avoidTileIcon}>{item.icon}</div>
              <span className={styles.avoidTileLabel}>{item.label}</span>
            </div>
          ))}
          <Link to="/profile" className={styles.avoidTile}>
            <div
              className={[styles.avoidTileIcon, styles.avoidTileIconAdd]
                .filter(Boolean)
                .join(' ')}
              aria-hidden="true"
            >
              +
            </div>
            <span className={styles.avoidTileLabel}>
              {t('dashboard.addPreference')}
            </span>
          </Link>
        </div>
      </section>

      <section>
        <div className={styles.carousel}>
          {suggestionItems.length === 0 ? (
            <div className={styles.emptyCarousel}>{t('recipes.empty')}</div>
          ) : (
            shuffledSuggestions.map((recipe) => (
              <Link
                key={recipe._id}
                to={`/recipes?open=${recipe._id}`}
                className={styles.carouselCard}
              >
                <div className={styles.carouselImageWrapper}>
                  {recipe.imageUrl ? (
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className={styles.carouselImage}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.carouselImagePlaceholder}>🍽</div>
                  )}
                </div>
                <div className={styles.carouselBody}>
                  <h3 className={styles.carouselTitle}>{recipe.title}</h3>
                  <span className={styles.carouselMeta}>
                    {formatDurationMinutes(
                      recipe.prepTime + recipe.cookTime,
                      t
                    )}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className={styles.desktopStats}>
        {desktopStats.map((stat) => (
          <Link key={stat.to} to={stat.to} className={styles.statCard}>
            <span className={styles.statLabel}>{t(stat.labelKey)}</span>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLink}>{t(stat.linkKey)}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
