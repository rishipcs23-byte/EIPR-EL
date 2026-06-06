import json
import re
import sys
import os

# Set output encoding to UTF-8 for console logging
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Heading registries for all units
UNIT_CONFIGS = {
    1: {
        "title": "UNIT 1",
        "headings": {
            2: {
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
            },
            3: {
                "What is The Importance of Entrepreneurship?",
                "Difference Between Management And Entrepreneurship (List)",
                "What are the qualities of a successful entrepreneur?",
                "Here are some skills you need to become a successful entrepreneur:"
            },
            4: {
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
        }
    },
    2: {
        "title": "UNIT 2",
        "headings": {
            2: {
                "Identifying Market Opportunities and Trends",
                "Integration of Engineering Principles in Ideation Process",
                "Cross-Disciplinary Collaboration for Technological innovation",
                "Assessing Market Feasibility and Demand for Entrepreneurial Opportunity Evaluation",
                "Evaluating Technical Feasibility: Prototype Development and Proof of Concept",
                "Financial Feasibility Analysis: Cost Estimation, Revenue Projection, and Break-Even Analysis",
                "Elements of a Business Plan",
                "Business Plan Overview",
                "Strategic Planning",
                "Porter's Generic Strategies",
                "Growth Strategies",
                "Writing a Business Plan on given templates",
                "Developing Business Models and Prototypes Based on Generated Ideas"
            },
            3: {
                "i)Market potential of business opportunity",
                "ii) Return on investment of business opportunity",
                "Stages of an Ideation Process",
                "Problem Identification",
                "Idea Generation",
                "Idea Evaluation",
                "Implementation Planning",
                "Successful Ideation Process",
                "1.Preliminary Analysis",
                "Preliminary Analysis in Market Feasibility Studies",
                "i. Objectives of Preliminary Analysis",
                "ii. Key Components of Preliminary Analysis",
                "Stakeholder Engagement",
                "Market Demand Assessment",
                "Documentation Review",
                "iii. Questions to Guide Preliminary Analysis",
                "iv. Initial Decision-Making",
                "v. Importance of Preliminary Analysis",
                "2. Market Research",
                "Importance of Market Research",
                "Types of Market Research",
                "Steps in Conducting Market Research",
                "3. Financial Feasibility",
                "Financial Feasibility Analysis",
                "Key Components of Financial Feasibility Analysis",
                "Initial Investment Assessment",
                "Operating Costs Evaluation",
                "Revenue Projections",
                "Cash Flow Analysis",
                "Profitability Analysis",
                "Break-even Analysis",
                "Risk Assessment",
                "Funding Options",
                "Steps in Conducting Financial Feasibility Analysis",
                "4. Risk Assessment",
                "5. Scalability and Growth Potential",
                "6. Continuous Monitoring and Adaptation",
                "Proof of Concept (PoC)",
                "Prototype Development",
                "Best Practices in Prototype Development",
                "Cost Estimation",
                "Definition and Importance",
                "Components of Cost Estimation",
                "Market",
                "Market Share Projection",
                "Positioning Your Business",
                "Pricing",
                "Distribution",
                "Promotion Plan",
                "Sales Potential",
                "Competitive Analysis",
                "Design and Development Plan",
                "Scheduling and Costs",
                "Development Budget",
                "Personnel",
                "Operations & Management",
                "Organizational Structure",
                "Overhead Expenses",
                "Capital Requirements Table",
                "Cost of Goods Table",
                "Financial Components",
                "Income Statement",
                "Cash Flow Statement",
                "The Balance Sheet",
                "Assets",
                "Liabilities",
                "Equity",
                "1. Assets",
                "2. Liabilities",
                "3. Equity",
                "1. Vision",
                "2. Mission",
                "3. Goals",
                "4. Objectives",
                "5. SWOC Analysis (Strengths, Weaknesses, Opportunities, and Challenges)",
                "How SWOC Analysis Helps:",
                "Differentiation",
                "Cost Leadership",
                "Focus",
                "1. Organic",
                "2.Mergers and Acquisitions",
                "3.Strategic Alliances",
                "1. Title Page",
                "2. Executive Summary",
                "3. Industry Overview",
                "4. Market Analysis and Competition",
                "5. Sales and Marketing Plan",
                "6. Management Plan",
                "7. Operating Plan",
                "8. Financial Plan",
                "9. Appendices and Exhibits",
                "1. Conduct Market Research & Analysis",
                "2. Define Your Value Proposition",
                "3. Choose Your Revenue Model",
                "‍4. Design Your Distribution Channels",
                "5. Build Strategic Partnerships",
                "6. Foster Innovation and Adaptability"
            }
        }
    },
    3: {
        "title": "UNIT III",
        "headings": {
            2: {
                "ENTREPRENEURIAL MARKETING AND SALES",
                "Overview",
                "How the 4Ps Work Together",
                "Case Studies on 4P`s",
                "Branding and Product Development Strategies",
                "Unique Value Proposition (UVP)",
                "Digital Marketing:",
                "Case Study of Indian Companies Using Digital Marketing",
                "Entrepreneurial Finance and Resource Management",
                "SOURCES OF FINANCING",
                "FEW CASE STUDIES",
                "HUMAN RESOURCE MANAGEMENT (HRM)",
                "Human Resource Management (HRM) Case Studies",
                "FINANCIAL MANAGEMENT",
                "Budgeting",
                "CAPITAL BUDGETING",
                "CASH FLOW MANAGEMENT",
                "FINANCIAL STATEMENTS ANALYSIS",
                "Risk Management and Insurance",
                "1. Legal and Ethical Issues in Entrepreneurship",
                "2. Intellectual Property Rights (IPR)",
                "3. Contracts",
                "4. Corporate Governance Activities",
                "5. Case Studies and Practical Applications"
            },
            3: {
                "1. Product",
                "a.	 Introduction Stage",
                "Product Lifecycle (PLC)",
                "b.	Growth Stage",
                "c.	Maturity Stage",
                "d.	Decline Stage",
                "2. Price",
                "•	Pricing Strategies:",
                "3. Place (Distribution)",
                "•	Distribution Channels:",
                "4. Promotion",
                "•	Promotional Tools:",
                "•	Promotional Strategy:",
                "1. Product: Apple iPhone",
                "2. Price: Walmart",
                "3. Place: Starbucks",
                "4. Promotion: Coca-Cola",
                "1. Product: boAt",
                "2. Price: Jio",
                "3. Place: Flipkart",
                "4. Promotion: Zomato",
                "1. Introduction to STP",
                "2. Market Segmentation",
                "3. Targeting",
                "Positioning",
                "Differentiation Strategies",
                "Positioning Maps",
                "5. Integration of STP into Marketing Strategy",
                "Case Study:",
                "1. Starbucks",
                "2. Maruti Suzuki India Ltd.",
                "3. Hindustan Unilever Limited (HUL)",
                "Importance of STP in Effective Marketing",
                "1. Branding: Crafting a Unique Market Identity",
                "2. Product Development: Bringing Ideas to Market",
                "3. Integrating Branding and Product Development Strategies",
                "1. Understanding the Components of a UVP",
                "2. Steps to Crafting a UVP",
                "3. Common UVP Formats",
                "Examples of Effective UVPs",
                "1. Amul: Leveraging Social Media for Brand Engagement",
                "2. Zomato: Creative Content and Meme Marketing",
                "3. Nykaa: Content-Driven Digital Strategy and Influencer Marketing",
                "4. Flipkart: Data-Driven Marketing and Customer-Centric Campaigns",
                "5. Swiggy: Personalization and Customer Engagement on Digital Platforms",
                "6. Cadbury Dairy Milk: Hyperlocal and Personalized Digital Campaigns",
                "1. Equity Financing",
                "2. Debt Financing",
                "3. Venture Capital (VC)",
                "4. Angel Investors",
                "5. Crowdfunding",
                "1. Ola Cabs: Venture Capital (VC) Funding",
                "2. Zomato: Angel Investors and Venture Capital",
                "3. Bira 91: Equity Financing",
                "4. Dream11: Private Equity and Venture Capital",
                "5. Ketto: Crowdfunding",
                "1. Recruitment in Entrepreneurship",
                "2. Training in Entrepreneurship",
                "3. Performance Evaluation in Entrepreneurship",
                "4. Legal and Ethical Issues in Entrepreneurship",
                "1. Zappos: Building a Unique Corporate Culture",
                "2. Google: People Operations for Innovation",
                "3. Southwest Airlines: Employee-Centered HRM",
                "4. Toyota: The Toyota Way and HRM",
                "5. IKEA: Employee Motivation and Development",
                "Objectives of Financial Management",
                "Key Functions of Financial Management",
                "Principles of Financial Management",
                "Importance of Financial Management",
                "Financial Management Tools and Techniques",
                "Challenges in Financial Management",
                "Objectives of Budgeting",
                "Types of Budgeting",
                "Case Study of the Indian Entrepreneur and the cunning NPV",
                "Steps in the Budgeting Process",
                "Advantages of Budgeting",
                "Disadvantages of Budgeting",
                "Budgeting Techniques and Tools",
                "Importance of Budgeting",
                "Importance of Cash Flow Management",
                "Types of Cash Flow",
                "Cash Flow Management Techniques",
                "Cash Flow Management Strategies",
                "Challenges in Cash Flow Management",
                "Cash Flow Management in Personal Finance",
                "Objectives of Financial Statement Analysis",
                "Key Financial Statements",
                "Techniques of Financial Statement Analysis",
                "Steps in Financial Statement Analysis",
                "Limitations of Financial Statement Analysis",
                "Key Concepts in Risk Management and Insurance",
                "Goals of Risk Management",
                "Steps in Risk Management",
                "Risk Management Techniques",
                "Case study of Risk Management",
                "CAMELS IN NEW ZEALAND",
                "Types of Insurance as Risk Management Tools",
                "Risk Management in Insurance",
                "Importance of Insurance in Risk Management",
                "Challenges in Risk Management and Insurance",
                "Role of Technology in Risk Management and Insurance",
                "Case Study 1: Intellectual Property Rights in a Tech Startup",
                "Case Study 2: Contractual Dispute in a Freelance Design Business",
                "Practical Applications"
            }
        }
    },
    4: {
        "title": "UNIT 4",
        "headings": {
            2: {
                "INTRODUCTION & PATENTS",
                "What is Intellectual Property?",
                "Intellectual Property Rights",
                "Types of Intellectual Property Rights",
                "Salient features of patent",
                "PATENTABLE INVENTIONS",
                "Inventions those are not patentable",
                "PROCEDURE FOR OBTAINING PATENT",
                "Filing a Patent Application",
                "Specifications",
                "Claims",
                "Publication of the Application",
                "Examination of the Application",
                "Acceptance and Advertisement of Complete Specifications",
                "OPPOSITION TO THE GRANT OF PATENT",
                "GRANT AND SEALING OF PATENT",
                "Rights of a Patentee",
                "JOINT-INVENTORS/CO-OWNERS OF PATENT RIGHTS",
                "LIMITATIONS ON PATENTEE’S RIGHTS",
                "Compulsory Licences",
                "Inventions for Defence Purposes",
                "Revocation of Patents for Non-working",
                "TRANSFER OF PATENT RIGHTS",
                "REGISTER OF PATENTS",
                "BIODIVERSITY",
                "TRADE SECRETS"
            },
            3: {
                "Copyrights:",
                "Trademarks:",
                "Patents:",
                "Industrial Design Rights:",
                "Trade Secrets:",
                "Invention must be ‘new’",
                "Invention involves an ‘inventive step’",
                "Invention must have ‘industrial application’",
                "Who can apply for Patent?",
                "Right to Exploit the Patent",
                "Right to Assign and Licence",
                "Right to Surrender",
                "Right to Sue for Infringement",
                "Use for the Purposes of Government",
                "Acquisition of Patents and Inventions by Central Government",
                "Assignment",
                "Licence",
                "Operation of Law",
                "Traditional Knowledge, IPR and Biodiversity",
                "Why to protect a trade secret?",
                "Trade Secret versus Patent",
                "Tools to protect a trade secret",
                "Case studies"
            }
        }
    },
    5: {
        "title": "UNIT 5",
        "headings": {
            2: {
                "INDUSTRIAL DESIGNS",
                "Introduction",
                "What is an Industrial Design?",
                "Creative Designs in Business",
                "Why protect industrial designs?",
                "Procedure for obtaining Design Protection",
                "Revocation Infringement and Remedies of Industrial Designs",
                "Case Studies",
                "COPYRIGHT",
                "WHAT IS COPYRIGHT?",
                "COPYRIGHT IN INDIA",
                "PROTECTION OF RELATED RIGHTS",
                "Are ideas, methods or concepts protected by copyright?",
                "How are rights related to copyright?",
                "COMPUTER SOFTWARE AND IPR",
                "AUTHORSHIP ISSUES IN WORKS USED OR MADE BY COMPUTER",
                "Patenting of computer software",
                "INTRODUCTION TO CYBER LAW",
                "Objectives of the Act",
                "Non-Applicability",
                "Scope or Extent of the ACT",
                "Intermediary liability",
                "Digital Signature",
                "Authentication of Electronic record",
                "Difference between Electronic Signature and Digital Signature:",
                "Information Technology Amendment Act, 2008",
                "Cybercrime",
                "History of Cyber Crime",
                "CATEGORIES OF CYBER CRIME:",
                "Types of Cyber Crime",
                "NEED FOR CYBER LAWS",
                "Cyber Laws in India",
                "Cybercrime and e-commerce",
                "REPORTING COUNTERFEIT ITEMS ON INDIAN E-COMMERCE SITES:",
                "PRACTICE AND PROCEDURE FOR RIGHTS HOLDERS",
                "ELECTRONIC EVIDENCE – CASE LAW",
                "CYBERSQUATTING IN INDIA: THE YAHOO!  CASE [YAHOO! INC. V. AKASH",
                "INDRP as a model for INDIA",
                "METATAGS’ AND TRADEMARKS:",
                "Data security, Confidentiality and Privacy",
                "International aspects of computer and online crime"
            },
            3: {
                "1. Research and Preliminary Assessment:",
                "2. Identify the Jurisdiction:",
                "3. Prepare Application Documents:",
                "4. File the Application:",
                "5. Examination:",
                "6. Publication:",
                "7. Opposition Period (if applicable):",
                "8. Registration:",
                "9. Maintenance and Renewal:",
                "10. Enforcement:",
                "1. Revocation:",
                "2. Infringement:",
                "3. Remedies:",
                "1. iPhone Design by Apple:",
                "2. Alessi Juicy Salif Citrus Juicer:",
                "3. Vespa Scooter:",
                "4. Swatch Watch:",
                "5. Oxo Good Grips Kitchen Tools:",
                "1. NATURE AND SCOPE.",
                "2. RIGHTS CONFERRED BY COPYRIGHT",
                "3. Copy right protection.",
                "When does Copyright Protection begin, and what is required?",
                "WHEN DOES COPYRIGHT PROTECTION END, OR EXPIRE?",
                "The Famous © Symbol",
                "Protection of computer software under copyright",
                "5. TRANSFER OF COPY RIGHTS.",
                "Difference between licensing and assignment of copyright –",
                "6. RIGHTS OF BROAD CASTING ORGANIZATIONS AND",
                "PERFORMERS RIGHTS",
                "BROADCASTER’S RIGHTS: AN INTRODUCTION",
                "Historical Setting",
                "Nature of Broadcast rights",
                "What is a broadcast?",
                "BROADCASTER’S RIGHT IN INDIA",
                "Statutory Ambit",
                "Judicial Dictum",
                "PERFORMERS’ RIGHTS",
                "7. EXCEPTIONS TO COPYRIGHT",
                "EXCEPTIONS TO INFRINGEMENT OF PERFORMER’S RIGHTS",
                "8. INFRINGEMENT OF COPY RIGHT WITH CASE STUDIES.",
                "SUPER CASSETTE INDUSTRIES LTD. Vs. BATHLA CASSETTE INDUSTRIES",
                "Information Technology Act",
                "Bayer Corporation Vs. Union of India 162(2009) DLT 371",
                "The Rice Patent",
                "The Government of India's response to the Patent"
            }
        }
    }
}

def make_id(unit_num, *parts):
    clean_parts = [f"unit{unit_num}"]
    for part in parts:
        p = part.lower().strip()
        # Remove numbering prefix like 1., a., etc.
        p = re.sub(r'^\s*\d+\s*[\.\)]\s*', '', p)
        p = re.sub(r'^\s*[a-g]\s*[\.\)]\s*', '', p)
        p = re.sub(r'^\s*●\s*', '', p)
        p = re.sub(r'^\s*•\s*', '', p)
        p = re.sub(r'^\s*\s*', '', p)
        # Remove punctuation and special characters
        p = re.sub(r'[^\w\s-]', '', p)
        # Replace spaces with underscores
        p = re.sub(r'[\s_]+', '_', p)
        p = p.strip('_')
        
        # Avoid repeat prefixes like unit2.unit2_identifying...
        if p == f"unit{unit_num}" or p == f"unit_{unit_num}":
            continue
            
        if p:
            clean_parts.append(p)
    return '.'.join(clean_parts)

def split_ecell_activities(line, parent_path, idx):
    sub_activities = [
        ("The Entrepreneurship Summit", "The Entrepreneurship Summit ", "Freelancer, Intern and Co-Founders Platform (FInCoF)"),
        ("Freelancer, Intern and Co-Founders Platform (FInCoF)", "Freelancer, Intern and Co-Founders Platform (FInCoF) ", "Panel Discussions"),
        ("Panel Discussions", "Panel Discussions ", "Startup Expo"),
        ("Startup Expo", "Startup Expo ", None)
    ]
    
    parsed_nodes = []
    for title, start_marker, next_marker in sub_activities:
        start_idx = line.find(start_marker)
        if start_idx == -1:
            continue
        
        if next_marker:
            end_idx = line.find(next_marker)
            part_text = line[start_idx:end_idx]
        else:
            part_text = line[start_idx:]
            
        node_id = make_id(1, parent_path[-1], title)
        # Avoid double prefix
        node_id = f"unit1.ecell_iitb.{node_id.split('.')[-1]}"
        
        node_path = parent_path + [title]
        node_obj = {
            "id": node_id,
            "title": title,
            "node_type": "activity",
            "path": node_path,
            "children": [],
            "content": [part_text],
            "metadata": {}
        }
        parsed_nodes.append((node_obj, part_text))
    return parsed_nodes

def detect_heading(line, idx, unit_num, current_topic_title, stack):
    stripped = line.strip()
    if not stripped:
        return None
        
    config = UNIT_CONFIGS[unit_num]
    
    # 1. UNIT Level 1 (Only allowed on line 1 or if stack is empty)
    if not stack and stripped.upper() == config["title"].upper():
        return {"node_type": "unit", "level": 1, "title": config["title"]}
        
    # Check registries
    headings = config["headings"]
    
    # Check Level 2
    if stripped in headings[2] or line in headings[2]:
        title = stripped
        if title.endswith(':'):
            title = title[:-1]
        title = re.sub(r'^\s*\d+\s*[\.\)]\s*', '', title)
        title = title.strip()
        return {"node_type": "topic", "level": 2, "title": title}
        
    # Check Level 3
    if 3 in headings and (stripped in headings[3] or line in headings[3]):
        title = stripped
        if title.endswith(':'):
            title = title[:-1]
        title = re.sub(r'^\s*\d+\s*[\.\)]\s*', '', title)
        title = title.strip()
        # Some level 3 headings might be categorized as subtopic or concept based on name/context
        ntype = "subtopic"
        # If it's a Case study or Example
        if "case study" in title.lower() or "case studies" in title.lower():
            ntype = "case_study"
        elif "example" in title.lower():
            ntype = "example"
        elif "activity" in title.lower():
            ntype = "activity"
        return {"node_type": ntype, "level": 3, "title": title}
        
    # Check Level 4
    if 4 in headings and (stripped in headings[4] or line in headings[4]):
        title = stripped
        title = re.sub(r'^\s*\d+\s*[\.\)]\s*', '', title)
        title = title.strip()
        return {"node_type": "concept", "level": 4, "title": title}
        
    # Dynamic parsing logic similar to compiler.py:
    # Concepts under Types of Entrepreneurs (Unit 1)
    if unit_num == 1:
        if current_topic_title == "3.The 4 types of entrepreneurs":
            m = re.match(r'^(\d+)\.\s+(The\s+[A-Za-z ]+)\s*$', stripped)
            if m:
                return {"node_type": "concept", "level": 3, "title": m.group(2).strip()}
                
        # Concepts under Qualities of successful entrepreneur (Unit 1)
        if current_topic_title == "What are the qualities of a successful entrepreneur?" or (stack and stack[-1]['title'] == "What are the qualities of a successful entrepreneur?"):
            m = re.match(r'^(\d+)\.\s+([A-Za-z ]+)\s*$', stripped)
            if m:
                title_text = m.group(2).strip()
                if len(title_text) < 40:
                    return {"node_type": "concept", "level": 4, "title": title_text}
                    
        # Concepts under Myths (Unit 1)
        if current_topic_title == "10 of the Most Common Entrepreneurship Myths:":
            m = re.match(r'^\s*(\d+)\.\s+([A-Za-z ,“”’\(\)\.\!]+)$', stripped)
            if m:
                title_text = m.group(2).strip()
                if len(title_text) < 60:
                    return {"node_type": "concept", "level": 3, "title": f"Myth {m.group(1)}: {title_text}"}
                    
        # Concepts under Development Models (Unit 1)
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
                
        # Examples under Examples of Entrepreneurs topic (Unit 1)
        if current_topic_title == "Here are 7 examples of entrepreneurs who brought change and shaped the world according to their vision. ":
            examples = {
                "ALEXANDER GRAHAM BELL", "STEVE JOBS", "WALT DISNEY",
                "BILL GATES", "JEFF BEZOS", "LARRY PAGE", "MARK ZUCKERBERG"
            }
            for name in examples:
                if stripped.startswith(name) or name in stripped:
                    return {"node_type": "example", "level": 3, "title": name.title()}

    return None

def parse_document(filepath, unit_num):
    with open(filepath, 'r', encoding='utf-8') as f:
        raw_lines = [line.rstrip('\r\n') for line in f]

    nodes = []
    stack = []
    paragraph_chunks = []
    flat_registry = {}
    roots = []
    current_topic_title = ""

    for idx, line in enumerate(raw_lines):
        heading_info = detect_heading(line, idx, unit_num, current_topic_title, stack)
        
        if heading_info:
            level = heading_info["level"]
            node_type = heading_info["node_type"]
            title = heading_info["title"]
            
            while len(stack) >= level:
                stack.pop()
                
            parent_titles = [node["title"] for node in stack]
            full_id = make_id(unit_num, *(parent_titles + [title]))
            
            # ID Collision Handling
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
                "content": [line],
                "metadata": {}
            }
            
            flat_registry[full_id] = node_obj
            
            if len(stack) > 0:
                parent = stack[-1]
                parent["children"].append(node_obj)
            else:
                roots.append(node_obj)
                
            stack.append(node_obj)
            
            paragraph_chunks.append({
                "index": idx,
                "text": line,
                "node_id": full_id
            })
            
            if node_type == "topic":
                current_topic_title = line.strip()
        else:
            # Content line
            if stack:
                stack[-1]["content"].append(line)
                paragraph_chunks.append({
                    "index": idx,
                    "text": line,
                    "node_id": stack[-1]["id"]
                })
            else:
                # No active node?
                dummy = {
                    "id": f"unit{unit_num}",
                    "title": config["title"] if "config" in locals() else f"UNIT {unit_num}",
                    "node_type": "unit",
                    "path": [config["title"] if "config" in locals() else f"UNIT {unit_num}"],
                    "children": [],
                    "content": [line],
                    "metadata": {}
                }
                flat_registry[dummy["id"]] = dummy
                roots.append(dummy)
                stack.append(dummy)
                paragraph_chunks.append({
                    "index": idx,
                    "text": line,
                    "node_id": dummy["id"]
                })

    def calc_metadata(node):
        child_count = len(node["children"])
        expandable = child_count > 0
        content_available = any(c.strip() for c in node["content"])
        node["metadata"] = {
            "expandable": expandable,
            "content_available": content_available,
            "child_count": child_count
        }
        for child in node["children"]:
            calc_metadata(child)
            
    for root in roots:
        calc_metadata(root)
        
    return roots, flat_registry, paragraph_chunks, raw_lines

