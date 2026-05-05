import hashlib
from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_text(documents, chunk_size=800, overlap=150):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
    )
    
    split_docs = text_splitter.split_documents(documents)
    
    for i, doc in enumerate(split_docs):
        # Generate stable ID based on chunk content and index to prevent duplicates
        chunk_id = hashlib.md5(f"{doc.page_content}_{i}".encode()).hexdigest()
        doc.metadata["chunk_id"] = chunk_id
        
    return split_docs