import type React from 'react';

/**
 * Empty state for the day view (build chat 039). Two variants driven by
 * selectEmptyStateVariant (planViewHelpers):
 *   (a) 'no-plan-yet'      — GET returned PLAN_NOT_FOUND (404): no plan exists for
 *                            this date yet. Shows a generate CTA that triggers
 *                            POST /plans/generate (the page owns the stream).
 *   (b) 'fallback-apology' — a prior generate came back source:'fallback' with a
 *                            `fallbackNotice` apology: no plan can be built right
 *                            now. Shows the apology; retry re-runs generation.
 *
 * Read-only surface; the actual POST/stream lives in the page. Chrome composes
 * @vesper/ui Layer-4 tokens (bg-surface / text-cream / bg-bronze) — no hex.
 */
export function PlanEmpty({
  variant,
  fallbackNotice,
  onGenerate,
  isGenerating = false,
}: {
  variant: 'no-plan-yet' | 'fallback-apology' | 'error';
  fallbackNotice?: string | null;
  onGenerate: () => void;
  isGenerating?: boolean;
}): React.JSX.Element {
  if (variant === 'error') {
    return (
      <div className="rounded-lg border border-line-subtle bg-surface p-10 text-center shadow-raised">
        <p className="text-base font-medium text-cream">Could not load your plan.</p>
        <p className="mt-1 text-sm text-cream-muted">
          Something went wrong reaching your day. Please try again.
        </p>
      </div>
    );
  }

  const isFallback = variant === 'fallback-apology';

  return (
    <div className="rounded-lg border border-line-subtle bg-surface p-10 text-center shadow-raised">
      <p className="text-lg font-medium text-cream">
        {isFallback ? 'No plan just now' : 'No plan yet'}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-cream-muted">
        {isFallback
          ? (fallbackNotice ??
            'I was not able to put your day together right now. Please try again in a moment.')
          : 'Your day has not been planned yet. Generate a plan to fill in your blocks.'}
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating}
        className="mt-6 rounded-md bg-bronze px-4 py-2 text-sm font-medium text-espresso shadow-raised transition-[opacity,box-shadow,transform] duration-quick ease-standard-out hover:opacity-90 hover:shadow-floating focus-visible:shadow-glow active:scale-95 active:shadow-press disabled:opacity-60"
      >
        {isGenerating ? 'Generating…' : isFallback ? 'Try again' : 'Generate plan'}
      </button>
    </div>
  );
}
