#!/usr/bin/env bash
# Install module-catalog as a global command: symlink bin/module-catalog into
# ~/.local/bin (already on PATH, independent of the nvm Node version).
# Re-run any time; it just refreshes the link. Uninstall: ./install.sh --uninstall
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${HOME}/.local/bin"
LINK="${BIN_DIR}/module-catalog"

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "${LINK}"
  echo "✓ Đã gỡ ${LINK}"
  exit 0
fi

mkdir -p "${BIN_DIR}"
chmod +x "${DIR}/bin/module-catalog"
ln -sf "${DIR}/bin/module-catalog" "${LINK}"
echo "✓ Đã cài: ${LINK} → ${DIR}/bin/module-catalog"

case ":${PATH}:" in
  *":${BIN_DIR}:"*) echo "  Chạy thử: module-catalog --help" ;;
  *) echo "  ⚠ ${BIN_DIR} chưa có trong PATH — thêm vào ~/.zshrc: export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
esac
