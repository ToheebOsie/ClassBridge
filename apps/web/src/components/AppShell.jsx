import { cx } from '../lib/cx.js';
import { Icon } from './Icon.jsx';

/**
 * The frame around every signed-in page: school name and badge on top
 * ("Powered by ClassBridge" beneath), the role's own sidebar, and the page.
 * `nav`: [{ id, label, icon, alert? }]
 */
export function AppShell({ school, role, user, nav, current, onNavigate, children }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-sm font-bold text-white"
            aria-hidden="true"
          >
            {school.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-tight text-ink">{school.name}</p>
            <p className="text-xs text-muted">Powered by ClassBridge</p>
          </div>
          <div className="ml-auto hidden text-right sm:block">
            <p className="text-sm font-medium text-ink">{user}</p>
            <p className="text-xs capitalize text-muted">{role}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <nav aria-label={`${role} menu`} className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {nav.map((item) => {
              const active = item.id === current;
              return (
                <li key={item.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => onNavigate(item.id)}
                    className={cx(
                      'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors whitespace-nowrap',
                      active ? 'bg-accent-soft text-accent' : 'text-body hover:bg-line/50',
                    )}
                  >
                    <Icon name={item.icon} size={18} />
                    {item.label}
                    {item.alert && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-warn" aria-label="needs attention" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
