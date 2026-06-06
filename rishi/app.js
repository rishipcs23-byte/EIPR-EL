/**
 * EIPR Knowledge Explorer - Frontend Logic
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
    const welcomeCard = document.getElementById("welcome-message");
    const detailsCard = document.getElementById("node-details");
    
    // Sidebar Details
    const detailType = document.getElementById("detail-type");
    const detailTitle = document.getElementById("detail-title");
    const detailPath = document.getElementById("detail-path");
    const detailId = document.getElementById("detail-id");
    const detailContent = document.getElementById("detail-content");
    const openModalBtn = document.getElementById("open-modal-btn");
    
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
    
    // Handle window resize
    window.addEventListener("resize", () => {
        width = container.clientWidth;
        height = container.clientHeight;
        svg.attr("width", width).attr("height", height);
    });

    // 3. Node Type Radius & Styling Helpers
    const typeRadius = {
        "course": 36,
        "unit": 26,
        "topic": 18,
        "subtopic": 14,
        "concept": 10,
        "case_study": 8,
        "example": 8,
        "activity": 8
    };

    const typeColors = {
        "course": "#4285F4",
        "unit": "#EA4335",
        "topic": "#FBBC05",
        "subtopic": "#34A853",
        "concept": "#8A3FFC",
        "case_study": "#00FAC6",
        "example": "#00FAC6",
        "activity": "#00FAC6"
    };

    // Keep track of active nodes and links
    let visibleNodes = [];
    let visibleLinks = [];
    let selectedNode = null;
    let physicsEnabled = true;

    // Create main SVG group for zooming/panning
    const g = svg.append("g").attr("class", "graph-content");

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // 4. Force Simulation Setup
    const simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(d => {
            const targetType = d.target.node_type;
            if (targetType === "unit") return 150;
            if (targetType === "topic") return 90;
            return 60;
        }))
        .force("charge", d3.forceManyBody().strength(d => {
            if (d.node_type === "course") return -1200;
            if (d.node_type === "unit") return -600;
            if (d.node_type === "topic") return -300;
            return -120;
        }))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(d => typeRadius[d.node_type] || 10).strength(0.8));

    // Define drag behaviors
    function drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active && physicsEnabled) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
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
                node.x = parentNode.x ? parentNode.x + (Math.random() - 0.5) * 20 : width / 2;
                node.y = parentNode.y ? parentNode.y + (Math.random() - 0.5) * 20 : height / 2;
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
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.2);

        linkElements = linkEnter.merge(linkElements);

        // Render nodes
        let nodeElements = g.selectAll(".node")
            .data(visibleNodes, d => d.id);

        nodeElements.exit().remove();

        const nodeEnter = nodeElements.enter().append("g")
            .attr("class", d => `node node-${d.node_type}`)
            .call(drag(simulation));

        // Node circle
        nodeEnter.append("circle")
            .attr("class", "node-circle")
            .attr("r", d => typeRadius[d.node_type] || 10)
            .attr("fill", d => typeColors[d.node_type] || "#ffffff")
            .attr("stroke", d => d3.rgb(typeColors[d.node_type]).brighter(0.6))
            .style("cursor", "pointer");

        // Text label
        nodeEnter.append("text")
            .attr("class", "node-label")
            .attr("dy", d => (typeRadius[d.node_type] || 10) + 15)
            .attr("text-anchor", "middle")
            .attr("fill", "#ffffff")
            .attr("font-size", d => d.node_type === "course" ? "14px" : d.node_type === "unit" ? "12px" : "10px")
            .text(d => d.title.length > 25 ? d.title.substring(0, 22) + "..." : d.title);

        nodeElements = nodeEnter.merge(nodeElements);

        // Update visual states based on collapse status
        nodeElements.classed("has-children-collapsed", d => d.children && d.children.length > 0 && !d.expanded);
        nodeElements.select("circle")
            .attr("stroke-dasharray", d => d.children && d.children.length > 0 && !d.expanded ? "4 2" : "none");

        // Node Interaction (Click and Double Click)
        nodeElements.on("click", (event, d) => {
            event.stopPropagation();
            
            // Single click selects node and reveals in sidebar
            selectNode(d);

            // Toggle expansion of children on click
            if (d.children && d.children.length > 0) {
                d.expanded = !d.expanded;
                updateGraph();
            }
        });

        nodeElements.on("dblclick", (event, d) => {
            event.stopPropagation();
            // Double click opens the Modal with original full notes
            showFullContent(d);
        });

        // 6. Restart Simulation
        simulation.nodes(visibleNodes);
        simulation.force("link").links(visibleLinks);
        
        if (physicsEnabled) {
            simulation.alpha(0.3).restart();
        } else {
            simulation.stop();
            // Manually position once if physics is off
            tickActions();
        }
    }

    // Tick action for Force simulation
    function tickActions() {
        g.selectAll(".link")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        g.selectAll(".node")
            .attr("transform", d => `translate(${d.x}, ${d.y})`);
    }

    simulation.on("tick", tickActions);

    // 7. Sidebar Details Rendering
    function selectNode(node) {
        selectedNode = node;
        
        // Remove active outline from all nodes, add glow to selected
        g.selectAll(".node-circle").attr("stroke-width", 2.5);
        g.selectAll(".node")
            .filter(d => d.id === node.id)
            .select(".node-circle")
            .attr("stroke-width", 5);

        welcomeCard.classList.add("hidden");
        detailsCard.classList.remove("hidden");

        detailType.className = `badge ${node.node_type}`;
        detailType.textContent = node.node_type.replace("_", " ");
        detailTitle.textContent = node.title;
        detailId.textContent = node.id;

        // Render path
        detailPath.innerHTML = "";
        if (node.path && node.path.length > 0) {
            node.path.forEach((p, idx) => {
                const span = document.createElement("span");
                span.textContent = p;
                detailPath.appendChild(span);
                if (idx < node.path.length - 1) {
                    const arrow = document.createTextNode(" > ");
                    detailPath.appendChild(arrow);
                }
            });
        }

        // Content Preview
        if (node.content && node.content.length > 0) {
            // Filter empty lines and join
            const nonBlankContent = node.content.filter(line => line.trim().length > 0);
            if (nonBlankContent.length > 0) {
                detailContent.textContent = nonBlankContent.slice(0, 3).join("\n\n") + (nonBlankContent.length > 3 ? "\n\n..." : "");
            } else {
                detailContent.textContent = "No text content direct in this node. Double click or explore its children nodes.";
            }
            openModalBtn.classList.remove("hidden");
        } else {
            detailContent.textContent = "This structural node contains no direct text content. Expand it to view sub-nodes.";
            openModalBtn.classList.add("hidden");
        }
    }

    // 8. Full Content Modal
    function showFullContent(node) {
        modalTitle.textContent = node.title;
        modalType.className = `badge ${node.node_type}`;
        modalType.textContent = node.node_type.replace("_", " ");
        
        // Render path in modal
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

        // Render full body text losslessly
        modalText.innerHTML = "";
        if (node.content && node.content.length > 0) {
            node.content.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.length > 0) {
                    // Check if it looks like a bullet or list item
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

    // Close Modal Event Listeners
    closeModalBtn.addEventListener("click", () => {
        contentModal.classList.remove("show");
    });

    contentModal.addEventListener("click", (e) => {
        if (e.target === contentModal) {
            contentModal.classList.remove("show");
        }
    });

    openModalBtn.addEventListener("click", () => {
        if (selectedNode) {
            showFullContent(selectedNode);
        }
    });

    // 9. Zoom and Controls implementation
    btnZoomIn.addEventListener("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.3);
    });

    btnZoomOut.addEventListener("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.3);
    });

    btnZoomFit.addEventListener("click", () => {
        if (visibleNodes.length === 0) return;

        // Calculate bounding box of all visible nodes
        let minX = d3.min(visibleNodes, d => d.x);
        let maxX = d3.max(visibleNodes, d => d.x);
        let minY = d3.min(visibleNodes, d => d.y);
        let maxY = d3.max(visibleNodes, d => d.y);

        const padding = 60;
        const graphW = (maxX - minX) || 100;
        const graphH = (maxY - minY) || 100;
        
        const scale = Math.min(
            (width - padding * 2) / graphW,
            (height - padding * 2) / graphH
        );

        const boundedScale = Math.max(0.15, Math.min(scale, 2.5));
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
        
        // Reset positions
        visibleNodes.forEach(d => {
            delete d.x;
            delete d.y;
            delete d.vx;
            delete d.vy;
        });

        selectedNode = null;
        welcomeCard.classList.remove("hidden");
        detailsCard.classList.add("hidden");

        updateGraph();
        
        // Reset zoom
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

    // Toggle physics behavior
    btnPhysics.addEventListener("click", () => {
        physicsEnabled = !physicsEnabled;
        btnPhysics.classList.toggle("active", physicsEnabled);
        
        if (physicsEnabled) {
            simulation.alphaTarget(0.3).restart();
        } else {
            simulation.stop();
        }
    });

    // 10. Search Functionality
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            // Remove search highlighting
            g.selectAll(".node-circle").style("opacity", 1);
            g.selectAll(".node-label").style("opacity", 1);
            g.selectAll(".link").style("opacity", 0.25);
            return;
        }

        // Filter and highlight
        const matchedNodeIds = new Set();
        
        // Find nodes matching query and their parent path
        function searchTree(node) {
            let matched = node.title.toLowerCase().includes(query) || 
                          node.id.toLowerCase().includes(query);
            
            // Also search content
            if (node.content && node.content.some(line => line.toLowerCase().includes(query))) {
                matched = true;
            }

            if (matched) {
                matchedNodeIds.add(node.id);
                // Also expand parents so matching nodes are visible
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

        // Highlight matched nodes and dim others
        g.selectAll(".node-circle")
            .style("opacity", d => matchedNodeIds.has(d.id) ? 1 : 0.2)
            .style("stroke-width", d => matchedNodeIds.has(d.id) && d.title.toLowerCase().includes(query) ? 5 : 2.5);

        g.selectAll(".node-label")
            .style("opacity", d => matchedNodeIds.has(d.id) ? 1 : 0.2);

        g.selectAll(".link")
            .style("opacity", d => matchedNodeIds.has(d.source.id) && matchedNodeIds.has(d.target.id) ? 0.6 : 0.05);
    });

    // Initialize the visual graph
    updateGraph();
});
