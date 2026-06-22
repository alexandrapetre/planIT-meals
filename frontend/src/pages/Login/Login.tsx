import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store';
import { clearError, login } from '../../store/slices/authSlice';
import { Alert, Button, FormField, TextInput } from '../../components/ui';
import styles from './Login.module.css';

export default function Login() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, status, error } = useAppSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = await dispatch(login({ email, password }));
    if (login.fulfilled.match(result)) {
      navigate('/');
    }
  };

  const isLoading = status === 'loading';

  return (
    <div className={styles.card}>
      <div className={styles.brand}>
        <img src="/logo.png" alt={t('nav.brandFull')} className={styles.brandLogo} />
      </div>
      <h1 className={styles.title}>{t('auth.login.title')}</h1>
      <p className={styles.subtitle}>{t('auth.login.subtitle')}</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <FormField label={t('auth.email')} required>
          <TextInput
            value={email}
            onChange={setEmail}
            variant="email"
            ariaLabel={t('auth.email')}
          />
        </FormField>
        <FormField label={t('auth.password')} required>
          <TextInput
            value={password}
            onChange={setPassword}
            variant="password"
            ariaLabel={t('auth.password')}
          />
        </FormField>

        {error && <Alert variant="error">{t(error)}</Alert>}

        <Button type="submit" variant="primary" disabled={isLoading} block>
          {isLoading ? t('auth.login.loading') : t('auth.login.button')}
        </Button>
      </form>

      <p className={styles.footer}>
        {t('auth.login.noAccount')} <Link to="/register">{t('auth.login.registerLink')}</Link>
      </p>
    </div>
  );
}
