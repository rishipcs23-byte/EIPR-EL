import json
import os
import numpy as np
from sentence_transformers import SentenceTransformer

def flatten_tree(node, nodes_list):
    title = node.get("title", "")
    content_list = node.get("content", [])
    content_text = " ".join([c for c in content_list if isinstance(c, str)]) if content_list else ""
    emb_text = f"{title}. {content_text}".strip()
    
    nodes_list.append({
        "id": node.get("id"),
        "title": title,
        "node_type": node.get("node_type"),
        "emb_text": emb_text
    })
    
    for child in node.get("children", []):
        flatten_tree(child, nodes_list)

# Load hierarchy
h_path = "rishi/hierarchy.json"
if not os.path.exists(h_path):
    # Fallback to current directory
    h_path = "hierarchy.json"

with open(h_path, "r", encoding="utf-8") as f:
    hierarchy = json.load(f)

nodes_list = []
flatten_tree(hierarchy, nodes_list)

print(f"Total nodes to embed: {len(nodes_list)}")

# Compute embeddings
texts = [n["emb_text"] for n in nodes_list]
model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = model.encode(texts, show_progress_bar=True)

# Dimensionality reduction (PCA)
from sklearn.decomposition import PCA
reducer = PCA(n_components=3, random_state=42)
coords_3d = reducer.fit_transform(embeddings)

# Scale coordinates to fit nicely in our 3D space scene [-350, 350]
min_coords = np.min(coords_3d, axis=0)
max_coords = np.max(coords_3d, axis=0)
ranges = max_coords - min_coords
# Avoid division by zero
ranges[ranges == 0] = 1.0

scaled_coords = (coords_3d - min_coords) / ranges * 700.0 - 350.0

# Create map
coord_map = {}
for i, n in enumerate(nodes_list):
    x, y, z = float(scaled_coords[i][0]), float(scaled_coords[i][1]), float(scaled_coords[i][2])
    coord_map[n["id"]] = [x, y, z]

# Save
out_path = "rishi/vector_coords.json"
if not os.path.exists("rishi"):
    out_path = "vector_coords.json"

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(coord_map, f, indent=2)

print(f"Saved coordinates mapping to {out_path}")
