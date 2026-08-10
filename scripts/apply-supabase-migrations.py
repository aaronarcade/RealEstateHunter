#!/usr/bin/env python3
"""Apply RealEstateHunter Supabase SQL migrations from supabase/migrations/."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote_plus, urlparse

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = ROOT / 'supabase' / 'migrations'
PROJECT_REF = 'quvfkegqgbrvtmufndpn'
POOLER_PREFIXES = ['aws-1', 'aws-0']
POOLER_REGIONS = [
    'us-west-2',
    'us-east-1',
    'us-west-1',
    'eu-west-1',
    'eu-central-1',
    'ap-southeast-1',
    'ap-northeast-1',
    'ca-central-1',
]


def load_env() -> None:
    env_path = ROOT / '.env'
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def get_password() -> str:
    password = os.environ.get('SUPABASE_DB_PASSWORD') or os.environ.get('DB_PASSWORD')
    if password:
        return password

    database_url = os.environ.get('DATABASE_URL', '')
    if database_url and '[YOUR-PASSWORD]' not in database_url:
        parsed = urlparse(database_url)
        if parsed.password:
            return parsed.password
    return ''


def build_connection_urls(password: str) -> list[str]:
    urls: list[str] = []

    database_url = os.environ.get('DATABASE_URL', '')
    if database_url and '[YOUR-PASSWORD]' not in database_url:
        urls.append(database_url)

    region = os.environ.get('SUPABASE_DB_POOLER_REGION')
    prefixes = [os.environ['SUPABASE_DB_POOLER_PREFIX']] if os.environ.get('SUPABASE_DB_POOLER_PREFIX') else POOLER_PREFIXES
    regions = [region] if region else POOLER_REGIONS
    for prefix in prefixes:
        for pooler_region in regions:
            host = f'{prefix}-{pooler_region}.pooler.supabase.com'
            user = f'postgres.{PROJECT_REF}'
            urls.append(f'postgresql://{user}:{quote_plus(password)}@{host}:5432/postgres')

    if not urls:
        host = os.environ.get('SUPABASE_DB_HOST', f'db.{PROJECT_REF}.supabase.co')
        user = os.environ.get('SUPABASE_DB_USER', 'postgres')
        urls.append(f'postgresql://{user}:{quote_plus(password)}@{host}:5432/postgres')

    seen: set[str] = set()
    unique_urls: list[str] = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)
    return unique_urls


def connect(password: str):
    import psycopg2

    last_error = None
    for url in build_connection_urls(password):
        host = urlparse(url).hostname or 'unknown'
        print(f'Trying {host}...')
        try:
            conn = psycopg2.connect(url, connect_timeout=10)
            print(f'Connected via {host}')
            return conn
        except Exception as exc:
            last_error = exc
            print(f'  Failed: {exc}')

    raise last_error or RuntimeError('Could not connect to Supabase Postgres')


def main() -> int:
    load_env()
    password = get_password()
    if not password:
        print(
            'Set DATABASE_URL in .env with your database password,\n'
            'or set SUPABASE_DB_PASSWORD.\n'
            'Find the password in Supabase Dashboard → Project Settings → Database.'
        )
        return 1

    try:
        import psycopg2  # noqa: F401
    except ImportError:
        print('Install psycopg2: pip install psycopg2-binary')
        return 1

    migration_files = sorted(MIGRATIONS_DIR.glob('*.sql'))
    if not migration_files:
        print(f'No migration files found in {MIGRATIONS_DIR}')
        return 1

    print('Connecting to Supabase Postgres...')
    try:
        conn = connect(password)
    except Exception as exc:
        print(f'Could not connect: {exc}')
        return 1

    conn.autocommit = True

    try:
        with conn.cursor() as cur:
            for path in migration_files:
                sql = path.read_text()
                print(f'Applying {path.name}...')
                cur.execute(sql)
                print('  OK')
    except Exception as exc:
        print(f'Migration failed: {exc}')
        return 1
    finally:
        conn.close()

    print('All migrations applied successfully.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
