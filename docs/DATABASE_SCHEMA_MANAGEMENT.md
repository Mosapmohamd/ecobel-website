# Database schema management

The storefront API shares its PostgreSQL database (Supabase) with
ecobel-accounting-system. **Supabase is the only authority for the schema**:
changes are explicit, reviewed SQL applied in Supabase — never by
application code. The full process (where SQL changes live, review, how to
apply and verify, row-level security for new tables, the legacy
`alembic_version` table) is in ecobel-accounting-system's
`docs/DATABASE_SCHEMA_MANAGEMENT.md`.

For this repository:

- **Startup never changes the schema.** `check_schema_matches_models`
  (`backend/app/database.py`) only logs a warning when the database lacks a
  table or column the models use.
- **Shared models** in `backend/app/models.py` must stay identical to their
  copies in ecobel-accounting-system. When a schema change touches a table
  mapped here, update the model in the same review as the SQL.
- **Tests** build a throwaway SQLite database from the models
  (`models.Base.metadata.create_all` in each test module) — test-only.
