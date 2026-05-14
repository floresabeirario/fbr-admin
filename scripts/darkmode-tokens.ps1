# Bulk-replace brand hexes with semantic dark-aware tokens.
# Run once from repo root: pwsh scripts/darkmode-tokens.ps1

$ErrorActionPreference = "Stop"

# Ordem importa: padrões compostos (com dark:) primeiro, depois standalone.
$replacements = @(
    # ----- compound (com dark variants) — bg-white com partner dark -----
    @{ from = "bg-white dark:bg-[#141414]"; to = "bg-surface" },
    @{ from = "bg-white dark:bg-[#1C1C1E]"; to = "bg-surface" },
    @{ from = "bg-white dark:bg-[#2C2C2E]"; to = "bg-surface" },
    @{ from = "bg-white dark:bg-[#0D0D0D]"; to = "bg-surface" },
    # cream-50 (FAF8F5) com partner dark
    @{ from = "bg-[#FAF8F5] dark:bg-[#0D0D0D]"; to = "bg-cream-50" },
    @{ from = "bg-[#FAF8F5] dark:bg-[#1C1C1E]"; to = "bg-cream-50" },
    @{ from = "bg-[#FAF8F5] dark:bg-[#141414]"; to = "bg-cream-50" },
    @{ from = "bg-[#FAF8F5] dark:bg-[#2C2C2E]"; to = "bg-cream-50" },
    # border-cream-200 (E8E0D5) com partner dark
    @{ from = "border-[#E8E0D5] dark:border-[#2C2C2E]"; to = "border-cream-200" },
    @{ from = "border-[#E8E0D5] dark:border-[#3C3C3E]"; to = "border-cream-200" },
    # text-cocoa-900 (3D2B1F) com partner dark
    @{ from = "text-[#3D2B1F] dark:text-[#E8D5B5]"; to = "text-cocoa-900" },
    @{ from = "text-[#3D2B1F] dark:text-[#F5F5F5]"; to = "text-cocoa-900" },
    # text-cocoa-700 (8B7355) com partner dark
    @{ from = "text-[#8B7355] dark:text-[#8E8E93]"; to = "text-cocoa-700" },
    # text-cocoa-500 (B8A99A) com partner dark
    @{ from = "text-[#B8A99A] dark:text-[#8E8E93]"; to = "text-cocoa-500" },
    # hover bg
    @{ from = "hover:bg-[#FAF8F5] dark:hover:bg-[#2C2C2E]"; to = "hover:bg-cream-50" },
    @{ from = "hover:bg-[#FAF8F5] dark:hover:bg-[#1C1C1E]"; to = "hover:bg-cream-50" },
    @{ from = "hover:bg-[#F0EAE0] dark:hover:bg-[#2C2C2E]"; to = "hover:bg-cream-100" },
    # hover text
    @{ from = "hover:text-[#3D2B1F] dark:hover:text-[#F5F5F5]"; to = "hover:text-cocoa-900" },
    @{ from = "hover:text-[#3D2B1F] dark:hover:text-[#E8D5B5]"; to = "hover:text-cocoa-900" },
    # hover border
    @{ from = "hover:border-[#D9CDB9] dark:hover:border-[#3C3C3E]"; to = "hover:border-cocoa-500" },
    # ----- standalone — apanha o resto sem dark variant -----
    @{ from = "bg-[#FAF8F5]"; to = "bg-cream-50" },
    @{ from = "bg-[#FDFAF7]"; to = "bg-cream-50" },
    @{ from = "bg-[#F0EAE0]"; to = "bg-cream-100" },
    @{ from = "border-[#E8E0D5]"; to = "border-cream-200" },
    @{ from = "border-[#F0EAE0]"; to = "border-cream-100" },
    @{ from = "text-[#3D2B1F]"; to = "text-cocoa-900" },
    @{ from = "text-[#8B7355]"; to = "text-cocoa-700" },
    @{ from = "text-[#B8A99A]"; to = "text-cocoa-500" },
    @{ from = "hover:bg-[#FAF8F5]"; to = "hover:bg-cream-50" },
    @{ from = "hover:bg-[#F0EAE0]"; to = "hover:bg-cream-100" },
    @{ from = "hover:text-[#3D2B1F]"; to = "hover:text-cocoa-900" },
    @{ from = "hover:border-[#D9CDB9]"; to = "hover:border-cocoa-500" },
    @{ from = "hover:border-[#3D2B1F]"; to = "hover:border-cocoa-900" },
    @{ from = "focus:bg-[#FAF8F5]"; to = "focus:bg-cream-50" },
    # bg-white com /opacity primeiro, depois standalone
    @{ from = "bg-white/95"; to = "bg-surface/95" },
    @{ from = "bg-white/80"; to = "bg-surface/80" },
    @{ from = "bg-white/60"; to = "bg-surface/60" },
    @{ from = "bg-white "; to = "bg-surface " },
    @{ from = "bg-white`""; to = "bg-surface`"" },
    # ----- Botões primários (chocolate brown → swap para cream em dark) -----
    @{ from = "bg-[#3D2B1F] hover:bg-[#2C1F15] text-white"; to = "bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg" },
    @{ from = "bg-[#3D2B1F] text-white hover:bg-[#2C1F15]"; to = "bg-btn-primary text-btn-primary-fg hover:bg-btn-primary-hover" },
    @{ from = "bg-[#3D2B1F] text-white text-xs font-medium hover:bg-[#2C1F15]"; to = "bg-btn-primary text-btn-primary-fg text-xs font-medium hover:bg-btn-primary-hover" },
    @{ from = "bg-[#3D2B1F] text-sm text-white font-medium hover:bg-[#2C1F15]"; to = "bg-btn-primary text-sm text-btn-primary-fg font-medium hover:bg-btn-primary-hover" },
    @{ from = "bg-[#3D2B1F] text-white"; to = "bg-btn-primary text-btn-primary-fg" },
    @{ from = "hover:bg-[#2C1F15]"; to = "hover:bg-btn-primary-hover" },
    @{ from = "hover:bg-[#3D2B1F] hover:text-white hover:border-cocoa-900"; to = "hover:bg-btn-primary hover:text-btn-primary-fg hover:border-btn-primary" },
    @{ from = "hover:bg-[#3D2B1F] hover:text-white"; to = "hover:bg-btn-primary hover:text-btn-primary-fg" },
    # Confirm dialog button já tratado acima ("bg-[#3D2B1F] hover:bg-[#2C1F15]" sem text-white)
    @{ from = "bg-[#3D2B1F] hover:bg-[#2C1F15]"; to = "bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg" },
    # data-state checked do checkbox (preservacao)
    @{ from = "data-[state=checked]:bg-[#3D2B1F] data-[state=checked]:border-[#3D2B1F]"; to = "data-[state=checked]:bg-btn-primary data-[state=checked]:border-btn-primary" },
    # Active filter pill (dark mode override already, simplifica)
    @{ from = 'bg-[#3D2B1F] text-white border-[#3D2B1F] dark:bg-[#E8D5B5] dark:text-[#1A1A1A] dark:border-[#E8D5B5]'; to = "bg-btn-primary text-btn-primary-fg border-btn-primary" },
    # Active filter pill simpler
    @{ from = '"bg-[#3D2B1F] text-white"'; to = '"bg-btn-primary text-btn-primary-fg"' },
    # ----- Dividers -----
    @{ from = "divide-[#F0EAE0] dark:divide-[#2C2C2E]"; to = "divide-cream-100" },
    @{ from = "divide-[#F0EAE0]"; to = "divide-cream-100" },
    @{ from = "divide-[#E8E0D5]"; to = "divide-cream-200" },
    # bg/text small uses of cream-200 hex as separator
    @{ from = "bg-[#E8E0D5]"; to = "bg-cream-200" },
    @{ from = "text-[#E8E0D5]"; to = "text-cream-200" },
    # Gradient backgrounds — adicionar dark variant manualmente seria complexo; swap para um cinza warm-dark equivalente
    @{ from = "bg-gradient-to-br from-[#FAF8F5] to-[#F0E8DC]"; to = "bg-gradient-to-br from-cream-50 to-cream-100" },
    # Checkbox border preserva-se em light, ganha dark variant
    @{ from = "border-[#C4A882]"; to = "border-cocoa-500" },
    # Search palette hovers
    @{ from = "hover:border-cocoa-500 dark:hover:border-[#3C3C3E]"; to = "hover:border-cocoa-500" },
    # Cleanup espaço-delimitado: dark variants redundantes (já que os tokens swapam sozinhos).
    # Usar espaço à volta para evitar partir variantes com opacity (ex: /60).
    @{ from = " dark:bg-[#0D0D0D]"; to = "" },
    @{ from = " dark:bg-[#1A1A1A]"; to = "" },
    @{ from = " dark:bg-[#1C1C1E]"; to = "" },
    @{ from = " dark:bg-[#2C2C2E]"; to = "" },
    @{ from = " dark:bg-[#141414]"; to = "" },
    @{ from = " dark:border-[#2C2C2E]"; to = "" },
    @{ from = " dark:border-[#3C3C3E]"; to = "" },
    @{ from = " dark:text-[#8E8E93]"; to = "" },
    @{ from = " dark:text-[#F5F5F5]"; to = "" },
    @{ from = " dark:hover:bg-[#2C2C2E]"; to = "" },
    @{ from = " dark:hover:bg-[#1C1C1E]"; to = "" },
    @{ from = " dark:hover:text-[#F5F5F5]"; to = "" },
    @{ from = " dark:hover:text-[#E8D5B5]"; to = "" },
    # mais hexes residuais detectados na 2.ª passagem
    @{ from = " dark:bg-[#1F1F1F]"; to = "" },
    @{ from = " dark:border-[#1F1F1F]"; to = "" },
    @{ from = " dark:hover:bg-[#1F1F1F]"; to = "" },
    @{ from = " dark:hover:bg-[#1A1A1A]"; to = "" },
    @{ from = " dark:hover:border-[#2C2C2E]"; to = "" },
    @{ from = " dark:ring-offset-[#141414]"; to = "" },
    # cream extras detectados na revisão visual
    @{ from = "bg-[#F7F4F0]"; to = "bg-cream-50" },
    @{ from = "bg-[#F4EFE8]"; to = "bg-cream-100" },
    @{ from = "hover:bg-[#F4EFE8]"; to = "hover:bg-cream-100" },
    @{ from = "border-[#E0D5C2]"; to = "border-cream-200" }
)

$files = Get-ChildItem -Path "src" -Recurse -Include *.tsx,*.ts | Where-Object {
    $_.FullName -notmatch "node_modules" -and $_.FullName -notmatch "\.next"
}

$totalChanges = 0
$filesChanged = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $original = $content
    foreach ($r in $replacements) {
        $content = $content.Replace($r.from, $r.to)
    }
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content)
        $filesChanged++
    }
}

Write-Output "Ficheiros alterados: $filesChanged"
