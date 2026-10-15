#!/bin/bash
# ============================================================
#   Restart KonveksiApps Server (macOS)
# ============================================================

cd "$(dirname "$0")"

./stop-server.sh
sleep 1
./start-server.sh
