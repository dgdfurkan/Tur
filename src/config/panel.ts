import type { LockSettings } from '@/features/admin/access/PanelLock';
import lock from './panel-lock.json';

/**
 * The lock of builds made for the end-to-end tests (`astro build --mode e2e`).
 * Its code is public, in tests/panelCode.ts, so the tests never need the real
 * one. A production build does not contain this lock: the comparison below is
 * resolved at build time and the unused branch is dropped.
 */
const TEST_LOCK: LockSettings = {
  salt: '00112233445566778899aabbccddeeff',
  verifier: 'f947cd1ae1b2432d679840b02f3556f38cbf92747e49ce1c2eaa295e8e49d037',
  iterations: 1000,
};

/** The fingerprint of the panel's access code. Change the code with `npm run panel:code`. */
export const panelLock: LockSettings = import.meta.env.MODE === 'e2e' ? TEST_LOCK : lock;
