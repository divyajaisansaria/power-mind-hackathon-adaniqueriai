import os
import json
import time
from typing import Dict, Any

from app.core.config import GROQ_API_KEY, GEMINI_MODEL
from app.core.vector_store import VectorStore
from app.core.llm import generate_answer
import hashlib

def get_or_build_summary(pdf_path: str = None) -> Dict[str, Any]:
    """
    Generate summary using the already stored chunks in Chroma DB (rag_collection).
    Benefiting from unified triple-redundant LLM fallback logic.
    """
    # Create fingerprint based on PDF bytes
    if pdf_path and os.path.exists(pdf_path):
        with open(pdf_path, "rb") as f:
            file_bytes = f.read()
            fingerprint = hashlib.sha256(file_bytes).hexdigest()[:16]
    else:
        fingerprint = "default_summary_cache"
        
    cache_path = f"data/processed/summaries/{fingerprint}.json"
    
    # Return from memory if already saved
    if os.path.exists(cache_path):
        print(f"Memory hit: Loading cached summary from {cache_path}...")
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)
            
    print("Retrieving pre-computed chunks from ChromaDB 'rag_collection'...")
    vector_store = VectorStore()
    
    # Get all documents from the existing vector store collection
    all_data = vector_store.db.get()
    documents = all_data.get("documents", [])
    metadatas = all_data.get("metadatas", [])
    
    if not documents:
        # Fallback: extract text directly from the PDF using PyMuPDF
        if pdf_path and os.path.exists(pdf_path):
            print(f"No chunks in Vector DB. Falling back to direct PDF extraction from {pdf_path}...")
            try:
                import fitz
                text_chunks = []
                doc = fitz.open(pdf_path)
                for page_num in range(min(len(doc), 40)):
                    page = doc[page_num]
                    text = page.get_text("text").strip()
                    if text and len(text) > 50:
                        text_chunks.append(f"--- Page {page_num + 1} ---\n{text[:1200]}")
                doc.close()
                context_text = "\n\n".join(text_chunks)
            except Exception as e:
                return {"overview": f"Could not extract PDF text: {e}", "sections": []}
        else:
            return {"overview": "No chunks found in Vector DB. Please run the ingestion pipeline first.", "sections": []}
    else:
        print(f"Retrieved {len(documents)} chunks. Preparing single-pass context...")
        
        # Filter to only important chunks (e.g., > 100 chars) to reduce noise
        important_chunks = []
        for doc, meta in zip(documents, metadatas):
            if doc and len(doc.strip()) > 100:
                important_chunks.append((doc, meta))
                
        # Keep only the top 15 longest chunks
        important_chunks = sorted(important_chunks, key=lambda x: len(x[0]), reverse=True)[:15]
                
        # Combine chunks into context for generate_answer
        context_chunks = []
        for i, (doc, meta) in enumerate(important_chunks):
            doc_type = meta.get("page_content" if "page_content" in meta else "type", "Text")
            page = meta.get("page", "?")
            context_chunks.append({
                "citation": f"P{page}:{doc_type}",
                "content": doc[:800]
            })

    print("Generating comprehensive summary via unified LLM pipeline...")
    query = "Provide a comprehensive, well-structured global summary of this document. Break it down into major sections with Markdown headings. Highlight key financial figures, major announcements, and important contextual information."
    
    # If we had context_text from fallback, wrap it
    if 'context_text' in locals():
        context_chunks = [{"citation": "PDF Raw", "content": context_text}]

    overview = generate_answer(query, context_chunks)
    
    result = {"overview": overview, "sections": []}
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
        
    return result

def answer_from_summary(query: str, pdf_path: str = None) -> str:
    """
    Question-answering function grounded strictly in the existing rag_collection.
    """
    vector_store = VectorStore()
    results = vector_store.search(query, top_k=5)
    
    if not results:
        return "No information found in the Vector DB."
        
    context_chunks = []
    for doc, score in results:
        context_chunks.append({
            "citation": f"Page {doc.metadata.get('page', '?')}",
            "content": doc.page_content
        })
    return generate_answer(query, context_chunks)
