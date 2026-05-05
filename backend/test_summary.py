from summariser.pipeline import get_or_build_summary, answer_from_summary

if __name__ == "__main__":
    pdf_path = "../data/raw/doc.pdf"
    print(f"Building summary for {pdf_path}...")
    
    summary = get_or_build_summary(pdf_path)
    
    print("\n--- GLOBAL OVERVIEW ---")
    print(summary["overview"])
    print("-----------------------\n")