from langchain_community.document_loaders import PyMuPDFLoader

def extract_text_from_pdf(file_path: str):
    loader = PyMuPDFLoader(file_path)
    # PyMuPDFLoader returns LangChain Document objects 
    # where metadata includes 'page' (0-indexed)
    documents = loader.load()
    
    # Make page 1-indexed to match previous logic
    for doc in documents:
        doc.metadata["page"] = doc.metadata.get("page", 0) + 1
        
    return documents