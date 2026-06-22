import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './BottomTabs.module.css';

type IconKey =
  | 'home'
  | 'search'
  | 'tracking'
  | 'plan'
  | 'fridge'
  | 'profile';

interface TabConfig {
  to: string;
  labelKey: string;
  icon: IconKey;
  end?: boolean;
}

const TABS: TabConfig[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: 'home', end: true },
  { to: '/recipes', labelKey: 'nav.recipes', icon: 'search' },
  { to: '/tracking', labelKey: 'nav.tracking', icon: 'tracking' },
  { to: '/fridge', labelKey: 'nav.fridge', icon: 'fridge' },
  { to: '/profile', labelKey: 'nav.profile', icon: 'profile' },
];

function TabIcon({ name }: { name: IconKey }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'tracking':
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case 'plan':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 3v3M15 3v3M8 10h8M8 14h6M8 18h4" />
        </svg>
      );
    case 'fridge':
      return (
        <svg {...common}>
          <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M5 10h14" />
          <path d="M8 6v2M8 13v3" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      );
  }
}

export default function BottomTabs() {
  const { t } = useTranslation();

  return (
    <nav className={styles.bottomTabs} aria-label={t('nav.primary')}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            [styles.tab, isActive && styles.tabActive].filter(Boolean).join(' ')
          }
        >
          <span className={styles.icon}>
            <TabIcon name={tab.icon} />
          </span>
          <span className={styles.label}>{t(tab.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
