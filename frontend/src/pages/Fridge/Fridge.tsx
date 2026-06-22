import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  addFridgeItem,
  deleteFridgeItem,
  fetchFridge,
  fetchSuggestions,
  FridgeItemPayload,
} from '../../store/slices/fridgeSlice';
import {
  Alert,
  Button,
  Collapsible,
  DatePicker,
  FormField,
  List,
  ListItem,
  Modal,
  NumberInput,
  TextInput,
} from '../../components/ui';
import {
  getExpiredItems,
  getExpiringSoonItems,
  getExpiryStatus,
} from '../../utils/fridgeExpiry';
import styles from './Fridge.module.css';

const emptyForm: FridgeItemPayload = {
  name: '',
  quantity: 1,
  unit: 'pcs',
  category: 'other',
};

export default function Fridge() {
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const { items, suggestions, status, suggestionsStatus, error } = useAppSelector(
    (state) => state.fridge
  );
  const [form, setForm] = useState<FridgeItemPayload>(emptyForm);
  const [dismissedExpiredIds, setDismissedExpiredIds] = useState<Set<string>>(
    () => new Set()
  );
  const [removingExpiredId, setRemovingExpiredId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchFridge());
  }, [dispatch]);

  const expiredItems = useMemo(() => getExpiredItems(items), [items]);
  const expiringSoonItems = useMemo(() => getExpiringSoonItems(items), [items]);
  const pendingExpired = useMemo(
    () => expiredItems.filter((item) => !dismissedExpiredIds.has(item._id)),
    [expiredItems, dismissedExpiredIds]
  );
  const currentExpired = pendingExpired[0] ?? null;
  const showExpiredModal =
    status === 'succeeded' && currentExpired !== null && removingExpiredId === null;

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = await dispatch(addFridgeItem(form));
    if (addFridgeItem.fulfilled.match(result)) {
      setForm(emptyForm);
    }
  };

  const handleSuggestions = () => {
    dispatch(fetchSuggestions());
  };

  const handleKeepExpired = () => {
    if (!currentExpired) return;
    setDismissedExpiredIds((prev) => new Set(prev).add(currentExpired._id));
  };

  const handleRemoveExpired = async () => {
    if (!currentExpired) return;
    setRemovingExpiredId(currentExpired._id);
    await dispatch(deleteFridgeItem(currentExpired._id));
    setRemovingExpiredId(null);
  };

  const locale = i18n.language === 'ro' ? 'ro-RO' : 'en-US';

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('fridge.title')}</h1>
        <Button
          variant="primary"
          onClick={handleSuggestions}
          disabled={suggestionsStatus === 'loading' || items.length === 0}
        >
          {suggestionsStatus === 'loading'
            ? t('fridge.calculating')
            : t('fridge.getSuggestions')}
        </Button>
      </header>

      {expiredItems.length > 0 && (
        <Alert variant="error" className={styles.expiryBanner}>
          {t('fridge.expiredBanner', { count: expiredItems.length })}
        </Alert>
      )}

      {expiredItems.length === 0 && expiringSoonItems.length > 0 && (
        <Alert variant="warning" className={styles.expiryBanner}>
          {t('fridge.expiringSoonBanner', { count: expiringSoonItems.length })}
        </Alert>
      )}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.formTitle}>{t('fridge.addItem')}</h2>
          <form onSubmit={handleAdd} className={styles.form}>
            <FormField label={t('fridge.fieldName')} required>
              <TextInput
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                ariaLabel={t('fridge.fieldName')}
              />
            </FormField>
            <div className={styles.row3}>
              <FormField label={t('fridge.fieldQuantity')}>
                <NumberInput
                  value={form.quantity}
                  onChange={(v) => setForm({ ...form, quantity: v })}
                  min={0}
                  step={0.5}
                  showSteppers
                />
              </FormField>
              <FormField label={t('fridge.fieldUnit')}>
                <TextInput
                  value={form.unit}
                  onChange={(v) => setForm({ ...form, unit: v })}
                />
              </FormField>
              <FormField label={t('fridge.fieldCategory')}>
                <TextInput
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                />
              </FormField>
            </div>
            <FormField label={t('fridge.fieldExpires')}>
              <DatePicker
                value={form.expiresAt ?? ''}
                onChange={(v) => setForm({ ...form, expiresAt: v || undefined })}
                ariaLabel={t('fridge.fieldExpires')}
              />
            </FormField>

            {error && <Alert variant="error">{t(error)}</Alert>}

            <Button type="submit" variant="primary">
              {t('fridge.addButton')}
            </Button>
          </form>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>
            {t('fridge.available', { count: items.length })}
          </h2>
          {status === 'loading' && <p className="muted">{t('common.loading')}</p>}
          {items.length === 0 && status !== 'loading' && (
            <p className="muted">{t('fridge.empty')}</p>
          )}

          <List className={styles.fridgeList}>
            {items.map((item) => {
              const expiryStatus = getExpiryStatus(item.expiresAt);
              const formattedExpiry = item.expiresAt
                ? new Date(item.expiresAt).toLocaleDateString(locale)
                : '';

              return (
              <ListItem
                key={item._id}
                className={[
                  styles.fridgeItem,
                  expiryStatus === 'expired' && styles.fridgeItemExpired,
                  expiryStatus === 'soon' && styles.fridgeItemSoon,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemQty}>
                    {t('fridge.itemQuantity', {
                      quantity: item.quantity,
                      unit: item.unit,
                    })}
                  </span>
                  {item.expiresAt && (
                    <span
                      className={
                        expiryStatus === 'expired' ? styles.expiredBadge : styles.expires
                      }
                    >
                      {expiryStatus === 'expired'
                        ? t('fridge.expiredLabel')
                        : t(
                            expiryStatus === 'soon'
                              ? 'fridge.expiresSoon'
                              : 'fridge.expiresOn',
                            { date: formattedExpiry }
                          )}
                    </span>
                  )}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => dispatch(deleteFridgeItem(item._id))}
                >
                  {t('common.delete')}
                </Button>
              </ListItem>
              );
            })}
          </List>
        </section>
      </div>

      {suggestions.length > 0 && (
        <section className={styles.suggestions}>
          <h2 className={styles.suggestionsHeader}>{t('fridge.suggestionsTitle')}</h2>
          <p className={styles.suggestionsSubtitle}>{t('fridge.suggestionsSubtitle')}</p>
          <div className={styles.suggestionGrid}>
            {suggestions.map(({ recipe, matchPercent, ownedCount, missingCount, missing }) => (
              <article key={recipe._id} className={styles.suggestionCard}>
                <header className={styles.suggestionHeader}>
                  <h3 className={styles.suggestionTitle}>{recipe.title}</h3>
                  <span className={styles.matchBadge}>{matchPercent}%</span>
                </header>
                <p className={styles.suggestionSub}>
                  {t('fridge.haveOf', {
                    owned: ownedCount,
                    total: ownedCount + missingCount,
                  })}
                </p>
                {missing.length > 0 && (
                  <Collapsible
                    summary={
                      missing.length === 1
                        ? t('fridge.missingOne', { count: missing.length })
                        : t('fridge.missingMany', { count: missing.length })
                    }
                  >
                    <div className={styles.missingList}>
                      {missing.map((m, i) => (
                        <div key={`${recipe._id}-miss-${i}`}>
                          {m.quantity} {m.unit} {m.name}
                        </div>
                      ))}
                    </div>
                  </Collapsible>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {suggestionsStatus === 'succeeded' && suggestions.length === 0 && (
        <p className={`muted ${styles.noMatch}`}>{t('fridge.noMatch')}</p>
      )}

      <Modal
        open={showExpiredModal}
        onClose={handleKeepExpired}
        title={t('fridge.expiredTitle')}
        closeOnOverlay={false}
        footer={
          <>
            <Button variant="secondary" onClick={handleKeepExpired}>
              {t('fridge.expiredKeep')}
            </Button>
            <Button
              variant="danger"
              onClick={handleRemoveExpired}
              disabled={removingExpiredId !== null}
            >
              {t('fridge.expiredRemove')}
            </Button>
          </>
        }
      >
        <p>
          {t('fridge.expiredMessage', {
            name: currentExpired?.name ?? '',
            date: currentExpired?.expiresAt
              ? new Date(currentExpired.expiresAt).toLocaleDateString(locale)
              : '',
          })}
        </p>
      </Modal>
    </div>
  );
}
