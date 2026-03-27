import { NavLink, Outlet } from 'react-router-dom';

const navLinks = [
  { to: '/', label: '🏠 Home', end: true },
  { to: '/world', label: '🗺️ World Map' },
  { to: '/parent', label: '👨‍👩‍👧 Parents' },
];

/** Decorative bubbles that drift up in the background. */
const BUBBLES: { size: number; left: string; delay: string; duration: string }[] = [
  { size: 10, left: '7%', delay: '0s', duration: '14s' },
  { size: 6, left: '20%', delay: '3s', duration: '18s' },
  { size: 14, left: '36%', delay: '7s', duration: '16s' },
  { size: 8, left: '55%', delay: '1s', duration: '20s' },
  { size: 5, left: '72%', delay: '5s', duration: '15s' },
  { size: 12, left: '87%', delay: '9s', duration: '17s' },
];

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col relative overflow-x-hidden">
      {/* Decorative rising bubbles — pointer-events: none so they never block taps */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0">
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="absolute bottom-0 rounded-full border border-ocean-400/30 bg-ocean-300/10 gpu-accelerated"
            style={{
              width: b.size,
              height: b.size,
              left: b.left,
              animation: `rise ${b.duration} ${b.delay} linear infinite`,
            }}
          />
        ))}
      </div>

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

      {/* Main content — sits above the bubble layer */}
      <main className="relative z-10 flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-ocean-800/50 bg-ocean-950/80 py-4 text-center">
        <p className="font-body text-sm text-ocean-600">
          🌊 Mermaid Quest Academy — Dive into Learning 🌊
        </p>
      </footer>
    </div>
  );
}
