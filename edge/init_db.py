"""
One-time (idempotent) table creation for the edge SQLite DB.

Run manually or via install.sh, BEFORE any of the services that touch
this DB start for the first time — pairing_watcher.py's raw sqlite3
INSERT and the SQLAlchemy-based edge services (ingestion_service.py,
rules_engine_example.py) both assume `connected_devices` and
`conditions` already exist; neither creates them itself.

Safe to re-run — create_all() only creates tables that don't already
exist, never touches existing ones. If your real Alembic migrations
already own this schema, run this once against a fresh DB and then let
Alembic take over from there; don't run both create_all() and Alembic
migrations against the same fresh DB, pick one source of truth.
"""

import os

from sqlalchemy import create_engine

from models import Base

DB_URL = os.environ.get("DB_URL", "sqlite:///./greennode.db")

if __name__ == "__main__":
    engine = create_engine(DB_URL)
    Base.metadata.create_all(engine)
    print(f"[ok] Tables created (if not already present) at {DB_URL}")