def collect_content(node, collected):
    collected.extend(node["content"])
    for child in node["children"]:
        collect_content(child, collected)

def run_compilation(filepath, unit_num, out_dir=None):
    roots, flat_registry, paragraph_chunks, raw_lines = parse_document(filepath, unit_num)
    
    collected_lines = []
    for root in roots:
        collect_content(root, collected_lines)
        
    print(f"Unit {unit_num} - Original lines: {len(raw_lines)}, Reconstructed lines: {len(collected_lines)}")
    
    mismatches = 0
    for i in range(max(len(raw_lines), len(collected_lines))):
        o = raw_lines[i] if i < len(raw_lines) else None
        r = collected_lines[i] if i < len(collected_lines) else None
        if o != r:
            print(f"  Line {i+1} diff:")
            print(f"    Orig: {repr(o)}")
            print(f"    Recon:{repr(r)}")
            mismatches += 1
            if mismatches >= 5:
                break
                
    if mismatches == 0 and len(raw_lines) == len(collected_lines):
        print(f"Unit {unit_num}: Success! 100% Lossless Reconstruction.")
        
        # Build graph data
        concepts = []
        relationships = []
        for node_id, node in flat_registry.items():
            concepts.append({
                "id": node_id,
                "title": node["title"],
                "node_type": node["node_type"]
            })
            for child in node["children"]:
                relationships.append({
                    "from": child["id"],
                    "to": node_id,
                    "type": "part_of"
                })
                
        # Define semantic helper
        def find_id_by_title(title_substr, node_type=None):
            for nid, n in flat_registry.items():
                if title_substr.lower() in n["title"].lower():
                    if node_type is None or n["node_type"] == node_type:
                        return nid
            return None

        # Add explicit semantic relationships for Unit 1
        if unit_num == 1:
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
                    relationships.append({"from": "unit1", "to": cid, "type": "causes"})
            
            capacity_concepts = [
                "Education and Training", "Access to Finance",
                "Mentorship Programs", "Networking Opportunities",
                "Incubators and Accelerators", "Government Policies",
                "Technology Adoption"
            ]
            for title in capacity_concepts:
                cid = find_id_by_title(title, "concept")
                if cid:
                    relationships.append({"from": cid, "to": "unit1", "type": "supports"})
                    
            example_names = [
                "Alexander Graham Bell", "Steve Jobs", "Walt Disney",
                "Bill Gates", "Jeff Bezos", "Larry Page", "Mark Zuckerberg"
            ]
            intro_id = find_id_by_title("Introduction", "topic")
            for name in example_names:
                eid = find_id_by_title(name, "example")
                if eid and intro_id:
                    relationships.append({"from": eid, "to": intro_id, "type": "example_of"})
                    
            evi_id = find_id_by_title("Entrepreneur vs", "topic")
            eae_id = find_id_by_title("Entrepreneur and Entrepreneurship", "topic")
            if evi_id and eae_id:
                relationships.append({"from": evi_id, "to": eae_id, "type": "related_to"})
                
            # Add external entities as in original
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

        # Add explicit semantic relationships for Unit 2
        if unit_num == 2:
            # Let's map Porter's generic strategies and growth strategies
            porter_strategies = ["Differentiation", "Cost Leadership", "Focus"]
            porter_topic = find_id_by_title("Porter's Generic Strategies", "topic")
            for strat in porter_strategies:
                sid = find_id_by_title(strat, "subtopic") or find_id_by_title(strat, "concept")
                if sid and porter_topic:
                    relationships.append({"from": sid, "to": porter_topic, "type": "part_of"})
            
            # Map Case Studies to their concepts
            case_studies = [
                ("EcoClean", "Profitability Analysis"),
                ("Sweet Treats", "Operating Costs Evaluation"),
                ("TechGadgets", "Revenue Projections"),
                ("GreenTech", "Cash Flow Analysis"),
                ("GadgetPro", "Break-even Analysis")
            ]
            for cs, concept in case_studies:
                cid = find_id_by_title(concept)
                if cid:
                    cs_id = f"unit2.{cs.lower()}"
                    concepts.append({"id": cs_id, "title": cs, "node_type": "example"})
                    relationships.append({"from": cs_id, "to": cid, "type": "example_of"})

        # Add explicit semantic relationships for Unit 3
        if unit_num == 3:
            # Case Studies on 4Ps
            fps = [
                ("Apple iPhone", "Product"),
                ("Walmart", "Price"),
                ("Starbucks", "Place"),
                ("Coca-Cola", "Promotion"),
                ("boAt", "Product"),
                ("Jio", "Price"),
                ("Flipkart", "Place"),
                ("Zomato", "Promotion")
            ]
            for cs, p in fps:
                pid = find_id_by_title(p)
                if pid:
                    cs_id = make_id(3, cs)
                    concepts.append({"id": cs_id, "title": cs, "node_type": "example"})
                    relationships.append({"from": cs_id, "to": pid, "type": "example_of"})

        # Add explicit semantic relationships for Unit 4
        if unit_num == 4:
            cases = [
                ("Tej Strainer", "Invention involves an ‘inventive step’"),
                ("Dr. Ananda Chakraborty", "patent"),
                ("Bayer Corporation", "Case studies"),
                ("Rice Patent", "Case studies"),
                ("Turmeric Patent", "Case studies")
            ]
            for cs, concept in cases:
                cid = find_id_by_title(concept)
                if cid:
                    cs_id = make_id(4, cs)
                    concepts.append({"id": cs_id, "title": cs, "node_type": "example"})
                    relationships.append({"from": cs_id, "to": cid, "type": "example_of"})

        # Add explicit semantic relationships for Unit 5
        if unit_num == 5:
            designs = ["iPhone Design by Apple", "Alessi Juicy Salif Citrus Juicer", "Vespa Scooter", "Swatch Watch", "Oxo Good Grips Kitchen Tools"]
            cases_topic = find_id_by_title("Case Studies", "topic")
            for ds in designs:
                did = find_id_by_title(ds)
                if did and cases_topic:
                    relationships.append({"from": did, "to": cases_topic, "type": "example_of"})

        graph_data = {
            "concepts": concepts,
            "relationships": relationships
        }
        
        chunk_map_data = {str(item["index"]): item["node_id"] for item in paragraph_chunks}
        
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
            with open(os.path.join(out_dir, 'hierarchy.json'), 'w', encoding='utf-8') as f:
                json.dump(roots[0], f, indent=2, ensure_ascii=False)
            with open(os.path.join(out_dir, 'graph.json'), 'w', encoding='utf-8') as f:
                json.dump(graph_data, f, indent=2, ensure_ascii=False)
            with open(os.path.join(out_dir, 'chunk_map.json'), 'w', encoding='utf-8') as f:
                json.dump(chunk_map_data, f, indent=2, ensure_ascii=False)
            print(f"Saved outputs to directory: {out_dir}")
            
        return roots[0], graph_data, chunk_map_data
    else:
        print(f"Unit {unit_num} compilation FAILED verification.")
        return None, None, None

