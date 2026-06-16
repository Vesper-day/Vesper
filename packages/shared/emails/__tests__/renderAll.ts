// Chat 091 render harness. Renders all five transactional email templates to
// static HTML and writes one file per template into ../output/ for visual review
// across Gmail, Outlook, Apple Mail, and major mobile clients. Inline styles are
// what make the templates render consistently in those clients.
//
// Fully offline: NO model calls, NO database, NO real sends. The only runtime here
// is React Email's `render`, which serializes JSX to an HTML string.
//
// Run with vitest (the repo's installed TS+JSX runner). This file lives outside
// `src/` so the default `pnpm --filter @vesper/shared test` (include: src/**) does
// not pick it up; point vitest at it explicitly, e.g.:
//   pnpm --filter @vesper/shared exec vitest run --root . --dir emails \
//     --config <a config whose include covers emails/__tests__/**>
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from '@react-email/components';
import { test, expect } from 'vitest';

import MagicLinkEmail from '../MagicLinkEmail';
import WelcomeEmail from '../WelcomeEmail';
import Trial2DayEmail from '../Trial2DayEmail';
import Trial1DayEmail from '../Trial1DayEmail';
import Trial0DayEmail from '../Trial0DayEmail';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(HERE, '../output');

// Sample props only — no PII, no real tokens. URLs are placeholders for layout.
const samples: ReadonlyArray<{ file: string; element: React.JSX.Element }> = [
  {
    file: 'MagicLinkEmail.html',
    element: MagicLinkEmail({ confirmationUrl: 'https://vesper.day/auth/confirm?token=SAMPLE' }),
  },
  {
    file: 'WelcomeEmail.html',
    element: WelcomeEmail({ appUrl: 'https://vesper.day/app' }),
  },
  {
    file: 'Trial2DayEmail.html',
    element: Trial2DayEmail({ appUrl: 'https://vesper.day/app' }),
  },
  {
    file: 'Trial1DayEmail.html',
    element: Trial1DayEmail({ continueUrl: 'https://vesper.day/billing/continue' }),
  },
  {
    file: 'Trial0DayEmail.html',
    element: Trial0DayEmail({
      blocksArranged: 42,
      conflictsResolved: 6,
      mealsPlanned: 18,
      daysReshuffled: 4,
      continueUrl: 'https://vesper.day/billing/continue',
      endUrl: 'https://vesper.day/billing/end',
    }),
  },
];

test('renders all five email templates to HTML', async () => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const { file, element } of samples) {
    const html = await render(element);
    expect(html).toContain('<html');
    writeFileSync(resolve(OUTPUT_DIR, file), html, 'utf8');
  }
});
