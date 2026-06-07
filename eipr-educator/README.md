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

To fully run the application, you need to run two servers: the **HTTP Web Server** (for the frontend/UI) and the **WebSocket Relay Server** (for multiplayer/classroom features).

### 1. Start the HTTP Web Server (Frontend)

To serve the frontend user interface, run a lightweight HTTP server in the project directory:

```bash
# Navigate to the project directory
cd eipr-educator

# Option A: Start using Python (Recommended)
python -m http.server 8000

# Option B: Start using Node (e.g., live-server, http-server if installed globally)
npx http-server -p 8000
```

Once started, open your web browser and navigate to:
```text
http://localhost:8000
```

---

### 2. Start the WebSocket Relay Server (Multiplayer Backend)

To enable LAN multiplayer, party/classroom coordination, and teacher controls, start the WebSocket relay server:

```bash
# Navigate to the project directory
cd eipr-educator

# Install dependencies (only required once)
npm install

# Start the WebSocket server
npm start
```

This starts the multiplayer server on port **3001**.
- **Local Address**: `ws://localhost:3001`
- **LAN Address**: The server console will output your local network IP (e.g., `ws://192.168.x.x:3001`). Share this IP address with students/players so they can connect via the in-game UI connection panel.


---

## Technical Details & Structure

- **`index.html`**: Scaffolds the responsive glassmorphism frame, search inputs, control panel, D3 SVG canvas, and content modal.
- **`style.css`**: Styling rules featuring animated glassmorphism blur backdrops (`backdrop-filter`), smooth micro-animations, and Google's signature color palette.
- **`app.js`**: Drives the D3.js force-directed graph logic, handling zooming, panning, tree expansion/contraction, and modal display triggers.
- **`data.js`**: Contains the full lossless data compiled from all 5 Units.
