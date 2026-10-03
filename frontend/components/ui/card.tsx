import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return <div className={`rounded-xl border border-border bg-surface ${className}`} {...props} />;
}

export function CardHeader({ className = "", ...props }: CardProps) {
  return <div className={`border-b border-border px-5 py-4 sm:px-6 ${className}`} {...props} />;
}

export function CardTitle({ className = "", ...props }: CardProps) {
  return <h2 className={`text-base font-semibold text-brand-navy ${className}`} {...props} />;
}

export function CardDescription({ className = "", ...props }: CardProps) {
  return <p className={`mt-1 text-sm text-muted-text ${className}`} {...props} />;
}

export function CardContent({ className = "", ...props }: CardProps) {
  return <div className={`p-5 sm:p-6 ${className}`} {...props} />;
}
