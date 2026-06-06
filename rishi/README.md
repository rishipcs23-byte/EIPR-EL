# EIPR - Interactive Knowledge Explorer

A professional, Google-themed, glassmorphic interactive knowledge visualization dashboard for the Entrepreneurship & Intellectual Property Rights (EIPR) course.

This interactive neural-network-like graph explores the entire losslessly compiled course material across all 5 units.

## Features

- **Central EIPR Hub**: A central course node that serves as the root. Click to expand into 5 Units (Unit 1 to Unit 5), and click again to collapse/merge.
- **Physics-Enabled Force Graph**: Active spring and repulsion physics engine (D3.js force simulation) representing topics, subtopics, concepts, and case studies.
- **Dynamic Percolation & Collapse**: Click any node to recursively expand its children or collapse them.
- **Lossless Full-Text Spawn**: Double-click any leaf/concept node to spawn a high-fidelity glassmorphism modal containing the exact original text.
- **Sidebar Inspection Panel**: Get real-time path hierarchies, node types, IDs, and content previews by single-clicking nodes.
- **Interactive Search Bar**: Instantly search across titles, subtopics, concepts, and text contents. Matching nodes are highlighted while their parent hierarchies auto-expand.
- **Control Suite**: Zoom in/out, fit graph to screen, reset view, and toggle active physics simulation.

---

## How to Run the Application

Follow these simple steps to start the local server and explore the graph:

### Step 1: Start the Local HTTP Server

You can run a lightweight server in the directory containing `index.html` using Python:

```bash
# Navigate to the rishi project directory
cd rishi

# Start the python HTTP server
python -m http.server 8000
```

### Step 2: Open in Your Browser

Open your favorite web browser and navigate to:

```text
http://localhost:8000
```

---

## Technical Details & Structure

- **`index.html`**: Scaffolds the responsive glassmorphism frame, search inputs, control panel, D3 SVG canvas, and content modal.
- **`style.css`**: Styling rules featuring animated glassmorphism blur backdrops (`backdrop-filter`), smooth micro-animations, and Google's signature color palette.
- **`app.js`**: Drives the D3.js force-directed graph logic, handling zooming, panning, tree expansion/contraction, and modal display triggers.
- **`data.js`**: Contains the full lossless data compiled from all 5 Units.
