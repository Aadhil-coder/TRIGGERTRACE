import os
import sys
import tempfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / 'backend'
DATA_DIR = ROOT_DIR / 'data'

for p in (str(BACKEND_DIR), str(DATA_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

# In Vercel serverless / AWS Lambda environment, use /tmp for SQLite and cache
if os.environ.get('VERCEL') or os.environ.get('AWS_LAMBDA_FUNCTION_NAME') or os.environ.get('LAMBDA_TASK_ROOT'):
    tmp_base = Path('/tmp') if os.path.exists('/tmp') or not sys.platform.startswith('win') else Path(tempfile.gettempdir())
    tmp_base.mkdir(parents=True, exist_ok=True)
    tmp_db = tmp_base / 'triggertrace.db'
    
    os.environ['DATABASE_PATH'] = str(tmp_db)
    os.environ['CACHE_DIR'] = str(tmp_base / 'cache')

from app import create_app

app = create_app()

# Auto-seed synthetic data on cold start if database is newly created
try:
    import sqlite3
    db_path = app.config['DATABASE_PATH']
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM attacks")
    if cur.fetchone()[0] == 0:
        import demo
        demo.load(reset=False)
    conn.close()
except Exception as e:
    print(f"Demo auto-seed note: {e}")
