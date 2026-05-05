def extract_section(text: str) -> str:
    lines = text.split("\n")

    for line in lines[:5]:
        if len(line.strip()) > 5 and len(line.split()) < 10:
            return line.strip()

    return "General"


def extract_topic(text: str) -> str:
    t = text.lower()

    if "ebitda" in t:
        return "EBITDA performance"

    if "revenue" in t or "income" in t:
        return "Revenue"

    if "airport" in t:
        return "Airport business"

    return "General"