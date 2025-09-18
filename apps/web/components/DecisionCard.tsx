'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { clsx } from 'clsx';

type DecisionCardProps = {
  title: string;
  description: string;
  actionLabel: string;
  href?: string;
  onClick?: () => Promise<void> | void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function DecisionCard({ title, description, actionLabel, href, onClick, variant = 'primary', disabled }: DecisionCardProps) {
  const [pending, startTransition] = useTransition();
  const actionable = !disabled && !pending;
  const commonButtonClasses = clsx(
    'rounded-md px-4 py-2 text-sm font-semibold text-white shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
    variant === 'primary' ? 'bg-primary hover:bg-blue-700 focus-visible:outline-primary' : 'bg-slate-700 hover:bg-slate-800 focus-visible:outline-slate-700',
    (disabled || pending) && 'cursor-not-allowed opacity-60'
  );

  const content = (
    <button
      type="button"
      aria-label={actionLabel}
      className={commonButtonClasses}
      disabled={!actionable}
      onClick={
        onClick
          ? () => {
              if (!actionable) return;
              startTransition(async () => {
                await onClick();
              });
            }
          : undefined
      }
    >
      {pending ? 'Loading…' : actionLabel}
    </button>
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </header>
      <div className="mt-2">
        {href ? (
          <Link href={href} className="inline-block" aria-label={actionLabel}>
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    </section>
  );
}
