'use client';

// Web Modules list (ADD-A) — the /modules surface. The web app shell
// (app/(app)/layout.tsx) has no persistent tab bar, so the Modules list is a
// standalone page: a column of rounded Cards (107 primitive), one per landed
// module, each routing to its own full page; a "Settings" card is pinned at the
// bottom, routing to the existing /settings surface.
//
// Cards route to self-gating pages, so a module card is shown whether the module
// is on or off (never a dead link); an at-a-glance On/Off hint reads the same
// GET /api/v1/profile gate the pages use (singular keys medication / finance).
// Card composition + tokens only — no token or 107 primitive VALUE is changed.
//
// IMPORT SAFETY: this 'use client' file imports NO @vesper/shared barrel (which
// would pull server-only code into the client bundle). The module catalog lives in
// the client-safe @/lib/modules (pure data). See docs/MODULE_MOUNT_CONTRACT.md.
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui';
import { MODULE_CARDS, isModuleEnabled, type ModuleGate } from '@/lib/modules';

export default function ModulesPage(): React.JSX.Element {
  const { data: gate } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<ModuleGate>('/profile'),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-cream">Modules</h1>
        <p className="text-sm text-cream-muted">
          Your lifestyle modules and application settings.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {MODULE_CARDS.map((card) => {
          const on = isModuleEnabled(gate, card.gateKey);
          return (
            // UrlObject href form: typedRoutes validates a bare string against the
            // generated Route union, which lags a freshly-added route; the
            // { pathname } object form is accepted while remaining a valid runtime
            // path.
            <Link key={card.key} href={{ pathname: card.route }} className="block">
              <Card className="flex items-center justify-between p-4 transition-colors hover:border-line-strong">
                <div className="pr-3">
                  <p className="text-base text-cream">{card.title}</p>
                  <p className="text-sm text-cream-faint">{card.subtitle}</p>
                </div>
                <span className="text-xs text-cream-muted">{on ? 'On' : 'Off'}</span>
              </Card>
            </Link>
          );
        })}

        {/* Settings — pinned at the bottom of the list, not a module. */}
        <Link href={{ pathname: '/settings' }} className="block">
          <Card className="flex items-center justify-between p-4 transition-colors hover:border-line-strong">
            <div className="pr-3">
              <p className="text-base text-cream">Settings</p>
              <p className="text-sm text-cream-faint">
                Integrations, privacy, and subscription
              </p>
            </div>
            <span className="text-xs text-cream-muted">›</span>
          </Card>
        </Link>
      </div>
    </main>
  );
}
