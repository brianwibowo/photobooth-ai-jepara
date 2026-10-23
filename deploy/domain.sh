#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v python3 >/dev/null; then
  echo 'Python 3 belum tersedia. Jalankan: sudo apt install python3'
  exit 1
fi
exec python3 deploy/setup-domain.py
