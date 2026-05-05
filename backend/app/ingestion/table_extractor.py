import fitz
from langchain_core.documents import Document


def format_table_as_markdown(rows):
    """Convert extracted table rows to markdown format"""
    if not rows:
        return ""

    # Clean None values and empty rows
    cleaned = []
    for row in rows:
        cleaned_row = [str(cell).strip() if cell else "" for cell in row]
        if any(cleaned_row):  # Skip completely empty rows
            cleaned.append(cleaned_row)

    if not cleaned:
        return ""

    # Normalize column count
    col_count = max(len(row) for row in cleaned)

    lines = []

    # First row as header
    header = cleaned[0] + [""] * (col_count - len(cleaned[0]))
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join(["---"] * col_count) + " |")

    # Remaining rows
    for row in cleaned[1:]:
        padded = row + [""] * (col_count - len(row))
        lines.append("| " + " | ".join(padded) + " |")

    return "\n".join(lines)


def extract_tables_from_page(page, page_num):
    """Extract tables from a single PDF page using PyMuPDF's find_tables()"""
    documents = []

    try:
        tables = page.find_tables()
    except Exception:
        return documents

    for i, table in enumerate(tables.tables):
        rows = table.extract()
        markdown = format_table_as_markdown(rows)

        # Skip trivially small tables
        if len(markdown.strip()) < 30:
            continue

        # Get surrounding text from the page for context
        page_text = page.get_text()
        # Extract first meaningful lines as context header
        context_lines = [
            line.strip() for line in page_text.split("\n")
            if len(line.strip()) > 3
        ][:5]
        context = " | ".join(context_lines)

        content = (
            f"Table extracted from Page {page_num}\n"
            f"Context: {context}\n\n"
            f"{markdown}"
        )

        doc = Document(
            page_content=content,
            metadata={
                "page": page_num,
                "chunk_id": f"table_{page_num}_{i}",
                "type": "table",
                "source": "table_extraction",
                "section": context_lines[0] if context_lines else "General",
                "topic": "Financial Data"
            }
        )
        documents.append(doc)

    return documents


def extract_all_tables(file_path):
    """Extract all tables from every page in the PDF"""
    doc = fitz.open(file_path)
    all_table_docs = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        table_docs = extract_tables_from_page(page, page_num + 1)
        all_table_docs.extend(table_docs)

    doc.close()
    return all_table_docs
