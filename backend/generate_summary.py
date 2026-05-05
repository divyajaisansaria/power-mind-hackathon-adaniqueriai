import sys
import json
import os
from app.summariser.pipeline import get_or_build_summary

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No PDF path provided"}))
        return

    pdf_path = sys.argv[1]
    
    # Check if the path is relative and adjust if necessary
    if not os.path.isabs(pdf_path):
        # Assuming we are running from the backend directory
        pdf_path = os.path.abspath(pdf_path)

    try:
        summary = get_or_build_summary(pdf_path)
        print(json.dumps(summary))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
