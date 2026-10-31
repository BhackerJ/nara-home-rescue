"use client";

import type { ReactNode } from "react";

export function NaraMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sage text-cream">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M7 1.4c.3 1.8 1.4 3.1 3.3 3.6-1.9.5-3 1.8-3.3 3.6-.3-1.8-1.4-3.1-3.3-3.6C5.6 4.5 6.7 3.2 7 1.4Z"
            fill="currentColor"
          />
          <circle cx="7" cy="11.2" r="1.1" fill="currentColor" opacity="0.85" />
        </svg>
      </span>
      <span className="nara-serif text-[17px] font-medium tracking-tight text-ink">
        Nara
      </span>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-14 w-full items-center justify-center rounded-full bg-sage text-[16px] font-semibold text-cream shadow-[0_10px_24px_rgba(63,92,74,0.22)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink/70 transition hover:bg-ink/5"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <path
          d="M11.2 3.6 5.8 9l5.4 5.4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function Progress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 px-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            i < step ? "bg-sage" : "bg-line"
          }`}
        />
      ))}
    </div>
  );
}

export function Chip({
  selected,
  children,
  onClick,
  large,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full font-medium transition ${
        large ? "h-14 px-6 text-[18px]" : "h-12 px-5 text-[15px]"
      } ${
        selected
          ? "bg-sage text-cream shadow-[0_6px_16px_rgba(63,92,74,0.18)]"
          : "bg-paper text-ink ring-1 ring-line hover:bg-sage-soft"
      }`}
    >
      {children}
    </button>
  );
}

export function ScreenHeader({
  onBack,
  step,
  status,
  hideProgress,
}: {
  onBack?: () => void;
  step?: number;
  status?: string;
  hideProgress?: boolean;
}) {
  return (
    <div className="sticky top-0 z-20 bg-cream/90 px-5 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        {onBack ? <BackButton onClick={onBack} /> : <span className="w-9" />}
        <NaraMark />
        <span className="w-9" />
      </div>
      {hideProgress ? null : status ? (
        <p className="text-center text-[12px] font-medium tracking-[0.02em] text-muted">
          {status}
        </p>
      ) : (
        <Progress step={step ?? 1} />
      )}
    </div>
  );
}

export function EstimateSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col justify-end bg-ink/25 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-rise rounded-t-[28px] bg-cream px-5 pb-10 pt-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h3 className="nara-serif text-[24px] leading-snug text-ink">
          How Nara estimates cost
        </h3>
        <p className="mt-4 text-[15px] leading-relaxed text-ink/80">
          Nara uses the information in your service request — such as equipment
          type, age, symptoms, and contractor pricing — to show a likely range
          before the visit.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink/80">
          This is <span className="font-semibold">not a final quote</span>. Your
          technician confirms the diagnosis and total price before performing
          repair work.
        </p>
        <p className="mt-4 text-[12px] text-muted">
          Sample pricing for this prototype.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-sage text-[15px] font-semibold text-cream"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
