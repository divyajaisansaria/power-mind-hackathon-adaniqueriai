"""
Hybrid Retriever: BM25 (keyword) + ChromaDB (vector) with Reciprocal Rank Fusion.

This replaces LangChain's EnsembleRetriever with a manual implementation
for compatibility with LangChain v1.2+.
"""
import json
from collections import defaultdict
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document
from app.core.vector_store import VectorStore


def load_bm25_documents():
    """Load all ingested documents from JSON for BM25 keyword search"""
    try:
        with open("data/processed/all_documents.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        return [
            Document(page_content=item["content"], metadata=item["metadata"])
            for item in data
        ]
    except FileNotFoundError:
        print("[WARN] BM25 document file not found. Run ingestion first.")
        return []


def reciprocal_rank_fusion(result_lists, k=60):
    """
    Fuse multiple ranked result lists using Reciprocal Rank Fusion (RRF).
    Score = sum(1 / (k + rank)) across all lists.
    Higher score = more relevant.
    """
    scores = defaultdict(float)
    doc_map = {}

    for results in result_lists:
        for rank, doc in enumerate(results):
            # Use first 200 chars of content as key for deduplication
            doc_key = doc.page_content[:200]
            scores[doc_key] += 1.0 / (k + rank + 1)
            doc_map[doc_key] = doc

    # Sort by fused score (descending)
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    return [(doc_map[key], score) for key, score in ranked]


def retrieve(query, top_k=5, collection_id=None):
    """
    Retrieve relevant documents using hybrid search:
    1. ChromaDB vector search (semantic similarity)
    2. BM25 keyword search (exact term matching)
    3. Reciprocal Rank Fusion to combine both

    Returns a list of dicts with content, metadata, rank, and citation.
    """
    vector_store = VectorStore()

    # === Vector Search with Optional Filter ===
    # ChromaDB 'where' filter for collection_id
    filter_dict = {"collection_id": collection_id} if collection_id else None
    
    vector_results = vector_store.db.similarity_search_with_score(
        query, 
        k=top_k * 2,
        filter=filter_dict
    )
    vector_docs = [doc for doc, score in vector_results]

    # === BM25 Search with Optional Filter ===
    all_docs = load_bm25_documents()
    
    # Filter BM25 docs by collection_id before retrieving
    if collection_id and all_docs:
        all_docs = [
            doc for doc in all_docs 
            if doc.metadata.get("collection_id") == collection_id
        ]
        
    bm25_docs = []
    if all_docs:
        bm25_retriever = BM25Retriever.from_documents(all_docs, k=top_k * 2)
        bm25_docs = bm25_retriever.invoke(query)

    # === Reciprocal Rank Fusion ===
    fused = reciprocal_rank_fusion([vector_docs, bm25_docs])

    # Format results
    formatted = []
    for doc, rrf_score in fused[:top_k]:
        page = doc.metadata.get("page", "?")
        chunk_id = str(doc.metadata.get("chunk_id", "?"))
        short_id = chunk_id[:8] if len(chunk_id) > 8 else chunk_id

        formatted.append({
            "content": doc.page_content,
            "metadata": doc.metadata,
            "rank": len(formatted) + 1,
            "rrf_score": round(rrf_score, 4),
            "citation": f"[p{page}:{short_id}]"
        })

    return formatted


def get_page_content(page_num: int, collection_id: str = None) -> str:
    """
    Fetch all text content for a specific page from the ingested documents.
    """
    all_docs = load_bm25_documents()
    if not all_docs:
        return ""

    # Filter by page number AND collection_id
    page_chunks = [
        doc.page_content for doc in all_docs 
        if str(doc.metadata.get("page")) == str(page_num) and
        (not collection_id or doc.metadata.get("collection_id") == collection_id)
    ]
    
    return "\n\n".join(page_chunks)
def get_page_chunks(page_number: int) -> str:
    """
    Directly fetch all stored chunks for a specific page from ChromaDB 
    using a metadata filter. Much faster than downloading + parsing the PDF.
    Returns the combined text of all chunks on that page.
    """
    try:
        vector_store = VectorStore()
        # Use ChromaDB's native 'where' filter on metadata
        results = vector_store.db.get(
            where={"page": page_number},
            include=["documents", "metadatas"]
        )
        docs = results.get("documents", [])
        if not docs:
            # Fallback: try as string in case page was stored as string
            results = vector_store.db.get(
                where={"page": str(page_number)},
                include=["documents", "metadatas"]
            )
            docs = results.get("documents", [])

        if docs:
            return "\n\n".join(docs)
        return ""
    except Exception as e:
        print(f"⚠️ ChromaDB page fetch failed: {e}")
        return ""
