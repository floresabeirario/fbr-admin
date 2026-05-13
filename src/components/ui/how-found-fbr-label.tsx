import {
  HOW_FOUND_FBR_LABELS,
  GOOGLE_LETTER_COLORS,
  type HowFoundFBR,
} from "@/types/database";

// Renderização especial para "Google" — letras nas cores originais do logo.
// Para outras origens, retorna o label simples.
export function HowFoundFbrLabel({ value }: { value: HowFoundFBR }) {
  if (value === "google") {
    const letters = "Google".split("");
    return (
      <span className="font-medium tracking-tight">
        {letters.map((letter, i) => (
          <span key={i} style={{ color: GOOGLE_LETTER_COLORS[i] }}>
            {letter}
          </span>
        ))}
      </span>
    );
  }
  return <>{HOW_FOUND_FBR_LABELS[value]}</>;
}
