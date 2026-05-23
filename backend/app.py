import os
import sqlite3
import io
import json
import math
from collections import Counter
from pathlib import Path

from flask import Flask, request, jsonify, send_file, send_from_directory, Response
from flask_cors import CORS

from parser import parse_markdown
from exporter import export_to_markdown

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / 'keywords.db'
MD_PATH = BASE_DIR / 'Keywords-Complete.md'

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# ── helpers ──────────────────────────────────────────────────────────

def tokenize(text: str) -> list[str]:
    """Découpe un texte en mots et en caractères (n-grammes)."""
    words = text.lower().split()
    chars = list(text.lower().replace(' ', ''))
    return words + chars


def ngrams(text: str, n: int = 3) -> list[str]:
    """Génère les n-grammes de caractères d'un texte."""
    t = text.lower().replace(' ', '_')
    return [t[i:i+n] for i in range(len(t) - n + 1)]


def compute_ngram_vector(text: str) -> dict[str, float]:
    """Retourne un dictionnaire {ngram: tfidf_weight} pour un texte."""
    grams = ngrams(text)
    if not grams:
        return {}
    total = len(grams)
    counts = Counter(grams)
    # TF normalisé par la longueur
    return {g: c / total for g, c in counts.items()}


def cosine_similarity(vec_a: dict, vec_b: dict) -> float:
    """Cosine similarity entre deux dictionnaires sparse."""
    all_keys = set(vec_a) | set(vec_b)
    dot = sum(vec_a.get(k, 0) * vec_b.get(k, 0) for k in all_keys)
    norm_a = math.sqrt(sum(v * v for v in vec_a.values()))
    norm_b = math.sqrt(sum(v * v for v in vec_b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def get_db():
    _init_db()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _init_db():
    """Crée la base et les tables si elles n'existent pas."""
    if not DB_PATH.exists():
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("""
            CREATE TABLE IF NOT EXISTS keywords (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword TEXT NOT NULL,
                description TEXT NOT NULL,
                section_id TEXT,
                section_title TEXT,
                subsection_id TEXT,
                subsection_title TEXT,
                nsfw INTEGER DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS keyword_embeddings (
                keyword_id INTEGER PRIMARY KEY,
                embedding TEXT NOT NULL,
                FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
            )
        """)
        conn.commit()
        conn.close()


def _generate_all_embeddings(conn):
    """Génère les vecteurs n-grammes pour tous les mots-clés et les stocke (JSON)."""
    cur = conn.cursor()
    cur.execute("SELECT id, keyword, description FROM keywords")
    rows = cur.fetchall()
    if not rows:
        return

    cur.execute("DELETE FROM keyword_embeddings")

    data = []
    for row in rows:
        text = f"{row['keyword']}: {row['description']}"
        vec = compute_ngram_vector(text)
        data.append((row['id'], json.dumps(vec)))

    cur.executemany(
        "INSERT INTO keyword_embeddings (keyword_id, embedding) VALUES (?, ?)",
        data
    )
    conn.commit()


# ── API ───────────────────────────────────────────────────────────────

@app.route('/api/search/semantic', methods=['GET'])
def semantic_search():
    """
    Recherche sémantique par n-grammes.
    Query params:
      q     -> requête en langage naturel
      limit -> nombre de résultats max (défaut: 50)
    """
    q = request.args.get('q', '').strip()
    limit = int(request.args.get('limit', 50))

    if not q:
        return jsonify([])

    query_vec = compute_ngram_vector(q)

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT k.id, k.keyword, k.description, k.section_id, k.section_title,
               k.subsection_id, k.subsection_title, k.nsfw, ke.embedding
        FROM keywords k
        JOIN keyword_embeddings ke ON ke.keyword_id = k.id
    """)
    rows = cur.fetchall()
    conn.close()

    if not rows:
        return jsonify({'error': 'Aucune donnée vectorisée. Importez d\'abord les données.'}), 400

    results = []
    for row in rows:
        vec = json.loads(row['embedding'])
        similarity = cosine_similarity(query_vec, vec)
        results.append({
            'id': row['id'],
            'keyword': row['keyword'],
            'description': row['description'],
            'section_id': row['section_id'],
            'section_title': row['section_title'],
            'subsection_id': row['subsection_id'],
            'subsection_title': row['subsection_title'],
            'nsfw': row['nsfw'],
            'score': round(similarity, 4)
        })

    results.sort(key=lambda x: x['score'], reverse=True)
    return jsonify(results[:limit])


@app.route('/api/embeddings/build', methods=['POST'])
def build_embeddings():
    """Regénère tous les vecteurs n-grammes depuis les mots-clés existants."""
    try:
        conn = get_db()
        _generate_all_embeddings(conn)
        conn.close()
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/keywords', methods=['GET'])
def list_keywords():
    """
    Query params:
      q        -> recherche texte sur keyword + description
      section  -> filtre section_id exact
      nsfw     -> 0|1 filtre NSFW (si absente, tous)
    """
    conn = get_db()
    cur = conn.cursor()

    q = request.args.get('q', '').strip().lower()
    section = request.args.get('section', '').strip()
    nsfw_raw = request.args.get('nsfw', '').strip()

    conditions = ["1=1"]
    params = []

    if q:
        conditions.append("(LOWER(keyword) LIKE ? OR LOWER(description) LIKE ?)")
        like = f"%{q}%"
        params.extend([like, like])

    if section:
        conditions.append("section_id = ?")
        params.append(section)

    if nsfw_raw in ('0', '1'):
        conditions.append("nsfw = ?")
        params.append(int(nsfw_raw))

    sql = f"""
        SELECT id, keyword, description, section_id, section_title,
               subsection_id, subsection_title, nsfw
        FROM keywords
        WHERE {' AND '.join(conditions)}
        ORDER BY section_id, subsection_id, keyword
    """
    cur.execute(sql, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route('/api/sections', methods=['GET'])
def list_sections():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT section_id, section_title,
               COUNT(*) as total,
               SUM(nsfw) as nsfw_count
        FROM keywords
        GROUP BY section_id
        ORDER BY section_id
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route('/api/stats', methods=['GET'])
def stats():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT COUNT(*) as total,
               SUM(nsfw) as nsfw_total,
               COUNT(DISTINCT section_id) as section_count,
               COUNT(DISTINCT subsection_id) as subsection_count
        FROM keywords
    """)
    row = dict(cur.fetchone())
    conn.close()
    return jsonify(row)


@app.route('/api/import', methods=['POST'])
def import_md():
    """Reçoit un fichier .md ou lit le fichier local, parse, vide et remplit la BDD."""
    if 'file' in request.files:
        f = request.files['file']
        tmp = BASE_DIR / '__tmp_import.md'
        f.save(tmp)
        filepath = tmp
        delete_after = True
    else:
        filepath = MD_PATH
        delete_after = False

    if not filepath.exists():
        return jsonify({'error': 'Fichier markdown non trouvé'}), 400

    try:
        entries = parse_markdown(str(filepath))

        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM keywords")
        cur.execute("DELETE FROM sqlite_sequence WHERE name='keywords'")
        cur.executemany("""
            INSERT INTO keywords
            (keyword, description, section_id, section_title, subsection_id, subsection_title, nsfw)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            (e['keyword'], e['description'], e['section_id'], e['section_title'],
             e['subsection_id'], e['subsection_title'], int(e['nsfw']))
            for e in entries
        ])
        conn.commit()

        _generate_all_embeddings(conn)
        conn.close()

        return jsonify({'imported': len(entries)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if delete_after and tmp.exists():
            tmp.unlink()


@app.route('/api/export', methods=['GET'])
def export_md():
    """Génère le markdown depuis la BDD et le renvoie en téléchargement."""
    if not DB_PATH.exists():
        return jsonify({'error': 'Base de données vide'}), 400

    content = export_to_markdown(str(DB_PATH))
    buf = io.BytesIO(content.encode('utf-8'))
    buf.seek(0)
    return send_file(
        buf,
        mimetype='text/markdown',
        as_attachment=True,
        download_name='Keywords-Export.md'
    )


# ── Fichiers statiques ────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory(str(BASE_DIR / 'frontend'), 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(str(BASE_DIR / 'frontend'), path)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
