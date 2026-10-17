-- Above Postgres's default of 100 for headroom in dev (the data import's
-- bursts of API requests, `manage.py test --parallel`, the live feed's
-- LISTEN connections), without the memory a far larger limit reserves.
-- Runs only when the database volume is first created.
ALTER SYSTEM SET max_connections = 200;
