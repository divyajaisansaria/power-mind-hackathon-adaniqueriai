import time
import os
from google import genai
from openai import OpenAI
from app.core.config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY, GROK_API_KEY

# Gemini models to try in order of preference.
# Each model has its OWN separate free-tier quota, so if one is exhausted,
# the next one likely still has quota remaining.
GEMINI_MODEL_CASCADE = [
    "gemini-2.5-flash",       # Best quality flash model
    "gemini-2.5-flash-lite",  # Lighter but separate quota
    "gemini-1.5-flash",       # Older but reliable (1.5-flash), separate quota
    "gemini-1.5-pro",         # Pro model (1.5-pro), separate quota pool
]

def get_client():
    """Returns the Gemini client"""
    return genai.Client(api_key=GEMINI_API_KEY)

def generate_with_groq(prompt):
    """Fallback using Groq's OpenAI-compatible API"""
    print("\n🔄 Falling back to Groq API (Llama 3.3)...")
    if not GROQ_API_KEY:
        raise Exception("Groq API key missing.")

    client = OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )
    
    # Using llama-3.3-70b-versatile with temperature 0 for strict factual RAG accuracy
    models = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama3-70b-8192"]
    
    for model_name in models:
        try:
            print(f"🤖 Trying Groq model: {model_name}")
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a professional financial analyst assistant. Answer questions precisely based ONLY on the context provided. Do NOT make up information."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.0
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"⚠️ Groq ({model_name}) failed: {str(e)}")
            continue
    raise Exception("All Groq models failed.")

def generate_with_grok(prompt):
    """Final fallback using xAI (Grok)"""
    print("\n🔄 Falling back to xAI (Grok) API...")
    if not GROK_API_KEY:
        raise Exception("Grok API key missing.")

    client = OpenAI(
        api_key=GROK_API_KEY,
        base_url="https://api.x.ai/v1",
    )
    
    models = ["grok-2-1212", "grok-2-latest", "grok-beta"]
    
    for model_name in models:
        try:
            print(f"🤖 Trying xAI model: {model_name}")
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a professional financial analyst assistant."},
                    {"role": "user", "content": prompt},
                ],
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"⚠️ xAI ({model_name}) failed: {str(e)}")
            continue
    raise Exception("All xAI models failed.")

def generate_answer(query, context_chunks):
    """
    Unified chat answer generator with multi-model Gemini cascade and Groq/Grok fallbacks.
    Tries multiple Gemini models (each has separate quota) before falling back to others.
    """
    client = get_client()

    context_text = ""
    for chunk in context_chunks:
        context_text += f"Source [{chunk['citation']}]: {chunk['content']}\n\n"

    prompt = f"""You are a professional financial analyst assistant. Use the provided context to answer the user's query.

CONTEXT:
{context_text}

QUERY: {query}

Instructions:
1. Answer the query precisely based ONLY on the provided context.
2. If the answer is not in the context, explicitly state that you don't know based on the provided documents.
3. Use citations in the format [pX:chunk_id] at the end of relevant sentences.
4. Keep the tone professional and analytical.

ANSWER:
"""

    # 1. Try Gemini Cascade
    if GEMINI_API_KEY:
        for model_name in GEMINI_MODEL_CASCADE:
            for attempt in range(2):  # 2 retries per model
                try:
                    print(f"🤖 Trying Gemini model: {model_name} (attempt {attempt+1})")
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt
                    )
                    print(f"✅ Success with {model_name}")
                    return response.text
                except Exception as e:
                    err_str = str(e).lower()
                    if "429" in str(e) or "quota" in err_str or "limit" in err_str or "resource_exhausted" in err_str:
                        print(f"⚠️ {model_name} quota hit. ", end="")
                        if attempt == 0:
                            print("Retrying after 2s...")
                            time.sleep(2)
                        else:
                            print(f"Moving to next model...")
                        continue
                    else:
                        print(f"⚠️ Gemini Error with {model_name}: {str(e)}")
                        break  # Skip to next model
    
    # 2. Fallback to Groq
    if GROQ_API_KEY:
        try:
            return generate_with_groq(prompt)
        except Exception as groq_err:
            print(f"⚠️ Groq fallback failed: {str(groq_err)}")

    # 3. Fallback to xAI (Grok)
    if GROK_API_KEY:
        try:
            return generate_with_grok(prompt)
        except Exception as e:
            print(f"⚠️ xAI fallback failed: {str(e)}")

    return "Error: All LLM providers (Gemini, Groq, xAI) failed or are unconfigured. Please check your API keys and quotas."

def generate_chunk_answer(query, chunk):
    """
    Per-chunk answer generator with multi-model Gemini cascade and Groq fallback.
    Used for specific analysis tasks where per-chunk processing is needed.
    """
    client = get_client()
    prompt = f"Query: {query}\nSource: {chunk['content']}\nAnswer based ONLY on source:"

    if GEMINI_API_KEY:
        for model_name in GEMINI_MODEL_CASCADE:
            for attempt in range(2):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt
                    )
                    return response.text
                except Exception as e:
                    err_str = str(e).lower()
                    if "429" in str(e) or "quota" in err_str or "limit" in err_str:
                        if attempt == 0:
                            time.sleep(1)
                        continue
                    break

    try:
        return generate_with_groq(prompt)
    except Exception:
        return "Error: Could not generate answer for this chunk."
