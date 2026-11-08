// הלוגו של ״שורי״: שור חייכן שהקרן הימנית שלו היא חץ עלייה. אותו ציור כמו public/brand/shori-mark.svg
import { useId } from 'react';
import { clsx } from './format';

export function ShoriMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`sg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7B5CFF" />
          <stop offset="1" stopColor="#4A2BD9" />
        </linearGradient>
        <linearGradient id={`hg${id}`} x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" stopColor="#F0A030" />
          <stop offset="1" stopColor="#FFD66E" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#sg${id})`} />
      <path d="M23 28 C16 27 12.5 22.5 12 15" fill="none" stroke={`url(#hg${id})`} strokeWidth="5.2" strokeLinecap="round" />
      <path d="M41 28 C47 26 50 21 52.5 12.5" fill="none" stroke={`url(#hg${id})`} strokeWidth="5.2" strokeLinecap="round" />
      <path d="M47.6 15.2 L53 10.6 L56.2 16.9" fill="none" stroke={`url(#hg${id})`} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="17.6" cy="33" rx="4.2" ry="2.6" transform="rotate(-18 17.6 33)" fill="#F3DDBA" />
      <ellipse cx="46.4" cy="33" rx="4.2" ry="2.6" transform="rotate(18 46.4 33)" fill="#F3DDBA" />
      <rect x="19.5" y="22.5" width="25" height="28.5" rx="12.5" fill="#FFF8EC" />
      <rect x="22.5" y="38.2" width="19" height="11" rx="5.5" fill="#F3DDBA" />
      <circle cx="28" cy="43.7" r="1.65" fill="#3A2A1A" />
      <circle cx="36" cy="43.7" r="1.65" fill="#3A2A1A" />
      <circle cx="27.2" cy="31.6" r="2.4" fill="#16132B" />
      <circle cx="36.8" cy="31.6" r="2.4" fill="#16132B" />
      <circle cx="28" cy="30.8" r="0.8" fill="#fff" />
      <circle cx="37.6" cy="30.8" r="0.8" fill="#fff" />
    </svg>
  );
}

/** סימן + שם: ״שורי״ */
export function ShoriLogo({ size = 30, className, sub }: { size?: number; className?: string; sub?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <ShoriMark size={size} />
      <span className="leading-none">
        <span className="font-extrabold text-ink tracking-tight" style={{ fontSize: size * 0.72 }}>
          שורי
        </span>
        {sub && <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">בורסה לכל המשפחה</span>}
      </span>
    </span>
  );
}
