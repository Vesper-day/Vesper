// Unit tests for the TaskForm submission guard + payload builder (Chat 054-W).
//
// The component's validation and the exact create-vs-edit wire shapes are extracted
// into the pure `buildSubmission` helper so they can be asserted without a DOM
// render harness (@testing-library is not a dependency here). Coverage:
//   - estimatedMinutes guard blocks submit (blank / zero / negative / non-integer)
//   - required-title guard blocks submit
//   - deadline-clear emits null on EDIT (PATCH deadline:null clears)
//   - create vs edit payload shapes (create OMITS deadline when blank + has no
//     status; edit sends status + deadline:null)
import { describe, it, expect } from 'vitest';
import { buildSubmission, type SubmissionInput } from './TaskForm';

function base(overrides: Partial<SubmissionInput> = {}): SubmissionInput {
  return {
    isEdit: false,
    title: 'Draft the proposal',
    minutes: '30',
    deadlineLocal: '',
    priority: 'medium',
    status: 'pending',
    ...overrides,
  };
}

describe('buildSubmission — guards', () => {
  it('blocks submit when title is blank / whitespace', () => {
    const r = buildSubmission(base({ title: '   ' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/title/i);
  });

  it.each(['', '0', '-5', '12.5', 'abc'])(
    'blocks submit when estimatedMinutes is %p (not a whole number > 0)',
    (minutes) => {
      const r = buildSubmission(base({ minutes }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/whole number/i);
    },
  );

  it('accepts a valid positive integer estimate', () => {
    const r = buildSubmission(base({ minutes: '45' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.estimatedMinutes).toBe(45);
  });
});

describe('buildSubmission — create payload shape', () => {
  it('builds a create body with title/estimatedMinutes/priority and OMITS deadline when blank', () => {
    const r = buildSubmission(
      base({ isEdit: false, title: '  Write spec  ', minutes: '20', priority: 'high' }),
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.mode === 'create') {
      expect(r.body).toEqual({
        title: 'Write spec', // trimmed
        estimatedMinutes: 20,
        priority: 'high',
      });
      // No deadline key on create when blank; never a status field.
      expect(r.body).not.toHaveProperty('deadline');
      expect(r.body).not.toHaveProperty('status');
    } else {
      throw new Error('expected create mode');
    }
  });

  it('includes deadline on create when provided', () => {
    const r = buildSubmission(base({ isEdit: false, deadlineLocal: '2026-07-01T09:00' }));
    expect(r.ok).toBe(true);
    if (r.ok && r.mode === 'create') {
      expect(typeof r.body.deadline).toBe('string');
      expect(r.body.deadline).not.toBe('');
    } else {
      throw new Error('expected create mode');
    }
  });
});

describe('buildSubmission — edit payload shape', () => {
  it('builds an update body carrying status (incl. in_progress)', () => {
    const r = buildSubmission(
      base({ isEdit: true, status: 'in_progress', priority: 'low', minutes: '15' }),
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.mode === 'update') {
      expect(r.body).toEqual({
        title: 'Draft the proposal',
        estimatedMinutes: 15,
        priority: 'low',
        status: 'in_progress',
        deadline: null, // blank => cleared
      });
    } else {
      throw new Error('expected update mode');
    }
  });

  it('emits deadline:null on EDIT when the deadline is cleared', () => {
    const r = buildSubmission(base({ isEdit: true, deadlineLocal: '' }));
    expect(r.ok).toBe(true);
    if (r.ok && r.mode === 'update') {
      expect(r.body.deadline).toBeNull();
    } else {
      throw new Error('expected update mode');
    }
  });
});
