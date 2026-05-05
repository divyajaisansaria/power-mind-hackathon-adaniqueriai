import json
with open('data/processed/all_documents.json', encoding='utf-8') as f:
    data = json.load(f)
matches = [f"Page {d['metadata']['page']} (Chunk {d['metadata']['chunk_id']}):\n{d['content']}\n---" for d in data if 'Data Center' in d['content']]
open('chunk_dc.txt', 'w', encoding='utf-8').write('\n'.join(matches))
