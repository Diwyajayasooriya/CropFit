import sqlite3
import os

db_path = 'db.sqlite3'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("\nMigrations in django_migrations:")
    cursor.execute("SELECT app, name, applied FROM django_migrations;")
    migrations = cursor.fetchall()
    for m in migrations:
        print(f" - {m[0]}: {m[1]} (applied at {m[2]})")

    print("\nColumns in auth_user:")
    try:
        cursor.execute("PRAGMA table_info(auth_user);")
        columns = cursor.fetchall()
        for col in columns:
            print(f" - {col[1]} ({col[2]})")
    except Exception as e:
        print(f"Error checking auth_user: {e}")

    print("\nTables in database:")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    for table in tables:
        print(f" - {table[0]}")
    conn.close()
