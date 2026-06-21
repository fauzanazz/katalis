#!/usr/bin/env bash
# Remove residual green spill on matte edges. Clamps the green channel to
# (red+blue)/2 wherever green exceeds it, then drops any leftover pure-green
# pixels. Canvas size preserved (no trim) so part registration stays intact.
set -euo pipefail
cd "$(dirname "$0")/parts"
for f in *.png; do
  magick "$f" \
    -channel G -fx "(g>(r+b)/2)?(r+b)/2:g" +channel \
    -fuzz 30% -transparent '#00FF00' \
    "$f"
  echo "despilled $f"
done
echo "DONE despill"
