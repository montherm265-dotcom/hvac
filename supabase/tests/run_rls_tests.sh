#!/usr/bin/env bash
# Applies every migration to a scratch local Postgres database exactly the
# way Supabase would (same auth.uid()/anon/authenticated role model), then
# runs supabase/tests/rls_test.sql, which checks real ALLOWED and DENIED
# paths (not just "does the SQL run") against the actual RLS policies in
# 0009_policies.sql. This is what "Real, security-tested backend" means for
# this project — see README "Testing the backend locally".
#
# Requires a local `postgres` superuser (e.g. `sudo service postgresql
# start` on Debian/Ubuntu with the postgresql package installed). Never
# points at a real Supabase project.
set -euo pipefail

DB_NAME="human_rls_test"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"
PSQL_SUPERUSER="${PSQL_SUPERUSER:-postgres}"

run_psql() {
  su "$PSQL_SUPERUSER" -c "psql -v ON_ERROR_STOP=1 $*"
}

echo "== (re)creating $DB_NAME =="
run_psql -c "\"DROP DATABASE IF EXISTS $DB_NAME;\"" >/dev/null
run_psql -c "\"CREATE DATABASE $DB_NAME;\"" >/dev/null

echo "== applying shim + migrations in order =="
for f in "$SCRIPT_DIR/00_supabase_shim.sql" "$MIGRATIONS_DIR"/*.sql; do
  echo "  -> $(basename "$f")"
  su "$PSQL_SUPERUSER" -c "psql -d $DB_NAME -v ON_ERROR_STOP=1 -f $f" >/tmp/rls_test_migration.log 2>&1 || {
    echo "FAILED applying $f"; tail -40 /tmp/rls_test_migration.log; exit 1;
  }
done

echo "== granting Supabase-equivalent role privileges =="
su "$PSQL_SUPERUSER" -c "psql -d $DB_NAME" >/dev/null <<'SQL'
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;
SQL

echo "== running RLS allow/deny tests =="
su "$PSQL_SUPERUSER" -c "psql -d $DB_NAME -v ON_ERROR_STOP=1 -f $SCRIPT_DIR/rls_test.sql"
