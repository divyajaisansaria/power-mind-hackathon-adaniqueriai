import os
from langchain_chroma import Chroma
from app.core.embeddings import get_embeddings_model


class VectorStore:
    def __init__(self, path="vector_store/chroma_db"):
        # Ensure directory exists
        os.makedirs(path, exist_ok=True)
        self.path = path

        # Initialize Chroma DB
        self.db = Chroma(
            collection_name="rag_collection",
            embedding_function=get_embeddings_model(),
            persist_directory=path,
            collection_metadata={"hnsw:space": "l2"}  # L2 distance
        )

    def add_documents(self, documents):
        """
        Add or update documents in vector store (UPSERT behavior)
        """

        # ✅ Stable + deterministic IDs (prevents duplicates, allows overwrite)
        ids = [
            f"{doc.metadata.get('page', 0)}_{doc.metadata.get('chunk_id', i)}"
            for i, doc in enumerate(documents)
        ]

        # LangChain's add_documents natively performs an upsert when given IDs
        self.db.add_documents(
            documents,
            ids=ids
        )

    def search(self, query, top_k=5):
        """
        Perform similarity search
        Returns: [(Document, score)]
        """
        return self.db.similarity_search_with_score(query, k=top_k)

    def reset(self):
        """Clear all documents from the collection for a fresh re-ingestion"""
        try:
            # Delete the existing collection and recreate it
            self.db.delete_collection()
            self.db = Chroma(
                collection_name="rag_collection",
                embedding_function=get_embeddings_model(),
                persist_directory=self.path,
                collection_metadata={"hnsw:space": "l2"}
            )
            print("   [RESET] Old vector store cleared.")
        except Exception as e:
            print(f"   [WARN] Could not reset vector store: {e}")

    def get_doc_count(self):
        """Return the number of documents in the store"""
        return self.db._collection.count()

    def check_file_exists(self, source_hash: str) -> bool:
        """Check if documents with this source_hash already exist"""
        try:
            results = self.db.get(where={"source_hash": source_hash}, limit=1)
            return len(results.get("ids", [])) > 0
        except Exception:
            return False