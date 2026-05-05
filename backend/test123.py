from app.core.retriever import retrieve

query = "What is EBITDA?"

results = retrieve(query)

for r in results:
    print("\n====================")
    print("Page:", r["metadata"]["page"])
    print("Type:", r["metadata"]["type"])
    print("Score:", r["adjusted_score"])
    print(r["content"][:300])