"""
Trains the two small ML models that power WSL's real "AI rating" analysis
(src/lib/ml/analyze.ts), replacing the old hash-based fake rating.

Model 1 — code language classifier
  Char n-gram TF-IDF + multinomial Logistic Regression, trained on real
  source files from github/linguist's `samples/` corpus (one class per
  language) plus a "Prose" class (plain English, from Wikipedia) so the
  model can tell real code apart from someone just describing code in
  words. This is what answers "does this submission actually contain
  Python?" instead of trusting a dropdown/label.

Model 2 — skill-topic relevance
  Word-level TF-IDF fit across the combined corpus, with one reference
  vector per conceptual skill (Machine Learning, Data Analysis, ...)
  built from that skill's Wikipedia article. Submission text is compared
  to each reference vector via cosine similarity.

Both models are exported as plain JSON (vocabulary + idf + weights) into
src/lib/ml/, small enough to ship in the browser bundle and re-implement
exactly in TypeScript (see src/lib/ml/analyze.ts) with no server needed.

Run: python scripts/ml/train.py
Requires: numpy, scikit-learn (already installed in this environment).
"""

import json
import re
import time
import urllib.request
import urllib.parse
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = Path(__file__).resolve().parent / "cache"
OUT_DIR = ROOT / "src" / "lib" / "ml"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

CODE_LANGUAGES = ["Python", "JavaScript", "TypeScript", "HTML", "SQL", "Java"]
MAX_FILE_BYTES = 60_000
MAX_FILES_PER_LANGUAGE = 60

# Conceptual (non-code) skills that appear in WSL's challenge data — matched
# to real Wikipedia article titles so we have genuine reference text per skill.
TOPIC_SKILLS = {
    "Machine Learning": "Machine learning",
    "Data Analysis": "Data analysis",
    "Data Visualization": "Data visualization",
    "Operations Research": "Operations research",
    "UI/UX Design": "User experience design",
    "Frontend Development": "Front-end web development",
    "Problem Solving": "Problem solving",
    "Research": "Research",
}

UA = {"User-Agent": "wsl-hackathon-mvp-training-script/1.0"}


def http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_get_text(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as resp:
        raw = resp.read()
    for enc in ("utf-8", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="ignore")


def fetch_code_samples() -> dict:
    cache_file = CACHE_DIR / "code_samples.json"
    if cache_file.exists():
        print(f"[cache] loading code samples from {cache_file}")
        return json.loads(cache_file.read_text(encoding="utf-8"))

    samples: dict[str, list[str]] = {}
    for lang in CODE_LANGUAGES:
        print(f"[fetch] listing samples/{lang} ...")
        encoded = urllib.parse.quote(lang)
        listing = http_get_json(
            f"https://api.github.com/repos/github-linguist/linguist/contents/samples/{encoded}"
        )
        files = [f for f in listing if f.get("type") == "file" and f.get("download_url")]
        files = files[:MAX_FILES_PER_LANGUAGE]
        texts = []
        for f in files:
            if f.get("size", 0) > MAX_FILE_BYTES or f.get("size", 0) < 20:
                continue
            try:
                text = http_get_text(f["download_url"])
            except Exception as e:
                print(f"  ! skip {f['name']}: {e}")
                continue
            if text.strip():
                texts.append(text)
            time.sleep(0.03)
        print(f"  -> {len(texts)} usable files")
        samples[lang] = texts

    cache_file.write_text(json.dumps(samples), encoding="utf-8")
    return samples


def fetch_wiki_extracts() -> dict:
    cache_file = CACHE_DIR / "wiki_extracts.json"
    if cache_file.exists():
        print(f"[cache] loading wiki extracts from {cache_file}")
        return json.loads(cache_file.read_text(encoding="utf-8"))

    extracts = {}
    for skill, title in TOPIC_SKILLS.items():
        print(f"[fetch] wikipedia extract for '{title}' ...")
        encoded = urllib.parse.quote(title)
        data = http_get_json(
            "https://en.wikipedia.org/w/api.php?action=query&prop=extracts"
            f"&explaintext=1&redirects=1&format=json&titles={encoded}"
        )
        pages = data["query"]["pages"]
        page = next(iter(pages.values()))
        extracts[skill] = page.get("extract", "")
        time.sleep(0.1)

    cache_file.write_text(json.dumps(extracts), encoding="utf-8")
    return extracts


def prose_paragraphs(wiki_extracts: dict, min_len=200, max_len=1200, limit=48) -> list[str]:
    paras = []
    for text in wiki_extracts.values():
        for p in text.split("\n"):
            p = p.strip()
            if min_len <= len(p) <= max_len and not p.startswith("=="):
                paras.append(p)
    return paras[:limit]


# ---------------------------------------------------------------------------
# Model 1: code language classifier (char n-grams, entire string, no word-
# boundary logic) — deliberately simple so the exact TF-IDF math is trivial
# to re-implement byte-for-byte in TypeScript at runtime.
# ---------------------------------------------------------------------------

def train_language_model(code_samples: dict, prose_examples: list[str]):
    texts, labels = [], []
    for lang, docs in code_samples.items():
        for d in docs:
            texts.append(d)
            labels.append(lang)
    for p in prose_examples:
        texts.append(p)
        labels.append("Prose")

    print(f"\n=== Model 1: language classifier ===")
    print("class counts:", {l: labels.count(l) for l in sorted(set(labels))})

    x_train, x_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.25, random_state=42, stratify=labels
    )

    vectorizer = TfidfVectorizer(
        analyzer="char", ngram_range=(2, 4), max_features=3000, lowercase=True,
        sublinear_tf=False,
    )
    xt_train = vectorizer.fit_transform(x_train)
    xt_test = vectorizer.transform(x_test)

    clf = LogisticRegression(max_iter=2000, C=4.0)
    clf.fit(xt_train, y_train)

    pred = clf.predict(xt_test)
    acc = accuracy_score(y_test, pred)
    print(f"test accuracy: {acc:.3f}")
    print(classification_report(y_test, pred, zero_division=0))

    # Refit on ALL data for the shipped model (more signal, no held-out need
    # once we've already measured generalization above).
    xt_all = vectorizer.fit_transform(texts)
    clf.fit(xt_all, labels)

    vocab = vectorizer.vocabulary_  # ngram -> index
    idf = vectorizer.idf_
    classes = list(clf.classes_)

    export = {
        "analyzer": "char",
        "ngramRange": [2, 4],
        "vocabulary": {k: int(v) for k, v in vocab.items()},
        "idf": [round(float(v), 6) for v in idf],
        "classes": classes,
        "coef": [[round(float(v), 6) for v in row] for row in clf.coef_],
        "intercept": [round(float(v), 6) for v in clf.intercept_],
        "testAccuracy": round(float(acc), 4),
    }
    return export


