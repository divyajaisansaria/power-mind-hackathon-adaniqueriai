import os
import json
import time
from typing import Dict, Any

from app.core.config import GROQ_API_KEY, GEMINI_MODEL
from app.core.vector_store import VectorStore
from app.core.llm import get_client, generate_answer

import hashlib

def get_or_build_summary(pdf_path: str = None) -> Dict[str, Any]:
    """
    Generate summary using the already stored chunks in Chroma DB (rag_collection).
    Uses Groq for extremely fast generation if GROQ_API_KEY is provided.
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
        return {"overview": "No chunks found in Vector DB. Please run the ingestion pipeline first.", "sections": []}
        
    print(f"Retrieved {len(documents)} chunks. Preparing single-pass context...")
    
    # Filter to only important chunks (e.g., > 100 chars) to reduce noise
    important_chunks = []
    for doc, meta in zip(documents, metadatas):
        if doc and len(doc.strip()) > 100:
            important_chunks.append((doc, meta))
            
    # Keep only the top 15 longest chunks to prevent context window bloat for Llama 3 (8k window)
    important_chunks = sorted(important_chunks, key=lambda x: len(x[0]), reverse=True)[:15]
            
    # Combine chunks into one massive context payload
    context_text = ""
    for i, (doc, meta) in enumerate(important_chunks):
        doc_type = meta.get("type", "Text")
        page = meta.get("page", "?")
        # Cap each chunk to ~600 characters so 15 chunks fits well within Llama3's context limits
        context_text += f"\n--- Chunk {i+1} (Type: {doc_type}, Page: {page}) ---\n{doc[:600]}\n"

    prompt = f"""
You are a highly capable financial analyst. 
I am providing you with extracted chunks (text, tables, visual summaries) from a document.
Please generate a comprehensive, well-structured global summary of this document.
Break it down into major sections with Markdown headings. Highlight key financial figures, major announcements, and any important contextual information.

DOCUMENT CHUNKS:
{context_text}
"""

    if GROQ_API_KEY:
        print("Generating summary using your provided API Key for maximum speed...")
        try:
            if GROQ_API_KEY.startswith("xai-"):
                import requests
                url = "https://api.x.ai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                data = {
                    "model": "grok-beta",
                    "messages": [
                        {"role": "system", "content": "You are a professional financial analyst assistant."},
                        {"role": "user", "content": prompt}
                    ]
                }
                response = requests.post(url, headers=headers, json=data)
                response.raise_for_status()
                overview = response.json()["choices"][0]["message"]["content"]
            else:
                from groq import Groq
                client = Groq(api_key=GROQ_API_KEY)
                chat_completion = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": "You are a professional financial analyst assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    model="llama-3.1-8b-instant",
                )
                overview = chat_completion.choices[0].message.content
            
            result = {"overview": overview, "sections": []}
            os.makedirs(os.path.dirname(cache_path), exist_ok=True)
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
            return result
        except Exception as e:
            return {"overview": f"Error generating summary: {e}", "sections": []}
    else:
        print(f"GROQ_API_KEY not found. Falling back to Gemini ({GEMINI_MODEL})...")
        client = get_client()
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=prompt
                )
                overview = response.text
                result = {"overview": overview, "sections": []}
                os.makedirs(os.path.dirname(cache_path), exist_ok=True)
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(result, f, indent=2)
                return result
            except Exception as e:
                if "429" in str(e):
                    print(f"Rate limit hit. Retrying in 10s... (Attempt {attempt+1}/3)")
                    time.sleep(10)
                else:
                    return {"overview": f"Error with Gemini: {e}", "sections": []}
                    
        return {"overview": "Failed due to rate limits.", "sections": []}

def answer_from_summary(query: str, pdf_path: str = None) -> str:
    """
    Question-answering function grounded strictly in the existing rag_collection.
    Uses Groq if available, otherwise falls back to Gemini.
    """
    vector_store = VectorStore()
    results = vector_store.search(query, top_k=5)
    
    if not results:
        return "No information found in the Vector DB."
        
    if GROQ_API_KEY:
        context_text = ""
        for doc, score in results:
            context_text += f"---\nSOURCE Page {doc.metadata.get('page', '?')}:\n{doc.page_content}\n"
            
        prompt = f"""
You are a professional financial analyst assistant. 
Answer the user's question based ONLY on the provided context.

STRICT RULES:
1. Every fact/number must be cited using the source page.
2. If the data is not present, say exactly: "I'm sorry, but that information is not available in the provided document."
3. Be precise with financial numbers. Use tables if it makes the answer clearer.

CONTEXT:
{context_text}

USER QUESTION:
{query}

ANSWER:
"""
        try:
            if GROQ_API_KEY.startswith("xai-"):
                import requests
                url = "https://api.x.ai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                data = {
                    "model": "grok-beta",
                    "messages": [{"role": "user", "content": prompt}]
                }
                response = requests.post(url, headers=headers, json=data)
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]
            else:
                from groq import Groq
                client = Groq(api_key=GROQ_API_KEY)
                chat_completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama-3.1-8b-instant",
                )
                return chat_completion.choices[0].message.content
        except Exception as e:
            return f"Error querying API: {e}"
    else:
        # Fallback to Gemini
        context_chunks = []
        for doc, score in results:
            context_chunks.append({
                "citation": f"Page {doc.metadata.get('page', '?')}",
                "content": doc.page_content
            })
        return generate_answer(query, context_chunks)