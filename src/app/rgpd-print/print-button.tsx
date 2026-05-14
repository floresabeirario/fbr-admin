"use client";

export function PrintButton() {
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
