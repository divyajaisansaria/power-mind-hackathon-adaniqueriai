from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
import requests as http_requests

from app.core.retriever import retrieve
from app.core.llm import generate_answer
from app.core.config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY
from app.summariser.pipeline import get_or_build_summary
from app.podcast.pipeline import generate_podcast_audio

app = FastAPI(title="Multimodal RAG API")


# Enable CORS so your Next.js frontend can talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    query: str
    collection_id: Optional[str] = None

class Source(BaseModel):
    citation: str
    content: str
    page: str
    type: str
    rrf_score: float
    rank: int

class ChatResponse(BaseModel):
    answer: str
    sources: List[Source]

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        # 1. Retrieve top-k chunks with optional collection filtering (top_k=5 for focus)
        chunks = retrieve(request.query, top_k=5, collection_id=request.collection_id)
        
        if not chunks:
            return ChatResponse(
                answer="I'm sorry, but no relevant information was found in the document.",
                sources=[]
            )

        # 2. Generate answer using LLM
        answer = generate_answer(request.query, chunks)

        # 3. Format sources for the frontend
        sources = []
        for i, chunk in enumerate(chunks):
            sources.append(Source(
                citation=chunk['citation'],
                content=chunk['content'],
                page=str(chunk['metadata'].get('page', 'unknown')),
                type=chunk['metadata'].get('type', 'text'),
                rrf_score=round(chunk['rrf_score'], 4),
                rank=i + 1
            ))

        return ChatResponse(answer=answer, sources=sources)

    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class SummarizeRequest(BaseModel):
    pdf_url: str
    query: Optional[str] = None
    source_text: Optional[str] = None
    page_number: Optional[int] = None

@app.post("/summarize")
async def summarize_endpoint(request: SummarizeRequest):
    try:
        # Download PDF to a temp file
        print(f"Downloading PDF from {request.pdf_url}...")
        response = http_requests.get(request.pdf_url, timeout=60)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        try:
            # Uses the same pipeline as test_summary.py
            # Fingerprints by PDF bytes → checks cache → ChromaDB chunks → PyMuPDF fallback → LLM
            result = get_or_build_summary(tmp_path)
        finally:
            os.unlink(tmp_path)

        return {"success": True, "summary": result}

    except Exception as e:
        print(f"Error in summarize endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/page_content/{collection_id}/{page_num}")
async def page_content_endpoint(collection_id: str, page_num: int):
    try:
        from app.core.retriever import get_page_content
        content = get_page_content(page_num, collection_id=collection_id)
        return {"success": True, "content": content}
    except Exception as e:
        print(f"Error in page_content endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class IngestRequest(BaseModel):
    pdf_url: str
    collection_id: Optional[str] = None

@app.post("/ingest")
async def ingest_endpoint(request: IngestRequest):
    try:
        from app.ingestion.pipeline import run_ingestion
        
        # Download PDF to a temp file
        print(f"Downloading PDF for ingestion from {request.pdf_url}...")
        response = http_requests.get(request.pdf_url, timeout=120)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        try:
            # Run the full pipeline
            all_docs = run_ingestion(tmp_path, collection_id=request.collection_id)
            return {
                "success": True, 
                "message": "Ingestion complete", 
                "chunk_count": len(all_docs)
            }
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        print(f"Error in ingest endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/podcast")
async def podcast_endpoint(request: SummarizeRequest):
    try:
        print(f"🎧 Podcast requested for: {request.pdf_url}")
        
        if request.source_text:
            print("📜 Source text provided directly, skipping PDF download.")
            result = generate_podcast_audio(None, None, request.source_text)
        elif request.page_number is not None:
            print(f"📄 Page {request.page_number} requested — fetching from ChromaDB, no PDF download needed.")
            result = generate_podcast_audio(None, None, None, request.page_number)
        else:
            try:
                response = http_requests.get(request.pdf_url, timeout=60)
                response.raise_for_status()
                print("✅ PDF download successful for podcast")
            except Exception as download_err:
                raise HTTPException(status_code=400, detail=f"Failed to download PDF from source: {str(download_err)}")

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(response.content)
                tmp_path = tmp.name

            try:
                result = generate_podcast_audio(tmp_path, request.query, None, None)
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown podcast generation error"))

        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Error in podcast endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
