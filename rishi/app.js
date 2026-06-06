/**
 * EIPR Knowledge Explorer - Frontend Logic (Light Theme & Rectangular Nodes)
 * Interactive Force-Directed Graph using D3.js v7
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Data Initialization
    if (typeof hierarchyData === "undefined") {
        console.error("hierarchyData is not defined. Make sure data.js is loaded correctly.");
        return;
    }

    // Helper to recursively prepare data
    function prepareTree(node, parent = null) {
        node.parent = parent;
        node.expanded = false; // Collapse by default
        
        // Cache child nodes
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => prepareTree(child, node));
        } else {
            node.children = [];
        }
    }

    // Prepare our global tree hierarchy
    prepareTree(hierarchyData);
    // Expand root (Course) by default so EIPR starts visible
    hierarchyData.expanded = true;

    // 2. DOM Elements Selection
    const svg = d3.select("#graph-svg");
    const container = document.getElementById("graph-container");
    
    // Floating Popup Card Elements
    const nodePopup = document.getElementById("node-popup");
    const popupType = document.getElementById("popup-type");
    const popupTitle = document.getElementById("popup-title");
    const popupPath = document.getElementById("popup-path");
    const popupContent = document.getElementById("popup-content");
    const popupCloseBtn = document.getElementById("popup-close-btn");
    const popupOpenModalBtn = document.getElementById("popup-open-modal-btn");
    
    // Controls & Search
    const searchInput = document.getElementById("search-input");
    const btnZoomIn = document.getElementById("btn-zoom-in");
    const btnZoomOut = document.getElementById("btn-zoom-out");
    const btnZoomFit = document.getElementById("btn-zoom-fit");
    const btnReset = document.getElementById("btn-reset");
    const btnPhysics = document.getElementById("btn-physics");
    
    // Modal Elements
    const contentModal = document.getElementById("content-modal");
    const modalTitle = document.getElementById("modal-title");
    const modalType = document.getElementById("modal-type");
    const modalPath = document.getElementById("modal-path");
    const modalText = document.getElementById("modal-text");
    const closeModalBtn = document.getElementById("close-modal-btn");

    let width = container.clientWidth;
    let height = container.clientHeight;
    let activePopupNode = null;
    
    // Handle window resize
    window.addEventListener("resize", () => {
        width = container.clientWidth;
        height = container.clientHeight;
        svg.attr("width", width).attr("height", height);
        updatePopupPosition();
    });

    // 3. Radius & Dimensions Configuration
    const typeRadius = {
        "course": 36,
        "unit": 26,
        "concept": 12,
        "case_study": 10,
        "example": 10,
        "activity": 10
    };

    const rectW = 170;
    const rectH = 40;

    const typeColors = {
        "course": "#4285F4",
        "unit": "#EA4335",
        "topic": "#FBBC05",
        "subtopic": "#34A853",
        "concept": "#8A3FFC",
        "case_study": "#00bfa5",
        "example": "#00bfa5",
        "activity": "#00bfa5"
    };

    // Keep track of active nodes and links
    let visibleNodes = [];
    let visibleLinks = [];
    let physicsEnabled = true;

    // Create main SVG group for zooming/panning
    const g = svg.append("g").attr("class", "graph-content");

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
            updatePopupPosition();
        });

    svg.call(zoom);

    // 4. Force Simulation Setup
    const simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(d => {
            const targetType = d.target.node_type;
            if (targetType === "unit") return 160;
            if (targetType === "topic") return 110;
            if (targetType === "subtopic") return 80;
            return 60;
        }))
        .force("charge", d3.forceManyBody().strength(d => {
            if (d.node_type === "course") return -1200;
            if (d.node_type === "unit") return -600;
            if (d.node_type === "topic" || d.node_type === "subtopic") return -400;
            return -120;
        }))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(d => {
            if (d.node_type === "topic" || d.node_type === "subtopic") {
                return 95; // Larger radius to avoid overlapping rectangles
            }
            return (typeRadius[d.node_type] || 12) + 15;
        }).strength(0.85));

    // Define drag behaviors
    function drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active && physicsEnabled) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
            closePopup();
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
            updatePopupPosition();
        }
        
        function dragended(event, d) {
            if (!event.active && physicsEnabled) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    // 5. Build/Update Graph Function
    function updateGraph() {
        // Collect visible nodes and links from hierarchical state
        const nodesList = [];
        const linksList = [];

        function traverse(node) {
            nodesList.push(node);
            if (node.expanded && node.children) {
                node.children.forEach(child => {
                    linksList.push({ source: node.id, target: child.id });
                    traverse(child);
                });
            }
        }

        traverse(hierarchyData);

        // Map existing positions to avoid reset jumps
        const nodeMap = new Map(visibleNodes.map(d => [d.id, d]));
        nodesList.forEach(node => {
            const oldNode = nodeMap.get(node.id);
            if (oldNode) {
                node.x = oldNode.x;
                node.y = oldNode.y;
                node.vx = oldNode.vx;
                node.vy = oldNode.vy;
            } else if (node.parent) {
                // Spawn new nodes near parent
                const parentNode = nodeMap.get(node.parent.id) || node.parent;
                node.x = parentNode.x ? parentNode.x + (Math.random() - 0.5) * 40 : width / 2;
                node.y = parentNode.y ? parentNode.y + (Math.random() - 0.5) * 40 : height / 2;
            } else {
                node.x = width / 2;
                node.y = height / 2;
            }
        });

        visibleNodes = nodesList;
        visibleLinks = linksList;

        // Render links
        let linkElements = g.selectAll(".link")
            .data(visibleLinks, d => `${d.source}-${d.target}`);

        linkElements.exit().remove();

        const linkEnter = linkElements.enter().append("line")
            .attr("class", "link")
            .attr("stroke", "#bcc1c6")
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.25);

        linkElements = linkEnter.merge(linkElements);

        // Render nodes
        let nodeElements = g.selectAll(".node")
            .data(visibleNodes, d => d.id);

        nodeElements.exit().remove();

        const nodeEnter = nodeElements.enter().append("g")
            .attr("class", d => `node node-${d.node_type}`)
            .call(drag(simulation));

        // SHAPE BRANCHING: Circles for Course, Unit, Concept, and Leaf Blobs
        const circles = nodeEnter.filter(d => 
            d.node_type === "course" || 
            d.node_type === "unit" || 
            d.node_type === "concept" || 
            d.node_type === "case_study" || 
            d.node_type === "example" || 
            d.node_type === "activity"
        );

        circles.append("circle")
            .attr("class", "node-circle")
            .attr("r", d => typeRadius[d.node_type] || 12)
            .attr("fill", d => typeColors[d.node_type])
            .attr("stroke", d => d3.rgb(typeColors[d.node_type]).darker(0.3));

        circles.append("text")
            .attr("class", "node-label")
            .attr("dy", d => (typeRadius[d.node_type] || 12) + 16)
            .attr("text-anchor", "middle")
            .attr("font-size", d => d.node_type === "course" ? "13px" : d.node_type === "unit" ? "12px" : "10px")
            .text(d => d.title.length > 22 ? d.title.substring(0, 19) + "..." : d.title);

        // SHAPE BRANCHING: Rectangles with rounded corners for Topics and Subtopics
        const rects = nodeEnter.filter(d => d.node_type === "topic" || d.node_type === "subtopic");
        
        rects.append("rect")
            .attr("class", "node-rect")
            .attr("x", -rectW / 2)
            .attr("y", -rectH / 2)
            .attr("width", rectW)
            .attr("height", rectH)
            .attr("rx", 10)
            .attr("ry", 10)
            .attr("fill", "rgba(255, 255, 255, 0.85)")
            .attr("stroke", d => typeColors[d.node_type]);

        rects.append("text")
            .attr("class", "node-rect-text")
            .attr("dy", 4)
            .attr("text-anchor", "middle")
            .text(d => d.title.length > 24 ? d.title.substring(0, 21) + "..." : d.title);

        nodeElements = nodeEnter.merge(nodeElements);

        // Class toggling for collapsed states
        nodeElements.classed("has-children-collapsed", d => d.children && d.children.length > 0 && !d.expanded);
        
        // Interaction (Click opens/collapses & triggers connected popup preview)
        nodeElements.on("click", (event, d) => {
            event.stopPropagation();
            
            // Toggle child expansion
            if (d.children && d.children.length > 0) {
                d.expanded = !d.expanded;
                updateGraph();
            }

            // Spawn connected popup for nodes with text content or preview info
            showPopup(d, event.currentTarget);
        });

        // Double Click opens modal directly
        nodeElements.on("dblclick", (event, d) => {
            event.stopPropagation();
            showFullContent(d);
        });

        // Restart D3 force simulation
        simulation.nodes(visibleNodes);
        simulation.force("link").links(visibleLinks);
        
        if (physicsEnabled) {
            simulation.alpha(0.3).restart();
        } else {
            simulation.stop();
            tickActions();
        }
    }

    // Tick actions to update link/node screen coordinate transforms
    function tickActions() {
        g.selectAll(".link")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        g.selectAll(".node")
            .attr("transform", d => `translate(${d.x}, ${d.y})`);
            
        updatePopupPosition();
    }

    simulation.on("tick", tickActions);

    // 6. Connected Floating Popup Card Operations
    function showPopup(node, nodeElement) {
        activePopupNode = node;
        
        // Show active stroke on node
        g.selectAll(".node-circle").attr("stroke-width", 2.5);
        g.selectAll(".node-rect").attr("stroke-width", 1.5);
        
        d3.select(nodeElement).select(".node-circle").attr("stroke-width", 4.5);
        d3.select(nodeElement).select(".node-rect").attr("stroke-width", 3);

        // Populate popup fields
        popupType.className = `badge ${node.node_type}`;
        popupType.textContent = node.node_type.replace("_", " ");
        popupTitle.textContent = node.title;

        // Path breadcrumbs
        popupPath.innerHTML = "";
        if (node.path && node.path.length > 0) {
            node.path.forEach((p, idx) => {
                const span = document.createElement("span");
                span.textContent = p;
                popupPath.appendChild(span);
                if (idx < node.path.length - 1) {
                    popupPath.appendChild(document.createTextNode(" > "));
                }
            });
        }

        // Preview text
        if (node.content && node.content.length > 0) {
            const nonBlankContent = node.content.filter(line => line.trim().length > 0);
            if (nonBlankContent.length > 0) {
                popupContent.textContent = nonBlankContent.slice(0, 3).join("\n\n");
            } else {
                popupContent.textContent = "Click 'View Full Notes' or expand sub-nodes to inspect details.";
            }
            popupOpenModalBtn.classList.remove("hidden");
        } else {
            popupContent.textContent = "This structural node contains no direct text content. Click to expand and explore children.";
            popupOpenModalBtn.classList.add("hidden");
        }

        // Compute coordinate positions relative to container
        nodePopup.classList.remove("hidden");
        updatePopupPosition();
    }

    function updatePopupPosition() {
        if (!activePopupNode) return;
        
        // Retrieve D3 group element representing the active node
        const nodeEl = g.selectAll(".node").filter(d => d.id === activePopupNode.id).node();
        if (!nodeEl) return;
        
        const rect = nodeEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate offset (center of the node element on page viewport)
        const left = rect.left - containerRect.left + rect.width / 2;
        const top = rect.top - containerRect.top;
        
        nodePopup.style.left = `${left}px`;
        nodePopup.style.top = `${top}px`;
    }

    function closePopup() {
        activePopupNode = null;
        nodePopup.classList.add("hidden");
        
        // Reset node visual highlights
        g.selectAll(".node-circle").attr("stroke-width", 2.5);
        g.selectAll(".node-rect").attr("stroke-width", 1.5);
    }

    popupCloseBtn.addEventListener("click", closePopup);
    
    // Close popup on clicking background
    container.addEventListener("click", (e) => {
        if (e.target.id === "graph-container" || e.target.id === "graph-svg") {
            closePopup();
        }
    });

    // 7. Full Content Modal Operations
    function showFullContent(node) {
        modalTitle.textContent = node.title;
        modalType.className = `badge ${node.node_type}`;
        modalType.textContent = node.node_type.replace("_", " ");
        
        // Render path
        modalPath.innerHTML = "";
        if (node.path && node.path.length > 0) {
            node.path.forEach((p, idx) => {
                const span = document.createElement("span");
                span.textContent = p;
                modalPath.appendChild(span);
                if (idx < node.path.length - 1) {
                    modalPath.appendChild(document.createTextNode(" > "));
                }
            });
        }

        // Render full text body losslessly
        modalText.innerHTML = "";
        if (node.content && node.content.length > 0) {
            node.content.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.length > 0) {
                    if (trimmed.startsWith("●") || trimmed.startsWith("•") || trimmed.startsWith("o") || trimmed.match(/^\d+\./)) {
                        const li = document.createElement("li");
                        li.textContent = line;
                        modalText.appendChild(li);
                    } else {
                        const p = document.createElement("p");
                        p.textContent = line;
                        modalText.appendChild(p);
                    }
                }
            });
        } else {
            modalText.textContent = "No content available for this node.";
        }

        contentModal.classList.add("show");
    }

    closeModalBtn.addEventListener("click", () => {
        contentModal.classList.remove("show");
    });

    contentModal.addEventListener("click", (e) => {
        if (e.target === contentModal) {
            contentModal.classList.remove("show");
        }
    });

    popupOpenModalBtn.addEventListener("click", () => {
        if (activePopupNode) {
            showFullContent(activePopupNode);
        }
    });

    // 8. Zoom and Toolbar Control Operations
    btnZoomIn.addEventListener("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.3);
    });

    btnZoomOut.addEventListener("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.3);
    });

    btnZoomFit.addEventListener("click", () => {
        if (visibleNodes.length === 0) return;

        let minX = d3.min(visibleNodes, d => d.x);
        let maxX = d3.max(visibleNodes, d => d.x);
        let minY = d3.min(visibleNodes, d => d.y);
        let maxY = d3.max(visibleNodes, d => d.y);

        const padding = 80;
        const graphW = (maxX - minX) || 100;
        const graphH = (maxY - minY) || 100;
        
        const scale = Math.min(
            (width - padding * 2) / graphW,
            (height - padding * 2) / graphH
        );

        const boundedScale = Math.max(0.15, Math.min(scale, 2));
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const transform = d3.zoomIdentity
            .translate(width / 2 - boundedScale * midX, height / 2 - boundedScale * midY)
            .scale(boundedScale);

        svg.transition().duration(500).call(zoom.transform, transform);
    });

    btnReset.addEventListener("click", () => {
        // Collapse all nodes except root (Course)
        function collapseAll(node) {
            node.expanded = (node.id === "course");
            if (node.children) {
                node.children.forEach(collapseAll);
            }
        }
        collapseAll(hierarchyData);
        
        // Reset node positions
        visibleNodes.forEach(d => {
            delete d.x;
            delete d.y;
            delete d.vx;
            delete d.vy;
        });

        closePopup();
        updateGraph();
        
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

    btnPhysics.addEventListener("click", () => {
        physicsEnabled = !physicsEnabled;
        btnPhysics.classList.toggle("active", physicsEnabled);
        
        if (physicsEnabled) {
            simulation.alphaTarget(0.3).restart();
        } else {
            simulation.stop();
        }
    });

    // 9. Real-time Search Operations
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            // Restore visual defaults
            g.selectAll(".node").style("opacity", 1);
            g.selectAll(".link").style("opacity", 0.25);
            return;
        }

        const matchedNodeIds = new Set();
        
        function searchTree(node) {
            let matched = node.title.toLowerCase().includes(query) || 
                          node.id.toLowerCase().includes(query);
            
            if (node.content && node.content.some(line => line.toLowerCase().includes(query))) {
                matched = true;
            }

            if (matched) {
                matchedNodeIds.add(node.id);
                // Auto-expand parents
                let p = node.parent;
                while (p) {
                    p.expanded = true;
                    matchedNodeIds.add(p.id);
                    p = p.parent;
                }
            }

            if (node.children) {
                node.children.forEach(searchTree);
            }
        }

        searchTree(hierarchyData);
        updateGraph();

        // Highlight matched nodes, dim others
        g.selectAll(".node")
            .style("opacity", d => matchedNodeIds.has(d.id) ? 1 : 0.15);

        g.selectAll(".link")
            .style("opacity", d => matchedNodeIds.has(d.source.id) && matchedNodeIds.has(d.target.id) ? 0.65 : 0.05);
    });

    // Initialize the visual graph on startup
    updateGraph();
});
