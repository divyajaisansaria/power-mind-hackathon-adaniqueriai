def classify_chunk(text: str) -> str:
    text_lower = text.lower()

    if any(word in text_lower for word in ["highlights", "summary", "overview"]):
        return "summary"

    if sum(c.isdigit() for c in text) > 10:
        return "table"

    if "appendix" in text_lower:
        return "appendix"

    return "narrative"