import os
import json
import base64
import requests
import wave
import io
from typing import Dict, Any
from app.core.config import SARVAM_API_KEY, GROQ_API_KEY
from app.summariser.pipeline import get_or_build_summary
from app.core.retriever import retrieve, get_page_chunks
from app.core.llm import generate_answer
from openai import OpenAI
import re

def merge_base64_wavs(base64_wavs):
    if not base64_wavs:
        return None
        
    first_wav_bytes = base64.b64decode(base64_wavs[0])
    first_wav_io = io.BytesIO(first_wav_bytes)
    
    with wave.open(first_wav_io, 'rb') as w_in:
        params = w_in.getparams()
        
    out_io = io.BytesIO()
    with wave.open(out_io, 'wb') as w_out:
        w_out.setparams(params)
        for b64_wav in base64_wavs:
            wav_bytes = base64.b64decode(b64_wav)
            wav_io = io.BytesIO(wav_bytes)
            with wave.open(wav_io, 'rb') as w_in:
                w_out.writeframes(w_in.readframes(w_in.getnframes()))
                
    return base64.b64encode(out_io.getvalue()).decode('utf-8')

def generate_podcast_audio(pdf_path: str = None, query: str = None, source_text_override: str = None, page_number: int = None) -> Dict[str, Any]:
    """
    Generates a 2-speaker podcast conversation. 
    If source_text_override is provided, uses it directly.
    If page_number is provided, extracts text from that specific page.
    If query is provided, it answers the query. 
    Otherwise, it summarizes the document.
    """
    if not SARVAM_API_KEY:
        return {"success": False, "error": "SARVAM_API_KEY is not configured."}
        
    print(f"🎙️ Starting 2-Speaker Podcast Pipeline. Query: {bool(query)}, Direct Text: {bool(source_text_override)}, Page: {page_number}")
    
    # 1. Get Source Text
    source_text = ""
    if source_text_override:
        source_text = source_text_override
    elif page_number is not None:
        print(f"📄 Fetching page {page_number} chunks from ChromaDB vector store...")
        source_text = get_page_chunks(page_number)
        if not source_text.strip():
            return {"success": False, "error": f"No vector embeddings found for page {page_number}. Try asking a question instead."}
        print(f"✅ Found {len(source_text)} chars of text for page {page_number}")
    elif query:
        # Retrieve chunks and get a factual answer first
        chunks = retrieve(query, top_k=5)
        if not chunks:
            source_text = "The document does not contain information about the user's query."
        else:
            answer = generate_answer(query, chunks)
            source_text = f"User Query: {query}\nFactual Answer: {answer}"
    else:
        # Get general overview
        summary_data = get_or_build_summary(pdf_path)
        if "overview" not in summary_data:
            return {"success": False, "error": "Failed to extract summary for podcast."}
        source_text = summary_data["overview"]
    
    # 2. Generate Podcast Script using Groq
    print("✍️ Generating 2-speaker podcast script via Groq...")
    try:
        client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
        
        prompt = f"""
        Convert the following text into a short, engaging 2-speaker conversation (about 4-6 lines total).
        The speakers are 'Priya' (the inquisitive host) and 'Rahul' (the expert).
        Format the script EXACTLY like this with no other text, no sound effects, and no intro/outro beyond the conversation itself:
        
        Priya: [Text]
        Rahul: [Text]
        Priya: [Text]
        
        TEXT TO CONVERT:
        {source_text}
        """
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an expert podcast scriptwriter."},
                {"role": "user", "content": prompt},
            ],
        )
        podcast_script = response.choices[0].message.content.strip()
    except Exception as e:
        print(f"❌ Failed to generate script: {e}")
        return {"success": False, "error": f"Groq script generation failed: {str(e)}"}

    # 3. Parse Script and Convert to Audio
    print("🗣️ Converting script segments to speech via Sarvam API...")
    segments = []
    
    # Split the script by newlines and extract speaker name and text
    lines = [line.strip() for line in podcast_script.split('\n') if line.strip()]
    
    for line in lines:
        if ':' not in line:
            continue
            
        speaker_name, text = line.split(':', 1)
        speaker_name = speaker_name.strip().lower()
        text = text.strip()
        
        # Default to priya if parsing fails or uses wrong name
        api_speaker = "priya"
        if "rahul" in speaker_name:
            api_speaker = "rahul"
            
        try:
            url = "https://api.sarvam.ai/text-to-speech"
            
            payload = {
                "inputs": [text[:500]],
                "target_language_code": "en-IN",
                "speaker": api_speaker,
                "pace": 1.0,
                "speech_sample_rate": 8000,
                "enable_preprocessing": True,
                "model": "bulbul:v3"
            }
            
            headers = {
                "api-subscription-key": SARVAM_API_KEY,
                "Content-Type": "application/json"
            }
            
            resp = requests.post(url, json=payload, headers=headers)
            
            if resp.status_code != 200:
                print(f"❌ Sarvam TTS failed for {api_speaker}: {resp.status_code} - {resp.text}")
                continue # Skip this segment if it fails
                
            resp_data = resp.json()
            if "audios" in resp_data and len(resp_data["audios"]) > 0:
                segments.append({
                    "speaker": speaker_name.title(),
                    "text": text,
                    "audio_base64": resp_data["audios"][0]
                })
                
        except Exception as e:
            print(f"❌ Segment generation failed: {e}")
            continue

    if not segments:
        return {"success": False, "error": "Failed to generate any audio segments from the script."}
        
    print("🎵 Merging audio segments into a single file...")
    base64_wavs = [seg["audio_base64"] for seg in segments]
    try:
        merged_audio = merge_base64_wavs(base64_wavs)
    except Exception as e:
        print(f"❌ Failed to merge audio files: {e}")
        return {"success": False, "error": "Failed to merge audio files."}
        
    return {
        "success": True, 
        "audio_base64": merged_audio, 
        "script": podcast_script
    }
