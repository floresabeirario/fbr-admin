// Bandeiras em SVG inline — substituem os emojis 🇵🇹/🇬🇧 que em Windows
// frequentemente caem para texto "PT"/"GB" por falta de suporte da fonte.

type Lang = "pt" | "en";

const PT_SVG = (
  <svg viewBox="0 0 6 4" className="block h-full w-full" preserveAspectRatio="none" aria-hidden>
    <rect width="6" height="4" fill="#FF0000" />
    <rect width="2.4" height="4" fill="#006600" />
    <circle cx="2.4" cy="2" r="0.55" fill="#FFE600" stroke="#fff" strokeWidth="0.06" />
  </svg>
);

const GB_SVG = (
  <svg viewBox="0 0 60 30" className="block h-full w-full" preserveAspectRatio="none" aria-hidden>
    <clipPath id="gb-clip"><path d="M0,0 v30 h60 v-30 z" /></clipPath>
    <clipPath id="gb-clip-diag">
      <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
    </clipPath>
    <g clipPath="url(#gb-clip)">
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" clipPath="url(#gb-clip-diag)" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </g>
  </svg>
);

const FLAG_BY_LANG: Record<Lang, React.ReactNode> = {
  pt: PT_SVG,
  en: GB_SVG,
};

export function Flag({
  lang,
  className,
  title,
}: {
  lang: Lang;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`inline-block overflow-hidden rounded-[2px] border border-black/10 align-middle ${className ?? "h-3.5 w-5"}`}
      title={title}
    >
      {FLAG_BY_LANG[lang]}
    </span>
  );
}

export function FlagPair({ className }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      <Flag lang="pt" className={className ?? "h-3.5 w-5"} />
      <Flag lang="en" className={className ?? "h-3.5 w-5"} />
    </span>
  );
}
