"""
Test script: runs the 5 acceptance test queries from the problem statement
against the hybrid retriever and prints retrieved chunks with citations.
"""
import sys
import io

# Fix Windows encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app.core.retriever import retrieve

QUERIES = [
    "What are the major business segments discussed in the document?",
    "What is the consolidated total income in H1-26?",
    "What drivers are mentioned for EBITDA changes in H1-26?",
    "What is the CEO's email address?",
    "Summarize airport performance in H1-26.",
    "what are the consolidated debt details by AEL?"
]


def run_test():
    print("=" * 80)
    print("  RAG RETRIEVAL TEST - Hybrid BM25 + Vector Search")
    print("=" * 80)

    for query in QUERIES:
        print(f"\n{'-' * 80}")
        print(f"  QUERY: {query}")
        print(f"{'-' * 80}")

        results = retrieve(query, top_k=3)

        if not results:
            print("  [X] No results found!")
            continue

        for r in results:
            print(f"\n  [Rank {r['rank']}] Citation: {r['citation']} | RRF Score: {r['rrf_score']}")
            print(f"     Type:    {r['metadata'].get('type', 'unknown')}")
            print(f"     Source:  {r['metadata'].get('source', 'unknown')}")
            print(f"     Page:   {r['metadata'].get('page', '?')}")
            print(f"     Section: {r['metadata'].get('section', '?')}")
            print(f"     -- Content Preview --")

            # Show first 400 chars of content
            preview = r["content"][:400].replace("\n", "\n     ")
            print(f"     {preview}")
            print()


if __name__ == "__main__":
    run_test()