# ---------------------------------------------------------------------------
# Model 2: skill-topic relevance (word TF-IDF + cosine similarity to a
# reference vector per conceptual skill).
# ---------------------------------------------------------------------------

def train_topic_model(code_samples: dict, wiki_extracts: dict):
    print(f"\n=== Model 2: topic relevance ===")
    corpus = []
    for docs in code_samples.values():
        corpus.extend(docs)
    corpus.extend(wiki_extracts.values())

    vectorizer = TfidfVectorizer(
        analyzer="word", token_pattern=r"[A-Za-z0-9_]{2,}", lowercase=True,
        stop_words="english", max_features=1600,
    )
    vectorizer.fit(corpus)

    skill_vectors = {}
    for skill, text in wiki_extracts.items():
        vec = vectorizer.transform([text]).toarray()[0]
        skill_vectors[skill] = vec

    # sanity check: each skill should be most similar to itself vs. others
    names = list(skill_vectors.keys())
    mat = np.array([skill_vectors[n] for n in names])
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0] = 1
    unit = mat / norms
    sims = unit @ unit.T
    print("cross-skill similarity (diag should dominate its row):")
    for i, n in enumerate(names):
        row = sims[i]
        top = sorted(zip(names, row), key=lambda t: -t[1])[:3]
        print(f"  {n:22s} -> " + ", ".join(f"{t}:{v:.2f}" for t, v in top))

    vocab = vectorizer.vocabulary_
    idf = vectorizer.idf_
    export = {
        "vocabulary": {k: int(v) for k, v in vocab.items()},
        "idf": [round(float(v), 6) for v in idf],
        "skills": {
            skill: [round(float(v), 6) for v in vec] for skill, vec in skill_vectors.items()
        },
    }
    return export


def main():
    code_samples = fetch_code_samples()
    wiki_extracts = fetch_wiki_extracts()
    prose = prose_paragraphs(wiki_extracts)
    print(f"\nprose training paragraphs: {len(prose)}")

    language_model = train_language_model(code_samples, prose)
    topic_model = train_topic_model(code_samples, wiki_extracts)

    (OUT_DIR / "language-model.json").write_text(
        json.dumps(language_model), encoding="utf-8"
    )
    (OUT_DIR / "topic-model.json").write_text(
        json.dumps(topic_model), encoding="utf-8"
    )
    lm_kb = (OUT_DIR / "language-model.json").stat().st_size / 1024
    tm_kb = (OUT_DIR / "topic-model.json").stat().st_size / 1024
    print(f"\nwrote {OUT_DIR / 'language-model.json'} ({lm_kb:.1f} KB)")
    print(f"wrote {OUT_DIR / 'topic-model.json'} ({tm_kb:.1f} KB)")


if __name__ == "__main__":
    main()
