"""
Interactive search: type any question and see retrieved chunks from the PDF.
Run: ..\venv\Scripts\python search.py
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app.core.retriever import retrieve

print("=" * 60)
print("  PDF Search - Hybrid BM25 + Vector Retrieval")
print("  Type a question and press Enter. Type 'quit' to exit.")
print("=" * 60)

while True:
    print()
    query = input(">> Your question: ").strip()

    if not query or query.lower() in ("quit", "exit", "q"):
        print("Bye!")
        break

    results = retrieve(query, top_k=3)

    if not results:
        print("  No results found.")
        continue

    for r in results:
        print(f"\n  [Rank {r['rank']}] Citation: {r['citation']} | Score: {r['rrf_score']}")
        print(f"     Page: {r['metadata'].get('page', '?')} | Type: {r['metadata'].get('type', '?')}")
        print(f"     ---")
        preview = r["content"][:400].replace("\n", "\n     ")
        print(f"     {preview}")
