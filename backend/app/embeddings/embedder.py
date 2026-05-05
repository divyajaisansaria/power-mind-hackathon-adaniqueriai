from sentence_transformers import SentenceTransformer

# ✅ Load ONCE globally
model = SentenceTransformer("all-MiniLM-L6-v2")