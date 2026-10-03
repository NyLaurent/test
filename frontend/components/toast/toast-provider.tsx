"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

type ToastInput = {
  title: string;
  description?: string;
  kind?: ToastKind;
  duration?: number;
};

type Toast = ToastInput & {
  id: number;
  kind: ToastKind;
  duration: number;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const DEFAULT_DURATION = 5000;

const kindStyles: Record<ToastKind, { icon: string; accent: string; Icon: typeof CheckCircle2 }> = {
  success: {
    icon: "bg-status-good/10 text-status-good",
    accent: "bg-status-good",
    Icon: CheckCircle2,
  },
  error: {
    icon: "bg-status-bad/10 text-status-bad",
    accent: "bg-status-bad",
    Icon: CircleAlert,
  },
  info: {
    icon: "bg-brand-soft-blue text-brand-blue",
    accent: "bg-brand-blue",
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timeouts = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timeout = timeouts.current.get(id);
    if (timeout) clearTimeout(timeout);
    timeouts.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ kind = "info", duration = DEFAULT_DURATION, ...input }: ToastInput) => {
      const id = ++nextId.current;
      const toast: Toast = { ...input, id, kind, duration };
      setToasts((current) => [...current.slice(-3), toast]);
      timeouts.current.set(id, setTimeout(() => dismissToast(id), duration));
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      for (const timeout of timeouts.current.values()) clearTimeout(timeout);
      timeouts.current.clear();
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6"
      >
        {toasts.map((toast) => {
          const styles = kindStyles[toast.kind];
          const Icon = styles.Icon;
          return (
            <div
              key={toast.id}
              role={toast.kind === "error" ? "alert" : "status"}
              aria-live={toast.kind === "error" ? "assertive" : "polite"}
              className="toast-enter pointer-events-auto relative overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_16px_45px_rgba(15,23,42,0.16)]"
            >
              <div className="flex items-start gap-3 p-4">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${styles.icon}`}>
                  <Icon aria-hidden="true" size={19} strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-brand-navy">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 text-sm leading-5 text-muted-text">{toast.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-lg p-1 text-muted-text transition hover:bg-page-background hover:text-brand-navy"
                >
                  <X aria-hidden="true" size={17} />
                </button>
              </div>
              <div
                aria-hidden="true"
                className={`toast-progress absolute bottom-0 left-0 h-[3px] ${styles.accent}`}
                style={{ animationDuration: `${toast.duration}ms` }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
