import sys
import io
import os
from dotenv import load_dotenv

# Force UTF-8 for Windows terminal
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Load environment variables
load_dotenv()

from app.core.retriever import retrieve
from app.core.llm import generate_answer

def main():
    print("=" * 60)
    print("  🚀 MULTIMODAL PDF RAG - INTERACTIVE CHAT")
    print("  (Type 'exit' to quit)")
    print("=" * 60)

    while True:
        try:
            print("\n" + "-" * 40)
            query = input("🤔 Ask a question: ").strip()

            if not query or query.lower() in ("exit", "quit", "q"):
                print("Goodbye! 👋")
                break

            print("\n🔍 Searching database...")
            chunks = retrieve(query, top_k=5)
            
            if not chunks:
                print("❌ No relevant information found in the PDF.")
                continue

            print(f"✅ Found {len(chunks)} potential sources. Generating answer...\n")

            # 2. Generate answer
            answer = generate_answer(query, chunks)

            # 3. Print result
            print("🤖 ANSWER:")
            print("=" * 30)
            print(answer)
            print("=" * 30)

            # --- UI FIX: Only show sources if the answer isn't a refusal ---
            refusal_phrase = "information is not available"
            if refusal_phrase.lower() not in answer.lower():
                show_sources = input("\n📄 View sources? (y/n): ").strip().lower()
                if show_sources == 'y':
                    for r in chunks:
                        print(f"\n[{r['citation']}] (RRF Score: {r['rrf_score']})")
                        print(f"Content: {r['content'][:200]}...")
            else:
                print("\n(Sources skipped because info was not found in document)")

        except KeyboardInterrupt:
            print("\nGoodbye! 👋")
            break
        except Exception as e:
            print(f"\n❌ An error occurred: {e}")

if __name__ == "__main__":
    main()
