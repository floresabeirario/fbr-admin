// ============================================================
// Helpers para mostrar imagens guardadas no Google Drive.
// ============================================================
//
// O URL "partilhar > qualquer pessoa com o link" do Drive é uma
// página HTML (https://drive.google.com/file/d/<ID>/view?usp=sharing),
// não a imagem em si. Pôr esse URL num <img> não funciona.
// O endpoint que serve o ficheiro como imagem é
//   https://lh3.googleusercontent.com/d/<ID>
// (a antiga `https://drive.google.com/uc?export=view&id=<ID>` foi
// limitada e devolve frequentemente 403/redirect.)

const DRIVE_FILE_ID_REGEX =
  /(?:\/file\/d\/|[?&]id=|\/d\/|\/uc\?(?:[^=]+=[^&]*&)*?id=)([A-Za-z0-9_-]{20,})/;

export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const match = url.match(DRIVE_FILE_ID_REGEX);
  return match ? match[1] : null;
}

/**
 * Devolve um URL embeddable em <img>. Se o URL não for do Drive,
 * devolve o original (assume-se que já é uma imagem directa).
 */
export function toEmbeddableImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/(?:drive|docs)\.google\.com/.test(trimmed)) {
    const id = extractDriveFileId(trimmed);
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  }
  return trimmed;
}
