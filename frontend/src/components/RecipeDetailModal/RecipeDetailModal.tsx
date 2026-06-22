import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import type { Recipe } from '../../types';
import { Button, Modal } from '../ui';
import styles from './RecipeDetailModal.module.css';

interface Props {
  recipe?: Recipe | null;
  recipeId?: string | null;
  open: boolean;
  onClose: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
}

function parseInstructionSteps(instructions: string): string[] {
  const trimmed = instructions.trim();
  if (!trimmed) return [];

  const stepParts = trimmed.split(/\n(?=\s*(?:step\s*\d+|STEP\s*\d+|\d+[\).\]:]\s))/i);
  if (stepParts.length > 1) {
    return stepParts.map((part) => part.trim()).filter(Boolean);
  }

  const paragraphParts = trimmed.split(/\n\s*\n/).filter(Boolean);
  if (paragraphParts.length > 1) return paragraphParts;

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;

  return [trimmed];
}

export default function RecipeDetailModal({
  recipe,
  recipeId,
  open,
  onClose,
  canDelete,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const [fetched, setFetched] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFetched(null);
      return;
    }
    if (recipe) return;
    if (!recipeId) return;

    let cancelled = false;
    setLoading(true);
    api
      .get<Recipe>(`/recipes/${recipeId}`)
      .then((res) => {
        if (!cancelled) setFetched(res.data);
      })
      .catch(() => {
        if (!cancelled) setFetched(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, recipe, recipeId]);

  const data = recipe ?? fetched;
  const steps = useMemo(
    () => (data?.instructions ? parseInstructionSteps(data.instructions) : []),
    [data?.instructions]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="large"
      padded={false}
      ariaLabel={data?.title}
    >
      {loading && !data && (
        <div className={styles.loadingState}>{t('common.loading')}</div>
      )}
      {data && (
        <div className={styles.layout}>
          <aside className={styles.leftPanel}>
            {data.imageUrl ? (
              <img
                src={data.imageUrl}
                alt={data.title}
                className={styles.detailImage}
              />
            ) : (
              <div className={styles.imagePlaceholder} aria-hidden="true">
                🍽
              </div>
            )}

            {data.ingredients && data.ingredients.length > 0 && (
              <div className={styles.detailSection}>
                <h3 className={styles.detailSectionTitle}>
                  {t('recipes.detailIngredients')}
                </h3>
                <div className={styles.ingredientList}>
                  {data.ingredients.map((ing, idx) => (
                    <div
                      key={`${data._id}-${idx}`}
                      className={styles.ingredientItem}
                    >
                      <span className={styles.ingredientName}>{ing.name}</span>
                      <span className={styles.ingredientQuantity}>
                        {ing.quantity} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className={styles.rightPanel}>
            <div className={styles.detailHeader}>
              <h2 className={styles.detailTitle}>{data.title}</h2>
              {(data.category || data.area || (data.tags && data.tags.length > 0)) && (
                <div className={styles.detailMetaChips}>
                  {data.category && (
                    <span className={styles.detailMetaChip}>{data.category}</span>
                  )}
                  {data.area && (
                    <span className={styles.detailMetaChip}>{data.area}</span>
                  )}
                  {data.tags?.map((tag) => (
                    <span key={tag} className={styles.detailMetaChip}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.detailStats}>
              <div className={styles.detailStatItem}>
                <span className={styles.detailStatValue}>{data.prepTime}</span>
                <span className={styles.detailStatLabel}>
                  {t('recipes.detailPrep')}
                </span>
              </div>
              <div className={styles.detailStatItem}>
                <span className={styles.detailStatValue}>{data.cookTime}</span>
                <span className={styles.detailStatLabel}>
                  {t('recipes.detailCook')}
                </span>
              </div>
              <div className={styles.detailStatItem}>
                <span className={styles.detailStatValue}>{data.servings}</span>
                <span className={styles.detailStatLabel}>
                  {t('recipes.detailServings')}
                </span>
              </div>
              <div className={styles.detailStatItem}>
                <span className={styles.detailStatValue}>{data.calories}</span>
                <span className={styles.detailStatLabel}>
                  {t('recipes.detailCalories')}
                </span>
              </div>
            </div>

            {data.instructions && (
              <section className={styles.stepsSection}>
                <h3 className={styles.detailSectionTitle}>
                  {t('recipes.detailInstructions')}
                </h3>
                {steps.length > 1 ? (
                  <ol className={styles.stepList}>
                    {steps.map((step, idx) => (
                      <li key={`${data._id}-step-${idx}`} className={styles.stepItem}>
                        <span className={styles.stepNumber}>{idx + 1}</span>
                        <p className={styles.stepText}>{step}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.instructions}>{data.instructions}</p>
                )}
              </section>
            )}

            {data.youtubeUrl && (
              <a
                href={data.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.youtubeLink}
              >
                ▶ {t('recipes.detailWatchVideo')}
              </a>
            )}

            {canDelete && onDelete && (
              <div>
                <Button variant="danger" onClick={onDelete}>
                  {t('common.delete')}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
