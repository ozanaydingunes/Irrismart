#!/bin/bash
# IrriGrow yerel önizleme (kabul testi). Node.js gerekir: https://nodejs.org
cd "$(dirname "$0")/.." || exit 1
if ! command -v node >/dev/null 2>&1; then echo "Node.js bulunamadı. https://nodejs.org adresinden LTS sürümünü kurun."; read -r; exit 1; fi
(sleep 1; open "http://127.0.0.1:8090/") &
node tools/onizleme.js 8090
