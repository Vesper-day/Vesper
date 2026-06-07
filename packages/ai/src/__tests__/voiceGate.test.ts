import { afterEach, describe, expect, it, vi } from 'vitest';
import { voiceGate, reviewer, SAMPLE_RATES } from '../voiceGate';
import { applyRegexLayer } from '../voiceGate.regex';

afterEach(() => {
  vi.restoreAllMocks();
});

// [HONORIFIC] resolves to ", sir" / ", madam" / "" (LAYER_4_EXPERIENCE_IDENTITY.md).
// Other bracket tokens are concrete copy slots; we expand to representative values.
function expand(line: string): string {
  return line
    .replace(/\[HONORIFIC\]/g, ', sir')
    .replace(/\[Day\]/g, 'Tuesday')
    .replace(/\[Next block\]/g, 'Lunch')
    .replace(/\[n\]/g, '4');
}

// LAYER_4_EXPERIENCE_IDENTITY.md line library + PRD §5.3 sample copy. Every line
// must pass the gate unchanged and trip neither the regex nor the flag layer.
const LAYER_4_LINES = [
  'Good morning[HONORIFIC]. [Day] is ready.',
  'Good morning[HONORIFIC]. Your day begins.',
  'Morning[HONORIFIC]. Everything is in place.',
  "Good morning[HONORIFIC]. You're already underway.",
  'Morning[HONORIFIC]. Three down, [n] to go.',
  'Halfway through[HONORIFIC].',
  'Good afternoon[HONORIFIC]. [n] blocks remain.',
  "Afternoon[HONORIFIC]. We're on schedule.",
  'Good evening[HONORIFIC]. The day winds down.',
  'Evening[HONORIFIC]. Most of the work is behind us.',
  'Evening[HONORIFIC]. Two more, then rest.',
  'Late hours[HONORIFIC]. Tomorrow is prepared.',
  "It's getting on[HONORIFIC]. Rest when you can.",
  'All done. A fine day.',
  "That's everything. Well managed.",
  'Complete. Until tomorrow[HONORIFIC].',
  'Nothing scheduled. The day is yours.',
  'Quiet today. Enjoy it.',
  'Welcome back. Plan continues.',
  "You're back. [Next block] is up next.",
  'Sunday[HONORIFIC]. Shall we look at the week?',
  'A new week. What needs adjusting?',
  'Planning time[HONORIFIC]. Take your time.',
  'At your service[HONORIFIC].',
  'Configure as you like.',
  'Adjustments here.',
  'Tell me more about yourself[HONORIFIC].',
  'Help me know you better.',
  'Connections live here.',
  'Manage your services.',
  'Nothing on the task list. Add something when ready.',
  'No medications tracked. Add them in settings.',
  'No bills tracked yet.',
  'Still here when you need me[HONORIFIC].',
  "Welcome back. It's been a while.",
];

const SAMPLE_COPY = [
  'Your first day is ready.',
  'Noted. Moving on.',
  'Very good.',
  'Welcome aboard.',
  'Saved.',
];

describe('voiceGate — Layer 4 line library passes unchanged', () => {
  for (const raw of [...LAYER_4_LINES, ...SAMPLE_COPY]) {
    const line = expand(raw);
    it(`leaves "${line}" unchanged and unflagged`, async () => {
      const { cleaned, flags } = applyRegexLayer(line);
      expect(cleaned).toBe(line);
      expect(flags).toEqual([]);
      await expect(voiceGate(line)).resolves.toBe(line);
    });
  }
});

describe('voiceGate — edge cases (word boundaries)', () => {
  it('does not strip "AI" from words that merely contain those letters', () => {
    for (const word of ['available', 'availability', 'maintain', 'claim', 'detail']) {
      expect(applyRegexLayer(word).cleaned).toBe(word);
    }
  });

  it('does not flag tier-B "level" inside "available"/"travel"', () => {
    expect(applyRegexLayer('available travel').flags).not.toContain('level');
    expect(applyRegexLayer('available travel').flags).toEqual([]);
  });

  it('removes a standalone bare "AI" token, word-bounded', () => {
    // "AI" as its own word is removed and whitespace normalized.
    expect(applyRegexLayer('the AI helps').cleaned).toBe('the helps');
  });
});

