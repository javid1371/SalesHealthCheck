#!/usr/bin/env bash
# Create a compressed PostgreSQL backup from the production Docker stack.
#
# Usage (from repo root on the VPS):
#   ./scripts/backup-db.sh
#   BACKUP_DIR=/var/backups/sales-health-check ./scripts/backup-db.sh
#
# Environment (from .env in repo root, or exported):
#   POSTGRES_USER, POSTGRES_DB, COMPOSE_FILE, BACKUP_DIR, KEEP_COUNT

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
KEEP_COUNT="${KEEP_COUNT:-7}"

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-sales_health_check}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if ! docker compose -f "$PROJECT_ROOT/$COMPOSE_FILE" exec -T postgres \
  pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
  echo "Error: postgres is not ready. Start the stack first:" >&2
  echo "  docker compose -f $COMPOSE_FILE up -d" >&2
  exit 1
fi

echo "Creating backup: $BACKUP_FILE"

docker compose -f "$PROJECT_ROOT/$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" --no-owner --no-acl "$POSTGRES_DB" \
  | gzip > "$BACKUP_FILE"

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "Error: backup file is empty" >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "Backup complete: $BACKUP_FILE ($SIZE)"

if [[ "$KEEP_COUNT" -gt 0 ]]; then
  ls -t "$BACKUP_DIR"/${POSTGRES_DB}_*.sql.gz 2>/dev/null \
    | tail -n +"$((KEEP_COUNT + 1))" \
    | while read -r old_file; do
      rm -f "$old_file"
      echo "Removed old backup: $old_file"
    done
fi
