"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

export function PrintButton() {
  const params = useSearchParams();
  const autoPrint = params.get("autoprint") === "1";
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (autoPrint && !triggeredRef.current) {
      triggeredRef.current = true;
      // Pequeno delay para garantir que o DOM já está pronto + fontes carregadas
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        padding: "8px 16px",
        border: "1px solid #3D2B1F",
        background: "#3D2B1F",
        color: "white",
        borderRadius: 6,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      Imprimir / Guardar como PDF
    </button>
  );
}
