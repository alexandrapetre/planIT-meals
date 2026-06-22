#!/usr/bin/env bash
# Export raport RC3 + anexe to PDF (requires: pandoc, basictex/mactex)
set -euo pipefail
cd "$(dirname "$0")"

OUT="${1:-RAPORT_RC3_COMPLET.pdf}"

pandoc --defaults=pandoc-pdf.yaml \
  RAPORT_SEMESTRUL_3.md \
  ANEXA_B_UML.md \
  SCENARII_TEST.md \
  -o "$OUT"

echo "Wrote $OUT"
