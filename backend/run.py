from app.ingestion.pipeline import run_ingestion

if __name__ == "__main__":
    file_path = "../data/raw/doc.pdf"
    run_ingestion(file_path)