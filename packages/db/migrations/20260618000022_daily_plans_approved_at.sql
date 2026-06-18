-- Migration 22 — daily_plans.approved_at (CD-flag F1 resolution, chat 025)
-- Incremental addition, suffix 22 (docs/MIGRATION_NUMBER_ALLOCATION.md, range 14-30).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.
--
-- CD-flag F1 (PHASE_4_BUILD_PLAN.md): "the daily_plans draft/approved-state
-- migration question." The product is evening-anchored (LAYER_1/2/4): the user
-- reviews and APPROVES a drafted plan for tomorrow during the Vesper hour, then
-- wakes into a day already prepared. Migration 4 (20260601000004_daily_planning)
-- created daily_plans WITHOUT an approved-state column, so the draft -> approve
-- loop has nowhere to record approval.
--
-- Resolution: add a nullable approved_at timestamptz. A freshly generated plan is
-- a DRAFT (approved_at IS NULL); chat 046-W (Vesper evening draft/approve loop)
-- sets approved_at when the user approves. Nullable + no default = additive and
-- backward-compatible: the chat-025 generation path leaves it NULL.

BEGIN;

ALTER TABLE public.daily_plans
  ADD COLUMN approved_at timestamptz;

COMMENT ON COLUMN public.daily_plans.approved_at IS
  'When the user approved this plan in the Vesper hour. NULL = draft, not yet '
  'approved (chat 046-W sets it). Generation leaves it NULL (CD-flag F1).';

COMMIT;
