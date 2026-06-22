import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store';
import { updateProfile } from '../../store/slices/authSlice';
import {
  Alert,
  Button,
  Chip,
  ChipGroup,
  FieldSet,
  FormField,
  NumberInput,
  TextInput,
} from '../../components/ui';
import styles from './Profile.module.css';

const DIETARY_OPTIONS = [
  'vegetarian',
  'vegan',
  'glutenFree',
  'lactoseFree',
  'keto',
  'lowCarb',
  'mediterranean',
] as const;

const COMMON_ALLERGIES = [
  'nuts',
  'peanuts',
  'eggs',
  'soy',
  'fish',
  'shellfish',
  'sesame',
] as const;

export default function Profile() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState(2000);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setDailyCalorieGoal(user.preferences?.dailyCalorieGoal ?? 2000);
      setDietaryRestrictions(user.preferences?.dietaryRestrictions ?? []);
      setAllergies(user.preferences?.allergies ?? []);
    }
  }, [user]);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const result = await dispatch(
      updateProfile({
        name,
        email,
        preferences: { dailyCalorieGoal, dietaryRestrictions, allergies },
      })
    );
    if (updateProfile.fulfilled.match(result)) {
      setMessage(t('profile.savedMessage'));
    }
  };

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('profile.title')}</h1>
      </header>

      <form onSubmit={handleSubmit} className={styles.card}>
        <div className={styles.row}>
          <FormField label={t('profile.name')} required>
            <TextInput value={name} onChange={setName} ariaLabel={t('profile.name')} />
          </FormField>
          <FormField label={t('profile.email')} required>
            <TextInput
              value={email}
              onChange={setEmail}
              variant="email"
              ariaLabel={t('profile.email')}
            />
          </FormField>
          <FormField label={t('profile.calorieGoal')}>
            <NumberInput
              value={dailyCalorieGoal}
              onChange={setDailyCalorieGoal}
              min={500}
              max={6000}
              step={50}
              allowDecimals={false}
              showSteppers
              ariaLabel={t('profile.calorieGoal')}
            />
          </FormField>
        </div>

        <FieldSet legend={t('profile.dietaryTitle')}>
          <ChipGroup>
            {DIETARY_OPTIONS.map((key) => (
              <Chip
                key={key}
                active={dietaryRestrictions.includes(key)}
                onClick={() => toggle(dietaryRestrictions, setDietaryRestrictions, key)}
              >
                {t(`profile.dietary.${key}`)}
              </Chip>
            ))}
          </ChipGroup>
        </FieldSet>

        <FieldSet legend={t('profile.allergiesTitle')}>
          <ChipGroup>
            {COMMON_ALLERGIES.map((key) => (
              <Chip
                key={key}
                active={allergies.includes(key)}
                onClick={() => toggle(allergies, setAllergies, key)}
              >
                {t(`profile.allergies.${key}`)}
              </Chip>
            ))}
          </ChipGroup>
        </FieldSet>

        {message && <Alert variant="success">{message}</Alert>}

        <div className={styles.submit}>
          <Button type="submit" variant="primary">
            {t('profile.saveButton')}
          </Button>
        </div>
      </form>
    </div>
  );
}
