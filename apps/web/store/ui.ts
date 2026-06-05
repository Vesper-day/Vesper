import { create } from 'zustand';

/**
 * UI slice — toasts, modal state, theme preference. All in-memory; NOT
 * persisted (Decision 05). MUST NOT import @vesper/db.
 */
export type ToastVariant = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

export type ThemePreference = 'system' | 'light' | 'dark';

interface UiState {
  toasts: Toast[];
  openModalId: string | null;
  theme: ThemePreference;

  enqueueToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;

  openModal: (id: string) => void;
  closeModal: () => void;

  setTheme: (theme: ThemePreference) => void;
}

function toastId(): string {
  return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  openModalId: null,
  theme: 'system',

  enqueueToast: (toast) => {
    const id = toastId();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  openModal: (id) => set({ openModalId: id }),
  closeModal: () => set({ openModalId: null }),

  setTheme: (theme) => set({ theme }),
}));
