// Shared mobile fetch wrapper for the Vesper /api/v1 surface.
//
// Responsibilities:
//   - attach the Supabase access token as `Authorization: Bearer <token>`. The
//     token is read through the existing Chat 011 auth layer (the supabase-js
//     client backed by the expo-secure-store adapter) — NOT reimplemented here;
//   - send `X-Vesper-Client: mobile` and `X-App-Version` on every request so the
//     API can enforce the minimum-supported-client gate (MIN_APP_VERSION → 426);
//   - on HTTP 401: clear the session via the auth slice signOut and route to the
//     sign-in screen;
//   - on HTTP 426: raise the non-dismissible "update required" gate (rendered by
//     components/UpdateGateModal).
//
// HARD CONSTRAINT: zero @vesper/db imports. All typing is via @vesper/shared or
// local types; data reaches mobile only through /api/v1 routes.
import { create } from 'zustand';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { supabase } from '../supabase';
import { useAuthStore } from '../../store/auth';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/** App version reported to the API. Sourced from app.config.js via Expo Constants. */
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/**
 * PLACEHOLDER — the live App Store numeric ID does not exist until Cutover (the
 * app is created in App Store Connect at that point). Replace before shipping the
 * update-gate deep link. Used only to build the itms-apps:// URL in the 426 modal.
 */
export const APP_STORE_ID = '0000000000';

/** Error thrown by the API client; carries the HTTP status for callers. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Update-gate store. Set when the API returns 426 Upgrade Required. Once `true`
 * it stays `true` — the gate is intentionally non-dismissible; the only exit is
 * installing the new build. Kept separate from the generic UI slice so that slice
 * can mirror the web shape exactly.
 */
interface UpdateGateState {
  required: boolean;
  trigger: () => void;
}

export const useUpdateGateStore = create<UpdateGateState>((set) => ({
  required: false,
  trigger: () => set({ required: true }),
}));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Vesper-Client': 'mobile',
      'X-App-Version': APP_VERSION,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // Session is invalid/expired — clear it and bounce to sign-in.
    await useAuthStore.getState().signOut();
    router.replace('/(auth)/sign-in');
    throw new ApiError('Unauthorized', 401);
  }

  if (res.status === 426) {
    // Client is below MIN_APP_VERSION — force the non-dismissible update gate.
    useUpdateGateStore.getState().trigger();
    throw new ApiError('Upgrade required', 426);
  }

  if (!res.ok) {
    throw new ApiError(`${res.status} ${res.statusText}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
