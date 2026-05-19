import { NavLink, Outlet, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';

const ADMIN_ROLES = new Set(['admin', 'coordinator']);

const NAV = [
  {
    to: '/portal',
    end: true,
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    to: '/portal/schedule',
    end: false,
    label: 'My Schedule',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    to: '/portal/visits',
    end: false,
    label: 'My Visits',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    to: '/portal/profile',
    end: false,
    label: 'My Profile',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export function CaregiverLayout() {
  const { user, logout } = useAuth();

  if (user && ADMIN_ROLES.has(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    'Caregiver';
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Primary">
        <Link to="/portal" className="admin-sidebar__brand">
          RayHealth
          <span className="admin-sidebar__evv-badge">EVV</span>
        </Link>

        <nav className="admin-sidebar__nav">
          <div className="admin-sidebar__group">
            <div className="admin-sidebar__group-label">Caregiver</div>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `admin-sidebar__nav-link${isActive ? ' active' : ''}`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="admin-sidebar__user-card">
          <div className="admin-sidebar__user-row">
            <div
              aria-hidden
              className="admin-sidebar__avatar"
              style={user?.avatarUrl ? { padding: 0, overflow: 'hidden' } : undefined}
            >
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'capitalize' }}>
                {user?.role ?? 'caregiver'}
              </span>
            </div>
          </div>
          <span className="admin-sidebar__role-badge">{user?.role ?? 'caregiver'}</span>
          <button type="button" onClick={logout} className="admin-sidebar__signout">
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