def compile_all():
    # File paths
    files = {
        1: 'Unit-1',
        2: 'Unit-2',
        3: '../Unit-3',
        4: '../unit-4',
        5: '../Unit-5'
    }
    
    # Store results
    all_hierarchies = {}
    all_graphs = {}
    all_chunk_maps = {}
    
    for unit_num, filepath in files.items():
        print(f"\nProcessing Unit {unit_num}...")
        # Compile individual unit and save in folders unit1/, unit2/, etc.
        out_dir = f"unit{unit_num}"
        h, g, c = run_compilation(filepath, unit_num, out_dir)
        if h:
            all_hierarchies[unit_num] = h
            all_graphs[unit_num] = g
            all_chunk_maps[unit_num] = c
            
    # Now build the integrated outputs
    print("\nIntegrating all units into combined outputs...")
    
    # Combined Hierarchy
    course_node = {
        "id": "course",
        "title": "Entrepreneurship and Intellectual Property Rights",
        "node_type": "course",
        "path": ["Entrepreneurship and Intellectual Property Rights"],
        "children": [all_hierarchies[u] for u in sorted(all_hierarchies.keys())],
        "content": [],
        "metadata": {
            "expandable": True,
            "content_available": False,
            "child_count": len(all_hierarchies)
        }
    }
    
    # Combined Graph
    combined_concepts = []
    combined_relationships = []
    
    # Add course node to concepts
    combined_concepts.append({
        "id": "course",
        "title": "Entrepreneurship and Intellectual Property Rights",
        "node_type": "course"
    })
    
    # Add relationships from course to each unit
    for u in sorted(all_hierarchies.keys()):
        combined_relationships.append({
            "from": f"unit{u}",
            "to": "course",
            "type": "part_of"
        })
        
    # Merge all concepts and relationships
    for u in sorted(all_graphs.keys()):
        combined_concepts.extend(all_graphs[u]["concepts"])
        combined_relationships.extend(all_graphs[u]["relationships"])
        
    combined_graph = {
        "concepts": combined_concepts,
        "relationships": combined_relationships
    }
    
    # Combined Chunk Map
    combined_chunk_map = {}
    for u in sorted(all_chunk_maps.keys()):
        for line_idx, node_id in all_chunk_maps[u].items():
            combined_chunk_map[f"unit{u}_{line_idx}"] = node_id
            
    # Write to root directory
    with open('hierarchy.json', 'w', encoding='utf-8') as f:
        json.dump(course_node, f, indent=2, ensure_ascii=False)
    with open('graph.json', 'w', encoding='utf-8') as f:
        json.dump(combined_graph, f, indent=2, ensure_ascii=False)
    with open('chunk_map.json', 'w', encoding='utf-8') as f:
        json.dump(combined_chunk_map, f, indent=2, ensure_ascii=False)
    print("Saved combined outputs to root directory (hierarchy.json, graph.json, chunk_map.json)")

if __name__ == '__main__':
    # If arguments are provided: python multi_compiler.py <file_path> <unit_num>
    if len(sys.argv) == 3:
        filepath = sys.argv[1]
        unit_num = int(sys.argv[2])
        run_compilation(filepath, unit_num, f"unit{unit_num}")
    else:
        # Run all
        compile_all()
