// ButlerVoice — the rendered butler-line voice surface (Layer 4 / Chat 107a).
//
// Composition decision (107a #7): a thin wrapper that composes the EXISTING 107
// ButlerLine container, NOT a new container and NOT a re-encoding of the butler
// type role. ButlerLine already owns the role (font-display italic + text-cream-faint
// + leading-butler) and the empty-renders-nothing behaviour; this surface only
// places it and exposes a `copy` slot for the voice-gated line authored later
// (Chat 044). It authors NO copy of its own and renders nothing when the slot is
// empty. It is NOT a scorekeeping surface — there is no number, score, or progress
// here, only the butler's quiet line.
import * as React from 'react';
import { ButlerLine } from './ButlerLine';

export interface ButlerVoiceProps {
  /** Voice-gated copy supplied by the surface (Chat 044). Empty => nothing renders. */
  copy?: string;
  className?: string;
}

export function ButlerVoice({ copy, className }: ButlerVoiceProps) {
  return <ButlerLine className={className}>{copy}</ButlerLine>;
}
