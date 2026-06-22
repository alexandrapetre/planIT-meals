import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from '../../i18n';
import { Button, Select } from '../ui';
import styles from './Navbar.module.css';

export default function Navbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const { t, i18n } = useTranslation();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  };

  const languageOptions = SUPPORTED_LANGUAGES.map((lng) => ({
    value: lng,
    label: t(`language.${lng}`),
  }));

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [styles.link, isActive && styles.active].filter(Boolean).join(' ');

  return (
    <header className={styles.navbar}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.brand} aria-label={t('nav.brandFull')}>
          <img src="/logo.png" alt={t('nav.brandFull')} className={styles.brandLogo} />
        </Link>
        <nav className={styles.links}>
          {user ? (
            <>
              <div className={styles.linksDesktopOnly}>
                <NavLink to="/" end className={navLinkClass}>
                  {t('nav.dashboard')}
                </NavLink>
                <NavLink to="/recipes" className={navLinkClass}>
                  {t('nav.recipes')}
                </NavLink>
                <NavLink to="/tracking" className={navLinkClass}>
                  {t('nav.tracking')}
                </NavLink>
                <NavLink to="/fridge" className={navLinkClass}>
                  {t('nav.fridge')}
                </NavLink>
                <NavLink to="/meal-plan" className={navLinkClass}>
                  {t('nav.mealPlan')}
                </NavLink>
                <NavLink to="/profile" className={navLinkClass}>
                  {t('nav.profile')}
                </NavLink>
              </div>
              <span className={styles.userBadge}>{user.name}</span>
              <div className={styles.logoutWrapper}>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  {t('nav.logout')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navLinkClass}>
                {t('nav.login')}
              </NavLink>
              <NavLink to="/register" className={`${styles.registerButton}`}>
                <Button variant="primary" size="sm">
                  {t('nav.register')}
                </Button>
              </NavLink>
            </>
          )}
          <div className={styles.languageSelect}>
            <Select
              value={i18n.language}
              onChange={handleLanguageChange}
              options={languageOptions}
              ariaLabel={t('language.label')}
            />
          </div>
        </nav>
      </div>
    </header>
  );
}
