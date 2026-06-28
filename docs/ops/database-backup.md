# Database backup and restore

Production PostgreSQL runs in the `postgres` Docker service. Use [scripts/backup-db.sh](../../scripts/backup-db.sh) on the VPS to create compressed dumps and rotate old files.

## Manual backup

From the repo root on the server:

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

Defaults:

| Setting | Default |
|---------|---------|
| Output directory | `./backups/` (gitignored) |
| Filename pattern | `sales_health_check_YYYYMMDD_HHMMSS.sql.gz` |
| Retention | Keep the **7** most recent backups |

Override with environment variables:

```bash
BACKUP_DIR=/var/backups/sales-health-check KEEP_COUNT=14 ./scripts/backup-db.sh
```

The script reads `POSTGRES_USER` and `POSTGRES_DB` from `.env` if present.

## Cron (daily on VPS)

Run as the deploy user from the project directory. Example: daily at 02:00, logs to `/var/log/sales-health-check-backup.log`.

```bash
crontab -e
```

Add:

```cron
0 2 * * * cd /path/to/sales-health-check && BACKUP_DIR=/var/backups/sales-health-check ./scripts/backup-db.sh >> /var/log/sales-health-check-backup.log 2>&1
```

Create the backup directory once:

```bash
sudo mkdir -p /var/backups/sales-health-check
sudo chown "$USER:$USER" /var/backups/sales-health-check
```

Verify after the first scheduled run:

```bash
ls -lh /var/backups/sales-health-check/
tail /var/log/sales-health-check-backup.log
```

## Restore

**Warning:** restoring over the live database replaces all data. Take a fresh backup first.

### Option A — restore into the running stack (same database)

1. Stop the app so nothing writes during restore:

```bash
docker compose -f docker-compose.prod.yml stop app
```

2. Restore from a backup file:

```bash
gunzip -c /var/backups/sales-health-check/sales_health_check_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres \
      psql -U postgres -d sales_health_check
```

3. Start the app:

```bash
docker compose -f docker-compose.prod.yml start app
```

### Option B — restore test on a temporary database (recommended before first real users)

Validate backup integrity without touching production data:

```bash
# Create empty test database
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -c "DROP DATABASE IF EXISTS sales_health_check_restore_test;"
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -c "CREATE DATABASE sales_health_check_restore_test;"

# Restore dump into test DB
gunzip -c /var/backups/sales-health-check/sales_health_check_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres \
      psql -U postgres -d sales_health_check_restore_test

# Spot-check row counts (example)
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -d sales_health_check_restore_test \
  -c "SELECT COUNT(*) FROM \"AssessmentSession\";"

# Drop test database when done
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres -c "DROP DATABASE sales_health_check_restore_test;"
```

## Before first real users

1. Run `./scripts/backup-db.sh` and confirm a non-empty `.sql.gz` file.
2. Run **Option B** restore test once on the VPS.
3. Enable the daily cron job.

## Related

- [production-deploy.md](./production-deploy.md) — deploy and `EXPERT_VIEW_TOKEN`
- [README.md](../../README.md) — quick deploy overview
