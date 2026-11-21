#!/usr/bin/env bash
# Kullanım: PGHOST=... PGUSER=... bash db/test/calistir.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
psql -q -c "DROP DATABASE IF EXISTS servis_test" -c "CREATE DATABASE servis_test"
for f in db/00*.sql; do psql -d servis_test -v ON_ERROR_STOP=1 -q -f "$f"; done
for t in db/test/senaryo_testi.sql db/test/teklif_testi.sql; do
  psql -d servis_test -v ON_ERROR_STOP=1 -q -t -f "$t" 2>&1 | sed -n 's/.*NOTICE:  //p; /BAŞARI/p; /ERROR/p'
done
