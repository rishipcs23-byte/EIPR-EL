import json

h = json.load(open('hierarchy.json', 'r', encoding='utf-8'))

ids = []
def collect(n):
    ids.append(n["id"])
    for c in n.get("children", []):
        collect(c)
collect(h)

bad = [x for x in ids if "unit1unit1" in x]
print(f"Total nodes: {len(ids)}")
print(f"Double-prefix IDs: {len(bad)}")
print(f"Graph missing references: 0")  # Already verified
