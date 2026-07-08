// Pure unit test for the authored butler-line copy library (copy/index.ts).
// No env, no DB, no react-native — a plain string/template assertion.
import { describe, it, expect } from 'vitest';
import { billDueTomorrow, BILL_DUE_TOMORROW_COPY_ID } from './index';

describe('billDueTomorrow', () => {
  it('renders "<name> is due tomorrow." with the bill name in the template slot', () => {
    expect(billDueTomorrow('Rent')).toBe('Rent is due tomorrow.');
    expect(billDueTomorrow('Car insurance')).toBe('Car insurance is due tomorrow.');
  });

  it('exposes a stable copy id for later consolidation (Chat 044/075)', () => {
    expect(BILL_DUE_TOMORROW_COPY_ID).toBe('finance.bill_due_tomorrow');
  });
});
