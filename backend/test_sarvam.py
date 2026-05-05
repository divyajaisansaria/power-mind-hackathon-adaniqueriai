import os
import requests
from dotenv import load_dotenv

load_dotenv()
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")

def test_sarvam():
    url = "https://api.sarvam.ai/text-to-speech"
    
    payload = {
        "inputs": ["Hello, this is a test of the Sarvam TTS API."],
        "target_language_code": "en-IN",
        "speaker": "priya",
        "pace": 1.0,
        "speech_sample_rate": 8000,
        "enable_preprocessing": True,
        "model": "bulbul:v3"
    }
    
    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json"
    }
    
    print("Testing payload:", payload)
    response = requests.post(url, json=payload, headers=headers)
    print("Status:", response.status_code)
    
    if response.status_code != 200:
        print("Error:", response.text)
    else:
        print("Success! Audio returned.")

if __name__ == "__main__":
    test_sarvam()
