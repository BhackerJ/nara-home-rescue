export function NaraMark({
  className = "",
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full ${
          light ? "bg-cream text-sage" : "bg-sage text-cream"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M7 1.4c.3 1.8 1.4 3.1 3.3 3.6-1.9.5-3 1.8-3.3 3.6-.3-1.8-1.4-3.1-3.3-3.6C5.6 4.5 6.7 3.2 7 1.4Z"
            fill="currentColor"
          />
          <circle cx="7" cy="11.2" r="1.1" fill="currentColor" opacity="0.85" />
        </svg>
      </span>
      <span
        className={`nara-serif text-[17px] font-medium tracking-tight ${light ? "text-cream" : "text-ink"}`}
      >
        Nara
      </span>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
}: {
  children: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-full items-center justify-center rounded-full bg-sage text-[16px] font-semibold text-cream shadow-[0_10px_24px_rgba(63,92,74,0.22)] transition active:scale-[0.98]"
    >
      {children}
    </button>
  );
}
