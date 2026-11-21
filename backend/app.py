import os
import sqlite3
from pathlib import Path
from flask import Flask, g, send_from_directory, render_template_string, current_app
from flask_cors import CORS
from dotenv import load_dotenv

# Load .env from project root
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / '.env')

def get_db(db_path=None):
    if 'db' not in g:
        if db_path is None:
            db_path = current_app.config['DATABASE_PATH']
        g.db = sqlite3.connect(db_path)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON;")
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db(app):
    db_path = app.config['DATABASE_PATH']
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    schema_file = Path(__file__).resolve().parent / 'schema.sql'
    with open(schema_file, 'r', encoding='utf-8') as f:
        conn.executescript(f.read())

    # Insert default profile if table is empty
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as count FROM profiles")
    if cur.fetchone()[0] == 0:
        cur.execute(
            "INSERT INTO profiles (id, name, role, district) VALUES (1, 'Demo user', 'self', ?)",
            (app.config['DEFAULT_DISTRICT'],)
        )
        conn.commit()
    conn.close()

def create_app(test_config=None):
    app = Flask(__name__)
    base_dir = Path(__file__).resolve().parent

    raw_db_path = os.getenv('DATABASE_PATH', 'instance/triggertrace.db')
    if not os.path.isabs(raw_db_path):
        db_path = str((base_dir / raw_db_path).resolve())
    else:
        db_path = raw_db_path

    raw_cache_dir = os.getenv('CACHE_DIR', '../data/cache')
    if not os.path.isabs(raw_cache_dir):
        cache_dir = str((base_dir / raw_cache_dir).resolve())
    else:
        cache_dir = raw_cache_dir

    app.config.from_mapping(
        SECRET_KEY=os.getenv('SECRET_KEY', 'dev-secret-key-triggertrace'),
        PORT=int(os.getenv('PORT', 8000)),
        DATABASE_PATH=db_path,
        DEFAULT_DISTRICT=os.getenv('DEFAULT_DISTRICT', 'Coimbatore'),
        DEFAULT_LATITUDE=float(os.getenv('DEFAULT_LATITUDE', 11.0168)),
        DEFAULT_LONGITUDE=float(os.getenv('DEFAULT_LONGITUDE', 76.9558)),
        USE_CACHE_ONLY=int(os.getenv('USE_CACHE_ONLY', 0)),
        CACHE_DIR=cache_dir,
        MIN_ATTACKS=int(os.getenv('MIN_ATTACKS', 10)),
        MIN_CHECKIN_DAYS=int(os.getenv('MIN_CHECKIN_DAYS', 30)),
        BOOTSTRAP_RESAMPLES=int(os.getenv('BOOTSTRAP_RESAMPLES', 500)),
        CORS_ORIGINS=[origin.strip() for origin in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:8000').split(',')],
        DATA_LABEL=os.getenv('DATA_LABEL', 'Synthetic demo data')
    )

    if test_config:
        app.config.update(test_config)

    @app.before_request
    def set_app_context():
        g.app = app

    app.teardown_appcontext(close_db)

    # Initialize tables and default seed
    init_db(app)

    # Register API blueprint
    from api import api as api_blueprint
    app.register_blueprint(api_blueprint, url_prefix='/api')

    # Configure CORS
    CORS(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}})

    # Serve built frontend from ../frontend/dist
    frontend_dist = (base_dir / '../frontend/dist').resolve()

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if path.startswith('api'):
            return {"error": "Not found"}, 404
        if frontend_dist.exists():
            target = frontend_dist / path
            if path and target.exists() and not target.is_dir():
                return send_from_directory(str(frontend_dist), path)
            index_file = frontend_dist / 'index.html'
            if index_file.exists():
                return send_from_directory(str(frontend_dist), 'index.html')
        return render_template_string(
            "<!doctype html><html><body><h2>Frontend not built yet.</h2>"
            "<p>Please run <code>npm run build</code> in the <code>frontend/</code> directory.</p></body></html>"
        ), 200

    return app

if __name__ == '__main__':
    app = create_app()
    port = app.config['PORT']
    print(f"TriggerTrace backend listening on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
