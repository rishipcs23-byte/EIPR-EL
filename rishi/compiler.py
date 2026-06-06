import json
import re
import sys
import os

# Set output encoding to UTF-8 for console logging
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def parse_document(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        raw_lines = [line.rstrip('\r\n') for line in f]

    # Level 2 Topic titles
    topics_list = {
        "Introduction",
        "3.The 4 types of entrepreneurs",
        "10 of the Most Common Entrepreneurship Myths:",
        "Entrepreneurial Development Models",
        "6.Problems Faced by Entrepreneurs:",
        "Capacity Building for Entrepreneurship:",
        "Entrepreneurship in the new age:",
        "Here are 7 examples of entrepreneurs who brought change and shaped the world according to their vision. ",
        "E-cells on Campus",
        "E-CELL ",
        "Common Characteristics of Successful Entrepreneurs:",
        "Different types of Entrepreneurial styles",
        "Entrepreneurship in the new age :",
        "Getting to know your Business:",
        "Understanding your business's ecosystem and environment is essential for successful entrepreneurship in today's interconnected world. Here's how you can delve into this aspect:",
        "it’s Eco-system and Environment ",
        "Passion and values are fundamental drivers of entrepreneurship, shaping the vision, culture, and actions of businesses. Here's how they influence entrepreneurship:",
        "Building and growing Family businesses",
        "Challenges are inevitable in any business, and family businesses face a unique set of challenges due to the intertwining of family dynamics with business operations. Here are some common challenges and suggested management approaches for family businesses:",
        "Role of Entrepreneurship in Economic Development",
        "2. Emerging Trends in Entrepreneurship",
        "3. Entrepreneur and Entrepreneurship",
        "4. Characteristics of an Entrepreneur",
        "5. Myths About Entrepreneurship",
        "6. Entrepreneur vs. Intrapreneur",
        "7. Role of Entrepreneurial Teams"
    }

    # Helper function to generate stable IDs
    def make_id(*parts):
        clean_parts = []
        for part in parts:
            p = part.lower().strip()
            # Remove numbering prefix like 1., a., etc.
            p = re.sub(r'^\s*\d+\s*\.\s*', '', p)
            p = re.sub(r'^\s*[a-g]\s*\.\s*', '', p)
            p = re.sub(r'^\s*●\s*', '', p)
            # Remove punctuation and special characters
            p = re.sub(r'[^\w\s-]', '', p)
            # Replace spaces with underscores
            p = re.sub(r'[\s_]+', '_', p)
            p = p.strip('_')
            if p == "unit_1":
                p = "unit1"
            if p:
                clean_parts.append(p)
        return '.'.join(clean_parts)

    nodes = []
    # Node schemas:
    # { "id": "", "title": "", "node_type": "", "path": [], "children": [], "content": [], "metadata": {} }
    
    # We will build a flat registry first and establish relationships,
    # and also build the nested tree.
    
    # Stack tracks active nodes: [unit_node, topic_node, subtopic_node, concept_node]
    stack = []
    
    # Store chunk map
    paragraph_chunks = []

    # To split line 185 (E-CELL activities)
    def split_ecell_activities(line, parent_path, idx):
        # Line 185 has:
        # "The Entrepreneurship Summit The Entrepreneurship Summit is... amongst others Freelancer, Intern and Co-Founders Platform (FInCoF) The Freelancers... world. Panel Discussions Panel... take place. Startup Expo Startup expo... enterprises. "
        sub_activities = [
            ("The Entrepreneurship Summit", "The Entrepreneurship Summit ", "Freelancer, Intern and Co-Founders Platform (FInCoF)"),
            ("Freelancer, Intern and Co-Founders Platform (FInCoF)", "Freelancer, Intern and Co-Founders Platform (FInCoF) ", "Panel Discussions"),
            ("Panel Discussions", "Panel Discussions ", "Startup Expo"),
            ("Startup Expo", "Startup Expo ", None)
        ]
        
        # We find their substring positions
        parsed_nodes = []
        for title, start_marker, next_marker in sub_activities:
            start_idx = line.find(start_marker)
            if start_idx == -1:
                # Fallback if text format slightly changed
                continue
            
            if next_marker:
                end_idx = line.find(next_marker)
                part_text = line[start_idx:end_idx]
            else:
                part_text = line[start_idx:]
                
            node_id = make_id(parent_path[-1], title)
            # Add parent prefix
            full_id = f"unit1.ecell_iitb.{node_id}"
            
            node_path = parent_path + [title]
            node_obj = {
                "id": full_id,
                "title": title,
                "node_type": "activity",
                "path": node_path,
                "children": [],
                "content": [part_text],
                "metadata": {}
            }
            parsed_nodes.append((node_obj, part_text))
        return parsed_nodes

    # Helper function to detect header type, level, and clean title
    def detect_heading(line, idx, current_topic_title):
        stripped = line.strip()
        if not stripped:
            return None
            
        # 1. UNIT
        if stripped.upper() == "UNIT 1":
            return {"node_type": "unit", "level": 1, "title": "UNIT 1"}
            
        # 2. Topic
        if stripped in topics_list or line in topics_list:
            # Clean title
            title = stripped
            if title.endswith(':'):
                title = title[:-1]
            title = re.sub(r'^\s*\d+\s*\.\s*', '', title)
            title = re.sub(r'^it’s\s+', '', title, flags=re.I)
            title = title.strip()
            return {"node_type": "topic", "level": 2, "title": title}
            
        # 3. Subtopics / Concepts with specific patterns
        # Subtopic: What is The Importance of Entrepreneurship?
        if stripped == "What is The Importance of Entrepreneurship?":
            return {"node_type": "subtopic", "level": 3, "title": "What is The Importance of Entrepreneurship?"}
            
        # Subtopic: Difference Between Management And Entrepreneurship (List)
        if stripped == "Difference Between Management And Entrepreneurship (List)":
            return {"node_type": "subtopic", "level": 3, "title": "Difference Between Management And Entrepreneurship (List)"}

        # Subtopic: What are the qualities of a successful entrepreneur?
        if stripped == "What are the qualities of a successful entrepreneur?":
            return {"node_type": "subtopic", "level": 3, "title": "What are the qualities of a successful entrepreneur?"}
            
        # Concepts under Importance of Entrepreneurship:
        importance_concepts = {
            "Creation of job opportunities",
            "Creation of new businesses",
            "Innovation",
            "Leads to better standards of living",
            "Supports research and development",
            "Promotes community development",
            "Leads to increased productivity",
            "Creation of national wealth",
            "Contributes to social welfare"
        }
        if stripped in importance_concepts:
            return {"node_type": "concept", "level": 4, "title": stripped}
            
        # Concepts under Types of Entrepreneurs
        if current_topic_title == "3.The 4 types of entrepreneurs":
            m = re.match(r'^(\d+)\.\s+(The\s+[A-Za-z ]+)\s*$', stripped)
            if m:
                return {"node_type": "concept", "level": 3, "title": m.group(2).strip()}
                
        # Concepts under Qualities of successful entrepreneur
        if current_topic_title == "What are the qualities of a successful entrepreneur?" or (stack and stack[-1]['title'] == "What are the qualities of a successful entrepreneur?"):
            m = re.match(r'^(\d+)\.\s+([A-Za-z ]+)\s*$', stripped)
            if m:
                # Ensure it's not a bullet point or long paragraph
                title_text = m.group(2).strip()
                if len(title_text) < 40:
                    return {"node_type": "concept", "level": 4, "title": title_text}
                    
        # Concepts under Myths
        if current_topic_title == "10 of the Most Common Entrepreneurship Myths:":
            m = re.match(r'^\s*(\d+)\.\s+([A-Za-z ,“”’\(\)\.\!]+)$', stripped)
            if m:
                # These are myth concept nodes
                title_text = m.group(2).strip()
                if len(title_text) < 60:
                    return {"node_type": "concept", "level": 3, "title": f"Myth {m.group(1)}: {title_text}"}
                    
        # Concepts under Development Models
        if current_topic_title == "Entrepreneurial Development Models":
            dev_models = {
                "Large business entrepreneurship",
                "Small business entrepreneurship",
                "Social entrepreneurship",
                "Scalable startup entrepreneurship",
                "Innovation Entrepreneurship"
            }
            if stripped in dev_models:
                return {"node_type": "concept", "level": 3, "title": stripped}
                
        # Concepts under Problems Faced
        if current_topic_title == "6.Problems Faced by Entrepreneurs:":
            m = re.match(r'^(\d+)\.\s*([A-Za-z ]+):', stripped)
            if m:
                return {"node_type": "concept", "level": 3, "title": m.group(2).strip()}
                
        # Concepts under Capacity Building
        if current_topic_title == "Capacity Building for Entrepreneurship:":
            m = re.match(r'^(\d+)\.\s*([A-Za-z &,/]+):', stripped)
            if m:
                return {"node_type": "concept", "level": 3, "title": m.group(2).strip()}
                
        # Concepts under Entrepreneurship in the New Age (1 or 2)
        if current_topic_title in ("Entrepreneurship in the new age:", "Entrepreneurship in the new age :"):
            m = re.match(r'^(\d+)\.\s*([A-Za-z &,-/]+):', stripped)
            if m:
                return {"node_type": "concept", "level": 3, "title": m.group(2).strip()}
                
        # Subtopics under Getting to know your Business
        if current_topic_title == "Getting to know your Business:":
            m = re.match(r'^(\d+)\.\s*([A-Za-z &,-/]+):', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}
                
        # Subtopics under Ecosystem
        if current_topic_title in (
            "Understanding your business's ecosystem and environment is essential for successful entrepreneurship in today's interconnected world. Here's how you can delve into this aspect:",
            "it’s Eco-system and Environment "
        ):
            m = re.match(r'^(\d+)\.\s*([A-Za-z &,-/]+):', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}
            # Special case for overview line:
            if stripped.startswith("Understanding your business's ecosystem"):
                return {"node_type": "concept", "level": 3, "title": "Overview"}
                
        # Subtopics under Passion and Values
        if current_topic_title == "Passion and values are fundamental drivers of entrepreneurship, shaping the vision, culture, and actions of businesses. Here's how they influence entrepreneurship:":
            m = re.match(r'^(\d+)\.\s*([A-Za-z &,-/]+):', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}
                
        # Subtopics and concepts under Family Business
        if current_topic_title == "Building and growing Family businesses":
            if stripped.startswith("Building and growing a family business"):
                return {"node_type": "concept", "level": 3, "title": "Overview"}
            m = re.match(r'^(\d+)\.\s*([A-Za-z &,-/]+):', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}
                
        # Subtopics under Challenges (Family Business)
        if current_topic_title == "Challenges are inevitable in any business, and family businesses face a unique set of challenges due to the intertwining of family dynamics with business operations. Here are some common challenges and suggested management approaches for family businesses:":
            m = re.match(r'^(\d+)\.\s*([A-Za-z &,-/]+):', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}
                
        # Subtopics and concepts under Economic Development
        if current_topic_title == "Role of Entrepreneurship in Economic Development":
            if stripped.startswith("Entrepreneurship contributes significantly"):
                return {"node_type": "concept", "level": 3, "title": "Overview"}
            m = re.match(r'^([a-f])\.\s+([A-Za-z &,-/]+)$', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}

        # Subtopics under Emerging Trends
        if current_topic_title == "2. Emerging Trends in Entrepreneurship":
            m = re.match(r'^([a-f])\.\s+([A-Za-z &,-/]+)$', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}

        # Subtopics under Entrepreneur and Entrepreneurship
        if current_topic_title == "3. Entrepreneur and Entrepreneurship":
            m = re.match(r'^([a-c])\.\s+([A-Za-z &,-/ ]+)$', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}

        # Subtopics under Characteristics
        if current_topic_title == "4. Characteristics of an Entrepreneur":
            m = re.match(r'^([a-c])\.\s+([A-Za-z &,-/ ]+)$', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}

        # Subtopics under Myths (Part 5)
        if current_topic_title == "5. Myths About Entrepreneurship":
            m = re.match(r'^([a-e])\.\s+([A-Za-z &,-/ ]+)$', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}

        # Subtopics under Role of Teams
        if current_topic_title == "7. Role of Entrepreneurial Teams":
            m = re.match(r'^([a-d])\.\s+([A-Za-z &,-/ ]+)$', stripped)
            if m:
                return {"node_type": "subtopic", "level": 3, "title": m.group(2).strip()}

        # Concepts under Common Characteristics
        if current_topic_title == "Common Characteristics of Successful Entrepreneurs:":
            m = re.match(r'^(\d+)\.\s*([A-Za-z &,-/]+)-', stripped)
            if m:
                return {"node_type": "concept", "level": 3, "title": m.group(2).strip()}
                
        # Concepts under Entrepreneurial styles
        if current_topic_title == "Different types of Entrepreneurial styles":
            # Autocratic etc.
            m = re.match(r'^(\d+)\.\s*([A-Za-z &,-/]+)', stripped)
            if m:
                # Ensure it's short
                title_text = m.group(2).strip()
                if len(title_text) < 30:
                    return {"node_type": "concept", "level": 3, "title": title_text}

        # Examples under Examples of Entrepreneurs topic
        if current_topic_title == "Here are 7 examples of entrepreneurs who brought change and shaped the world according to their vision. ":
            examples = {
                "ALEXANDER GRAHAM BELL", "STEVE JOBS", "WALT DISNEY",
                "BILL GATES", "JEFF BEZOS", "LARRY PAGE", "MARK ZUCKERBERG"
            }
            # Look at start of line
            for name in examples:
                if stripped.startswith(name) or name in stripped:
                    return {"node_type": "example", "level": 3, "title": name.title()}

        return None

    # We do a linear pass
    current_topic_title = ""
    
    # Registry to store flat nodes
    flat_registry = {}
    
    # Store list of root nodes (usually just unit1)
    roots = []

    for idx, line in enumerate(raw_lines):
        heading_info = detect_heading(line, idx, current_topic_title)
        
        if heading_info:
            level = heading_info["level"]
            node_type = heading_info["node_type"]
            title = heading_info["title"]
            
            # Pop stack to match level
            # Level 1 goes to index 0, Level 2 to index 1, etc.
            while len(stack) >= level:
                stack.pop()
                
            # Compute ID: parent_id + "." + slug(title)
            if level == 1:
                full_id = "unit1"
            elif stack:
                parent_id = stack[-1]["id"]
                full_id = f"{parent_id}.{make_id(title)}"
            else:
                full_id = f"unit1.{make_id(title)}"
                
            # If there's an ID collision, append a suffix
            orig_id = full_id
            counter = 1
            while full_id in flat_registry:
                full_id = f"{orig_id}_{counter}"
                counter += 1
                
            node_path = [node["title"] for node in stack] + [title]
            
            node_obj = {
                "id": full_id,
                "title": title,
                "node_type": node_type,
                "path": node_path,
                "children": [],
                "content": [line], # include the heading line itself in the content
                "metadata": {}
            }
            
            flat_registry[full_id] = node_obj
            
            # Establish parent-child link
            if len(stack) > 0:
                parent = stack[-1]
                parent["children"].append(node_obj)
            else:
                roots.append(node_obj)
                
            stack.append(node_obj)
            
            # Record chunk map
            paragraph_chunks.append({
                "index": idx,
                "text": line,
                "node_id": full_id
            })
            
            if node_type == "topic":
                current_topic_title = line.strip()
                
        else:
            # It's a regular content line or empty line
            if stack:
                stack[-1]["content"].append(line)
                paragraph_chunks.append({
                    "index": idx,
                    "text": line,
                    "node_id": stack[-1]["id"]
                })
            else:
                # No active node? (Should not happen since UNIT 1 is first line)
                # We create a dummy unit
                dummy = {
                    "id": "unit1",
                    "title": "UNIT 1",
                    "node_type": "unit",
                    "path": ["UNIT 1"],
                    "children": [],
                    "content": [line],
                    "metadata": {}
                }
                flat_registry["unit1"] = dummy
                roots.append(dummy)
                stack.append(dummy)
                paragraph_chunks.append({
                    "index": idx,
                    "text": line,
                    "node_id": "unit1"
                })

    # Activities line 4:
    # Let's check if there's any other splitting needed. No, everything else is clean.
    
    # Calculate metadata for every node recursively
    def calc_metadata(node):
        child_count = len(node["children"])
        expandable = child_count > 0
        
        # Check if content_available: has any non-empty text
        content_available = any(c.strip() for c in node["content"])
        
        node["metadata"] = {
            "expandable": expandable,
            "content_available": content_available,
            "child_count": child_count
        }
        
        # Recursively do it for children
        for child in node["children"]:
            calc_metadata(child)
            
    for root in roots:
        calc_metadata(root)

    return roots, flat_registry, paragraph_chunks, raw_lines

if __name__ == '__main__':
    roots, flat_registry, paragraph_chunks, raw_lines = parse_document('Unit-1')
    
    # Test reconstruction
    reconstructed_lines = []
    
    # Simple recursive function to collect content from tree
    def collect_content(node, collected):
        # To avoid duplication, we check if we split E-CELL activities.
        # If this is E-CELL (unit1.ecell_iitb), it has children.
        # Let's see: if we just concatenate all contents, does it match?
        # Let's traverse in pre-order:
        collected.extend(node["content"])
        for child in node["children"]:
            collect_content(child, collected)
            
    collected_lines = []
    for root in roots:
        collect_content(root, collected_lines)
        
    print(f"Original parsed lines: {len(raw_lines)}, Reconstructed lines: {len(collected_lines)}")
    
    if len(raw_lines) != len(collected_lines):
        print(f"Length mismatch! Original: {len(raw_lines)}, Reconstructed: {len(collected_lines)}")
        
    mismatches = 0
    for i in range(max(len(raw_lines), len(collected_lines))):
        o = raw_lines[i] if i < len(raw_lines) else None
        r = collected_lines[i] if i < len(collected_lines) else None
        if o != r:
            print(f"Line {i+1} diff:")
            print(f"  Orig: {repr(o)}")
            print(f"  Recon:{repr(r)}")
            mismatches += 1
            if mismatches >= 5:
                print("Too many mismatches, stopping...")
                break
                
    if mismatches == 0 and len(raw_lines) == len(collected_lines):
        print("Success! Lossless reconstruction verified 100%.")
        
        # Save hierarchy.json
        # The schema requires list of children, so we clean children to only include matching keys/references if needed, 
        # but the prompt schema has children as list of nested nodes: "children": []
        # Let's save the roots[0] object.
        with open('hierarchy.json', 'w', encoding='utf-8') as f:
            json.dump(roots[0], f, indent=2, ensure_ascii=False)
        print("Saved hierarchy.json")
            
        # Build graph.json
        concepts = []
        relationships = []
        
        # Traverse registry to build concepts list and part_of relationships
        for node_id, node in flat_registry.items():
            concepts.append({
                "id": node_id,
                "title": node["title"],
                "node_type": node["node_type"]
            })
            
            # Parent-child represents part_of
            for child in node["children"]:
                relationships.append({
                    "from": child["id"],
                    "to": node_id,
                    "type": "part_of"
                })
                
        # Add explicit semantic relationships implied by the material
        # Helper: find node IDs by title substring
        def find_ids_by_title(title_substr, node_type=None):
            results = []
            for nid, n in flat_registry.items():
                if title_substr.lower() in n["title"].lower():
                    if node_type is None or n["node_type"] == node_type:
                        results.append(nid)
            return results
        
        def find_id_by_title(title_substr, node_type=None):
            ids = find_ids_by_title(title_substr, node_type)
            return ids[0] if ids else None

        # 1. Importance of Entrepreneurship causes/supports outcomes
        importance_concepts = [
            "Creation of job opportunities", "Creation of new businesses",
            "Innovation", "Leads to better standards of living",
            "Supports research and development", "Promotes community development",
            "Leads to increased productivity", "Creation of national wealth",
            "Contributes to social welfare"
        ]
        for title in importance_concepts:
            cid = find_id_by_title(title, "concept")
            if cid:
                relationships.append({
                    "from": "unit1",
                    "to": cid,
                    "type": "causes"
                })
                
        # 2. Capacity building supports Entrepreneurship
        capacity_concepts = [
            "Education and Training", "Access to Finance",
            "Mentorship Programs", "Networking Opportunities",
            "Incubators and Accelerators", "Government Policies",
            "Technology Adoption"
        ]
        for title in capacity_concepts:
            cid = find_id_by_title(title, "concept")
            if cid:
                relationships.append({
                    "from": cid,
                    "to": "unit1",
                    "type": "supports"
                })
                
        # 3. Examples are example_of
        example_names = [
            "Alexander Graham Bell", "Steve Jobs", "Walt Disney",
            "Bill Gates", "Jeff Bezos", "Larry Page", "Mark Zuckerberg"
        ]
        intro_id = find_id_by_title("Introduction", "topic")
        for name in example_names:
            eid = find_id_by_title(name, "example")
            if eid and intro_id:
                relationships.append({
                    "from": eid,
                    "to": intro_id,
                    "type": "example_of"
                })
                
        # 4. Entrepreneur vs Intrapreneur related_to
        evi_id = find_id_by_title("Entrepreneur vs", "topic")
        eae_id = find_id_by_title("Entrepreneur and Entrepreneurship", "topic")
        if evi_id and eae_id:
            relationships.append({
                "from": evi_id,
                "to": eae_id,
                "type": "related_to"
            })
            
        # Extra semantic concepts and example relationships from content text
        extra_concepts = [
            {"id": "apple", "title": "Apple", "node_type": "example"},
            {"id": "samsung", "title": "Samsung", "node_type": "example"},
            {"id": "facebook", "title": "Facebook", "node_type": "example"},
            {"id": "tesla", "title": "Tesla", "node_type": "example"},
            {"id": "iphones", "title": "iPhones", "node_type": "example"}
        ]
        concepts.extend(extra_concepts)
        
        large_biz_id = find_id_by_title("Large business entrepreneurship", "concept")
        scalable_id = find_id_by_title("Scalable startup entrepreneurship", "concept")
        innovation_id = find_id_by_title("Innovation Entrepreneurship", "concept")
        
        if large_biz_id:
            relationships.append({"from": "apple", "to": large_biz_id, "type": "example_of"})
            relationships.append({"from": "samsung", "to": large_biz_id, "type": "example_of"})
        if scalable_id:
            relationships.append({"from": "facebook", "to": scalable_id, "type": "example_of"})
        if innovation_id:
            relationships.append({"from": "tesla", "to": innovation_id, "type": "example_of"})
            relationships.append({"from": "iphones", "to": innovation_id, "type": "example_of"})
        
        graph_data = {
            "concepts": concepts,
            "relationships": relationships
        }
        with open('graph.json', 'w', encoding='utf-8') as f:
            json.dump(graph_data, f, indent=2, ensure_ascii=False)
        print("Saved graph.json")
            
        # Save chunk_map.json
        chunk_map_data = {str(item["index"]): item["node_id"] for item in paragraph_chunks}
        with open('chunk_map.json', 'w', encoding='utf-8') as f:
            json.dump(chunk_map_data, f, indent=2, ensure_ascii=False)
        print("Saved chunk_map.json")
    else:
        print("Verification failed! Differences found.")
