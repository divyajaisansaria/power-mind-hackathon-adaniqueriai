from app.enrichment.classifier import classify_chunk
from app.enrichment.metadata import extract_section, extract_topic
from langchain_core.documents import Document

GLOSSARY = {
    "EBITDA": "Earnings Before Interest Tax Depreciation and Amortization",
    "AAHL": "Adani Airport Holdings Limited",
    "IRM": "Integrated Resource Management",
    "ANIL": "Adani New Industries Limited"
}

def apply_glossary(text):
    enriched = text
    for term, definition in GLOSSARY.items():
        if term in text:
            enriched += f" ({definition})"
    return enriched

def enrich_document(doc: Document) -> Document:
    content = doc.page_content

    chunk_type = classify_chunk(content)
    section = extract_section(content)
    topic = extract_topic(content)

    enriched_text = apply_glossary(content)

    final_text = (
        f"Section: {section} | Page: {doc.metadata.get('page', 'Unknown')} | Type: {chunk_type} | Topic: {topic}\n"
        + enriched_text
    )

    new_metadata = doc.metadata.copy()
    new_metadata.update({
        "type": chunk_type,
        "section": section,
        "topic": topic
    })

    return Document(page_content=final_text, metadata=new_metadata)