describe('voiceGate — regex transforms then flags', () => {
  it('"Wow — that\'s great": em-dash replaced and "great" flagged → throws', async () => {
    const { cleaned, flags } = applyRegexLayer("Wow — that's great");
    expect(cleaned).not.toContain('—');
    expect(flags).toContain('great');
    await expect(voiceGate("Wow — that's great")).rejects.toThrow();
  });

  it('"Awesome!": "!" stripped and "awesome" flagged → throws', async () => {
    const { cleaned, flags } = applyRegexLayer('Awesome!');
    expect(cleaned).toBe('Awesome.');
    expect(cleaned).not.toContain('!');
    expect(flags).toContain('awesome');
    await expect(voiceGate('Awesome!')).rejects.toThrow();
  });

  it('"Hey there 👋": emoji stripped, short and unflagged → returned cleaned', async () => {
    const { cleaned, flags } = applyRegexLayer('Hey there 👋');
    expect(cleaned).toBe('Hey there');
    expect(/\p{Extended_Pictographic}/u.test(cleaned)).toBe(false);
    // PRD §5.4 contains no "Hey"/"there" pattern, so this is not flagged; the
    // verifiable behavior is the emoji-strip transform.
    expect(flags).toEqual([]);
    await expect(voiceGate('Hey there 👋')).resolves.toBe('Hey there');
  });
});

describe('voiceGate — sampling logic (Haiku call mocked)', () => {
  // 35 whitespace-delimited tokens (> 30 = in scope), no tier-B words.
  const longText = Array.from({ length: 35 }, () => 'lorem').join(' ');

  it('freeform reviews every in-scope string', async () => {
    expect(SAMPLE_RATES.freeform).toBe(1.0);
    const spy = vi.spyOn(reviewer, 'run').mockResolvedValue({ compliant: true });
    // Even a near-1 rng is below the 1.0 rate, so review always runs.
    await voiceGate(longText, { source: 'freeform', rng: () => 0.99 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('constrained reviews at the 20% rate (rng 0.1 → invoked)', async () => {
    expect(SAMPLE_RATES.constrained).toBe(0.2);
    const spy = vi.spyOn(reviewer, 'run').mockResolvedValue({ compliant: true });
    await voiceGate(longText, { source: 'constrained', rng: () => 0.1 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('constrained skips review when sampled out (rng 0.5 → skipped)', async () => {
    const spy = vi.spyOn(reviewer, 'run').mockResolvedValue({ compliant: true });
    const out = await voiceGate(longText, { source: 'constrained', rng: () => 0.5 });
    expect(spy).not.toHaveBeenCalled();
    expect(out).toBe(longText);
  });

  it('returns the Haiku revision when review is non-compliant with a revision', async () => {
    vi.spyOn(reviewer, 'run').mockResolvedValue({
      compliant: false,
      revision: 'A cleaned butler revision.',
      issues: ['gratitude'],
    });
    const out = await voiceGate(longText, { source: 'freeform', rng: () => 0 });
    expect(out).toBe('A cleaned butler revision.');
  });

  it('throws when review is non-compliant with no usable revision', async () => {
    vi.spyOn(reviewer, 'run').mockResolvedValue({ compliant: false, issues: ['gratitude'] });
    await expect(voiceGate(longText, { source: 'freeform', rng: () => 0 })).rejects.toThrow();
  });
});

describe('voiceGate — degraded mode', () => {
  const longText = Array.from({ length: 35 }, () => 'lorem').join(' ');

  it('skips the Haiku layer when the circuit probe is open, even for freeform', async () => {
    const spy = vi.spyOn(reviewer, 'run').mockResolvedValue({ compliant: true });
    const out = await voiceGate(longText, {
      source: 'freeform',
      rng: () => 0,
      isAnthropicCircuitOpen: () => true,
    });
    expect(spy).not.toHaveBeenCalled();
    expect(out).toBe(longText); // regex-only floor
  });
});

describe('voiceGate — live Haiku integration', () => {
  // Gated on ANTHROPIC_API_KEY so CI without the key still passes.
  const violating = [
    'Thank you so much for using Vesper today, you absolutely crushed it and you are on an',
    'incredible streak. Amazing work, buddy. We appreciate you and cannot wait to celebrate',
    'this milestone with you. Keep it up, champ, you got this and we are so excited.',
  ].join(' ');

  it.skipIf(!process.env.ANTHROPIC_API_KEY)(
    'returns a butler-voice revision for a clearly-violating > 30-word string',
    async () => {
      const out = await voiceGate(violating, { source: 'freeform' });
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
      // The revision must not reintroduce the mechanical violations.
      expect(out).not.toContain('!');
      expect(out).not.toContain('—');
    },
    30_000,
  );
});
