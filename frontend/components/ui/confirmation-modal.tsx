"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

type ConfirmationModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
  isDestructive?: boolean;
  isPending?: boolean;
  confirmDisabled?: boolean;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  children,
  isDestructive = false,
  isPending = false,
  confirmDisabled = false,
}: ConfirmationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  const confirmRef = useRef(onConfirm);

  useEffect(() => {
    cancelRef.current = onCancel;
    confirmRef.current = onConfirm;
  }, [onCancel, onConfirm]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-brand-navy/45 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancelRef.current();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-description"
        tabIndex={-1}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface outline-none"
      >
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            isDestructive ? "bg-status-bad/10 text-status-bad" : "bg-brand-soft-blue text-brand-blue"
          }`}>
            <AlertTriangle aria-hidden="true" size={21} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="confirmation-modal-title" className="text-lg font-semibold text-brand-navy">
              {title}
            </h2>
            <p id="confirmation-modal-description" className="mt-2 text-sm leading-6 text-muted-text">
              {description}
            </p>
            {children}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => cancelRef.current()}
            className="rounded-lg p-1.5 text-muted-text transition hover:bg-page-background hover:text-brand-navy"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-page-background/60 p-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={() => cancelRef.current()}
            className="min-h-10 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-body-text transition hover:bg-page-background"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => confirmRef.current()}
            disabled={isPending || confirmDisabled}
            className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isDestructive ? "bg-status-bad hover:bg-status-bad/90" : "bg-brand-blue hover:bg-brand-blue-hover"
            }`}
          >
            {isPending ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
