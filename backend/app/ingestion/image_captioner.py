import fitz
import io
import os
import time
from PIL import Image
from google import genai
from google.genai import types
from langchain_core.documents import Document
from app.core.config import GEMINI_API_KEY, GEMINI_MODEL


def render_page_to_image(page, dpi=200):
    """Render a PDF page as a PIL Image"""
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)
    img_data = pix.tobytes("png")
    return Image.open(io.BytesIO(img_data))


def caption_page_with_gemini(image, page_num):
    """Send page image to Gemini Vision with Retry Logic for 429 errors"""
    client = genai.Client(api_key=GEMINI_API_KEY)

    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()

    prompt = f"""You are analyzing page {page_num} of a financial earnings presentation.
Describe ALL visual content (charts, tables, graphs) in detail. Include every number and label.
If no data exists, say NO_DATA."""

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    prompt,
                    types.Part.from_bytes(data=img_bytes, mime_type='image/png')
                ]
            )
            return response.text
        except Exception as e:
            if "429" in str(e):
                wait_time = 20  # Wait 20 seconds
                print(f"    [WAIT] Rate limit hit. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise e
    return "ERROR: Max retries exceeded for this page."


def extract_visual_documents(file_path):
    """Extract visuals and SAVE page images for the UI"""
    if not GEMINI_API_KEY:
        return []

    output_dir = "data/processed/images"
    os.makedirs(output_dir, exist_ok=True)

    doc = fitz.open(file_path)
    visual_docs = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images(full=True)

        # Only process pages with visual potential (2+ images)
        if len(images) < 2:
            continue

        print(f"    [IMG] Processing Page {page_num + 1}...")

        image = render_page_to_image(page)
        image_filename = f"page_{page_num + 1}.png"
        image_path = os.path.join(output_dir, image_filename)
        image.save(image_path)

        try:
            # Wait 6 seconds between pages (10 requests per minute)
            time.sleep(6) 
            
            caption = caption_page_with_gemini(image, page_num + 1)

            if "NO_DATA" in caption or "ERROR" in caption:
                continue

            visual_doc = Document(
                page_content=f"Visuals from Page {page_num + 1}:\n{caption}",
                metadata={
                    "page": page_num + 1,
                    "image_path": f"/static/images/{image_filename}",
                    "type": "visual",
                    "chunk_id": f"visual_{page_num + 1}"
                }
            )
            visual_docs.append(visual_doc)
        except Exception as e:
            print(f"    [WARN] Error on page {page_num+1}: {e}")

    doc.close()
    return visual_docs
