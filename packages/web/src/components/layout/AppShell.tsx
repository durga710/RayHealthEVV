import { useState, useEffect, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2,
  Users,
  UserRound,
  FileCheck2,
  CalendarRange,
  ClipboardList,
  ClipboardCheck,
  ListChecks,
  GraduationCap,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  Sun,
  Moon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'Organization',
    items: [
      { to: '/admin/agency', label: 'Agency Setup', icon: Building2 },
      { to: '/admin/staff', label: 'Staff', icon: Users },
      { to: '/admin/clients', label: 'Clients', icon: UserRound },
      { to: '/admin/authorizations', label: 'Authorizations', icon: FileCheck2 },
    ],
  },
  {
    heading: 'Scheduling',
    items: [
      { to: '/admin/templates', label: 'Templates', icon: CalendarRange },
      { to: '/admin/assignments', label: 'Assignments', icon: ClipboardList },
    ],
  },
  {
    heading: 'Visits',
    items: [
      { to: '/admin/review', label: 'Visit Review', icon: ClipboardCheck },
      { to: '/admin/corrections', label: 'Corrections Queue', icon: ListChecks, end: true },
      { to: '/admin/corrections/tracking', label: 'Corrections Tracking', icon: ListChecks },
    ],
  },
  {
    heading: 'Workforce',
    items: [
      { to: '/admin/learning', label: 'Learning Hub', icon: GraduationCap },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-foreground no-underline',
        className,
      )}
    >
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground shadow-sm">
        R
      </span>
      RayHealth
      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-bold tracking-[0.18em] text-primary">
        EVV
      </span>
    </Link>
  );
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-(--duration-fast)',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'size-4 shrink-0 transition-colors',
              isActive
                ? 'text-sidebar-accent-foreground'
                : 'text-muted-foreground/70 group-hover:text-sidebar-foreground',
            )}
          />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <BrandMark className="px-2" />

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto" aria-label="Primary">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading} className="flex flex-col gap-1">
            <p className="px-3 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              {section.heading}
            </p>
            {section.items.map((item) => (
              <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-bold uppercase text-primary">
          {(user?.role ?? '?').slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold capitalize text-sidebar-foreground">
            {user?.role ?? 'Account'}
          </p>
          <p className="truncate text-2xs text-muted-foreground">Signed in</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void logout()}
          aria-label="Sign out"
          className="size-8 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Sun className="size-4.5 scale-100 rotate-0 transition-transform duration-(--duration-medium) dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4.5 scale-0 rotate-90 transition-transform duration-(--duration-medium) dark:scale-100 dark:rotate-0" />
    </Button>
  );
}

function AppHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <BrandMark className="lg:hidden" />

      {/* Global search affordance (command palette lands in a later milestone). */}
      <button
        type="button"
        onClick={() => toast('Global search & ⌘K command palette arrive in the next milestone.')}
        className="ml-auto hidden h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex lg:ml-0"
      >
        <Search className="size-4" />
        <span>Search…</span>
        <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => toast('Search arrives in the next milestone.')}
          aria-label="Search"
        >
          <Search className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toast('You have no new notifications.')}
          aria-label="Notifications"
        >
          <Bell className="size-5" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarNav />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-xs animate-(--animate-fade-in)"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-sidebar-border bg-sidebar shadow-xl animate-(--animate-slide-up)"
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-3 z-10"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </Button>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenSidebar={() => setMobileOpen(true)} />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10 animate-(--animate-fade-in)">
            {/* Keyed by pathname so a crash on one route clears when navigating away. */}
            <RouteErrorBoundary key={location.pathname}>
              <Outlet />
            </RouteErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
