import { NavLink, Outlet } from 'react-router-dom';

const navLinks = [
  { to: '/', label: '🏠 Home', end: true },
  { to: '/world', label: '🗺️ World Map' },
  { to: '/parent', label: '👨‍👩‍👧 Parents' },
];

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-ocean-700/50 bg-ocean-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="group flex items-center gap-2">
            <span className="text-3xl transition-transform duration-300 group-hover:animate-wave">
              🧜‍♀️
            </span>
            <span className="font-quest text-2xl text-shadow-glow text-ocean-200">
              Mermaid Quest Academy
            </span>
          </NavLink>

          <nav className="flex items-center gap-1">
            {navLinks.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'rounded-xl px-4 py-2 font-quest text-sm transition-all duration-200',
                    isActive
                      ? 'bg-ocean-500/30 text-ocean-200 shadow-ocean'
                      : 'text-pearl-300 hover:bg-white/10 hover:text-white',
                  ].join(' ')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-ocean-800/50 bg-ocean-950/80 py-4 text-center">
        <p className="font-body text-sm text-ocean-600">
          🌊 Mermaid Quest Academy — Dive into Learning 🌊
        </p>
      </footer>
    </div>
  );
}
