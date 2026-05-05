import requests

pdf_url = "https://res.cloudinary.com/dktgnnqia/image/upload/v1741021469/docguard_notebooks/m9hqq5q0wlvvskh4g4m8.pdf"
backend_url = "http://localhost:8000/summarize"

print(f"Triggering summary for: {pdf_url}")
try:
    response = requests.post(backend_url, json={"pdf_url": pdf_url}, timeout=120)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
