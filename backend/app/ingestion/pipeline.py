from app.ingestion.parser import extract_text_from_pdf
from app.ingestion.chunker import chunk_text
from app.ingestion.table_extractor import extract_all_tables
from app.ingestion.image_captioner import extract_visual_documents
from app.enrichment.enricher import enrich_document
from app.core.vector_store import VectorStore

import json
import os
import hashlib


def get_file_hash(file_path: str) -> str:
    """Calculate SHA256 hash of a file for deduplication"""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def run_ingestion(file_path: str, collection_id: str = None):
    print("=" * 60)
    print("  RAG INGESTION PIPELINE")
    print("=" * 60)

    file_hash = get_file_hash(file_path)
    file_name = os.path.basename(file_path)
    vector_store = VectorStore()

    # If collection_id is provided, check if THIS specific file in THIS collection is already indexed
    # We use both to allow the same file in different collections (if needed)
    if vector_store.check_file_exists(file_hash):
        print(f"\n[SKIP] File '{file_name}' (hash: {file_hash[:10]}...) is already indexed.")
        print("       No need to generate embeddings again.")
        print("=" * 60)
        return []

    # === Path 1: Text Extraction (existing) ===
    print("\n[Path 1] Extracting text from PDF...")
    documents = extract_text_from_pdf(file_path)

    print("   Chunking text...")
    split_docs = chunk_text(documents)
    print(f"   >> {len(split_docs)} text chunks created")

    print("   Enriching text chunks...")
    enriched_text = [enrich_document(doc) for doc in split_docs]

    # === Path 2: Table Extraction ===
    print("\n[Path 2] Extracting tables from PDF...")
    table_docs = extract_all_tables(file_path)
    print(f"   >> {len(table_docs)} table documents extracted")

    # === Path 3: Visual/Chart Extraction via Gemini Vision ===
    print("\n[Path 3] Extracting visual content (charts/graphs)...")
    visual_docs = extract_visual_documents(file_path)
    print(f"   >> {len(visual_docs)} visual documents extracted")

    # === Combine All Documents ===
    all_docs = enriched_text + table_docs + visual_docs

    print(f"\nTotal documents to store: {len(all_docs)}")
    print(f"   Text chunks:    {len(enriched_text)}")
    print(f"   Table docs:     {len(table_docs)}")
    print(f"   Visual docs:    {len(visual_docs)}")

    # === Store in ChromaDB ===
    print("\nStoring all documents in ChromaDB...")
    
    file_hash = get_file_hash(file_path)
    file_name = os.path.basename(file_path)
    
    # Add file metadata to all chunks
    for doc in all_docs:
        doc.metadata["source_hash"] = file_hash
        doc.metadata["file_name"] = file_name
        if collection_id:
            doc.metadata["collection_id"] = collection_id

    vector_store = VectorStore()
    
    # Deduplication: If this exact file exists, clear its old chunks first
    try:
        print(f"   Checking for existing chunks for: {file_name}")
        # ChromaDB delete by metadata filter
        vector_store.db.delete(where={"source_hash": file_hash})
        print("   Cleared previous versions of this file.")
    except Exception as e:
        print(f"   No previous versions found or error: {e}")

    vector_store.add_documents(all_docs)

    bm25_path = "data/processed/all_documents.json"
    existing_bm25 = []
    if os.path.exists(bm25_path):
        try:
            with open(bm25_path, "r", encoding="utf-8") as f:
                existing_bm25 = json.load(f)
        except:
            existing_bm25 = []

    # Remove old entries for THIS file from the JSON list
    existing_bm25 = [
        item for item in existing_bm25 
        if item.get("metadata", {}).get("source_hash") != file_hash
    ]

    # Add new entries
    for doc in all_docs:
        existing_bm25.append({
            "content": doc.page_content,
            "metadata": {k: str(v) for k, v in doc.metadata.items()}
        })

    with open(bm25_path, "w", encoding="utf-8") as f:
        json.dump(existing_bm25, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print("  INGESTION COMPLETE")
    print(f"{'=' * 60}")
    print(f"   Documents in ChromaDB:  {len(all_docs)}")
    print(f"   BM25 index saved to:    data/processed/all_documents.json")

    # Show a sample from each type
    for doc_type, docs in [("Text", enriched_text), ("Table", table_docs), ("Visual", visual_docs)]:
        if docs:
            print(f"\n   Sample {doc_type} chunk (first 200 chars):")
            sample = docs[0].page_content[:200]
            # Safe print for Windows
            print(f"      {sample.encode('ascii', 'replace').decode()}")

    return all_docs