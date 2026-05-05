import sys
import os
import json
import uuid
import traceback
import requests
from typing import List, Tuple
from pydub import AudioSegment
from pydub.generators import Sine
from pydub.utils import which
from pathlib import Path

# Make sure pydub finds ffmpeg
AudioSegment.converter = which("ffmpeg") or "ffmpeg"

# Load environment variables manually
def load_env():
    env_path = Path(__file__).parent.parent / "backend" / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, value = line.strip().split("=", 1)
                    os.environ[key.strip()] = value.strip().strip('"').strip("'")

load_env()

# Config
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROK_API_KEY = os.environ.get("GROK_API_KEY", "")

AZURE_TTS_KEY = os.environ.get("AZURE_TTS_KEY", "")
AZURE_TTS_ENDPOINT = os.environ.get("AZURE_TTS_ENDPOINT", "")
AZURE_REGION = os.environ.get("AZURE_REGION", "")

def log(*a): 
    print("[podcast]", *a, file=sys.stderr, flush=True)

def gen_dialog_groq(seed: str) -> str:
    """Primary engine: Groq (Llama 3)"""
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    
    prompt = f"""Write a ~12 line podcast conversation alternating Host: / Guest: based on:
{seed}
English only, no stage directions. Each line must start with Host: or Guest:"""

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a professional podcast writer."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.8,
    )
    return completion.choices[0].message.content

def gen_dialog_grok(seed: str) -> str:
    """Fallback 2: Grok (xAI)"""
    from openai import OpenAI
    client = OpenAI(
        api_key=GROK_API_KEY,
        base_url="https://api.x.ai/v1",
    )
    
    prompt = f"""Write a ~10 line podcast conversation alternating Host: / Guest: based on:
{seed}
English only, no stage directions. Each line must start with Host: or Guest:"""

    models_to_try = ["grok-2-1212", "grok-2", "grok-beta"]
    for model_name in models_to_try:
        try:
            log(f"Trying Grok model: {model_name}")
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a professional podcast writer."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.8,
            )
            return completion.choices[0].message.content
        except Exception:
            continue
    raise RuntimeError("All Grok models failed")

def gen_dialog_gemini(seed: str) -> str:
    """Fallback 1: Gemini"""
    from google import genai
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    prompt = f"""Write a ~10 line podcast conversation alternating Host: / Guest: based on:
{seed}
English only, no stage directions. Each line must start with Host: or Guest:"""
    
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
    )
    return response.text

def gen_dialog(seed: str) -> List[Tuple[str, str]]:
    """
    Generate podcast script using Groq as primary, with Gemini and Grok as fallbacks.
    """
    text = ""
    # Try Groq First (Fastest and Reliable)
    try:
        log("Trying Groq...")
        text = gen_dialog_groq(seed)
    except Exception as e:
        log("Groq failed, trying Gemini:", e)
        try:
            text = gen_dialog_gemini(seed)
        except Exception as e2:
            log("Gemini failed, trying Grok:", e2)
            try:
                text = gen_dialog_grok(seed)
            except Exception as e3:
                log("All AI engines failed:", e3)
                text = "Host: Welcome back.\nGuest: Thanks. This is an important section."

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    out: List[Tuple[str, str]] = []
    for ln in lines:
        if ln.startswith("Host:"):
            out.append(("Host", ln[5:].strip()))
        elif ln.startswith("Guest:"):
            out.append(("Guest", ln[6:].strip()))
        elif ":" in ln:
            parts = ln.split(":", 1)
            speaker = parts[0].strip()
            content = parts[1].strip()
            if speaker in ["Host", "Guest"]:
                out.append((speaker, content))

    if not out:
        out = [("Host", "Welcome back."), ("Guest", "Thanks for having me.")]
    return out[:14]

def azure_tts_mp3(voice: str, text: str) -> bytes:
    if not AZURE_TTS_KEY:
        raise RuntimeError("AZURE_TTS_KEY not set")
    
    endpoint = AZURE_TTS_ENDPOINT or f"https://{AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
    if not endpoint.startswith("https://"):
        raise RuntimeError(f"Bad AZURE_TTS_ENDPOINT: {endpoint}")
        
    ssml = f"<speak version='1.0' xml:lang='en-IN'><voice name='{voice}'>{text}</voice></speak>"
    h = {
        "Ocp-Apim-Subscription-Key": AZURE_TTS_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3",
        "User-Agent": "podcast-generator",
    }
    r = requests.post(endpoint, data=ssml.encode("utf-8"), headers=h, timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"Azure REST failed: {r.status_code} {r.text[:200]}")
    return r.content

def main():
    try:
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except:
            pass

        seed = sys.stdin.read().strip()
        if not seed:
            raise RuntimeError("Empty text from stdin")

        root_dir = Path(__file__).parent.parent
        output_dir = root_dir / "frontend" / "public" / "audio"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        log("ffmpeg at:", AudioSegment.converter)

        convo = gen_dialog(seed)
        segs = []
        for i, (sp, txt) in enumerate(convo, 1):
            voice = "en-IN-NeerjaNeural" if sp == "Host" else "en-IN-PrabhatNeural"
            try:
                log(f"TTS {i}/{len(convo)} voice={voice}")
                mp3 = azure_tts_mp3(voice, txt)
                
                tmp_path = output_dir / f"_seg_{uuid.uuid4().hex}.mp3"
                with open(tmp_path, "wb") as f:
                    f.write(mp3)
                
                segs.append(AudioSegment.from_file(str(tmp_path), format="mp3"))
                tmp_path.unlink()
            except Exception as e:
                log("TTS error -> fallback tone:", e)
                segs.append(Sine(440 if sp == "Host" else 330).to_audio_segment(duration=800))

        if not segs:
            raise RuntimeError("No audio segments generated")

        out = AudioSegment.silent(400)
        for s in segs:
            out += s + AudioSegment.silent(350)

        name = f"podcast_{uuid.uuid4().hex[:8]}.mp3"
        final_path = output_dir / name
        
        log("Exporting to:", final_path)
        out.export(str(final_path), format="mp3")
        print(f"/audio/{name}")
        
    except Exception as e:
        log("FATAL:", e)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
