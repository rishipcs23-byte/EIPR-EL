/**
 * EIPR Knowledge Explorer - Frontend Logic
 * Interactive Horizontal Tree Graph (D3.js) & Textbook Reader
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Data Initialization
    if (typeof hierarchyData === "undefined") {
        console.error("hierarchyData is not defined. Make sure data.js is loaded correctly.");
        return;
    }

    // Helper to recursively prepare data & compute depth
    function prepareTree(node, depth = 0, parent = null) {
        node.parent = parent;
        node.depth = depth;
        node.expanded = false; // Collapse by default
        
        // Cache child nodes
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => prepareTree(child, depth + 1, node));
        } else {
            node.children = [];
        }
    }

    // Prepare our global tree hierarchy
    prepareTree(hierarchyData, 0);
    // Expand root (Course) and units by default so the starting layer is visible
    hierarchyData.expanded = true;
    hierarchyData.children.forEach(unit => {
        unit.expanded = true;
    });

    // 2. DOM Elements Selection
    const svg = d3.select("#graph-svg");
    const container = document.getElementById("graph-container");
    const textbookContainer = document.getElementById("textbook-container");
    
    // Tabs
    const tabGraph = document.getElementById("tab-graph");
    const tabTextbook = document.getElementById("tab-textbook");
    const searchInput = document.getElementById("search-input");
    
    // Floating Popup Card Elements
    const nodePopup = document.getElementById("node-popup");
    const popupType = document.getElementById("popup-type");
    const popupTitle = document.getElementById("popup-title");
    const popupPath = document.getElementById("popup-path");
    const popupContent = document.getElementById("popup-content");
    const popupCloseBtn = document.getElementById("popup-close-btn");
    const popupOpenModalBtn = document.getElementById("popup-open-modal-btn");
    
    // Controls
    const btnTheme = document.getElementById("btn-theme");
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

    // Textbook Viewer Elements
    const textbookToc = document.getElementById("textbook-toc");
    const textbookContentCard = document.getElementById("textbook-content-card");

    let width = container.clientWidth;
    let height = container.clientHeight;
    let activePopupNode = null;
    let currentView = "graph"; // "graph" or "textbook"
    let physicsEnabled = true;

    // Handle window resize
    window.addEventListener("resize", () => {
        width = container.clientWidth;
        height = container.clientHeight;
        svg.attr("width", width).attr("height", height);
        updatePopupPosition();
    });

    // 3. Node Type Colors & Dimensions
    const typeRadius = {
        "course": 38,
        "unit": 28
    };

    const rectH = 34; // Constant height for all rectangles

    // Dynamic width helper based on text length
    function getRectWidth(title) {
        return Math.max(120, title.length * 7.5 + 24);
    }

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

    // Active nodes/links
    let visibleNodes = [];
    let visibleLinks = [];

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

    // 4. Horizontal Tree Force Simulation Setup
    // By adding a strong forceX targeting depth columns, we get a left-to-right tree layout!
    const simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(d => {
            const targetType = d.target.node_type;
            if (targetType === "unit") return 140;
            if (targetType === "topic") return 110;
            return 80;
        }))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("x", d3.forceX(d => 100 + d.depth * 240).strength(2.0)) // Strong X-column forces
        .force("y", d3.forceY(height / 2).strength(0.25)) // Pull towards vertical center
        .force("collision", d3.forceCollide().radius(d => {
            if (d.node_type === "course" || d.node_type === "unit") {
                return (typeRadius[d.node_type] || 12) + 20;
            }
            // Dynamic collision radius based on computed rectangle width
            const halfW = getRectWidth(d.title) / 2;
            return Math.max(halfW + 15, 60);
        }).strength(0.9));

    // Drag behavior
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

        // Map existing coordinates
        const nodeMap = new Map(visibleNodes.map(d => [d.id, d]));
        nodesList.forEach(node => {
            const oldNode = nodeMap.get(node.id);
            if (oldNode) {
                node.x = oldNode.x;
                node.y = oldNode.y;
                node.vx = oldNode.vx;
                node.vy = oldNode.vy;
            } else {
                // Determine layout column positions
                node.x = 100 + node.depth * 240 + (Math.random() - 0.5) * 10;
                node.y = node.parent && oldNode ? oldNode.y : height / 2 + (Math.random() - 0.5) * 200;
            }
        });

        visibleNodes = nodesList;
        visibleLinks = linksList;

        // Render Links
        let linkElements = g.selectAll(".link")
            .data(visibleLinks, d => `${d.source}-${d.target}`);

        linkElements.exit().remove();

        const linkEnter = linkElements.enter().append("line")
            .attr("class", "link")
            .attr("stroke", "#bcc1c6")
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.25);

        linkElements = linkEnter.merge(linkElements);

        // Render Nodes Group
        let nodeElements = g.selectAll(".node")
            .data(visibleNodes, d => d.id);

        nodeElements.exit().remove();

        const nodeEnter = nodeElements.enter().append("g")
            .attr("class", d => `node node-${d.node_type}`)
            .call(drag(simulation));

        // Shape Branching: CIRCLES for Course & Unit
        const circles = nodeEnter.filter(d => d.node_type === "course" || d.node_type === "unit");
        
        circles.append("circle")
            .attr("class", "node-circle")
            .attr("r", d => typeRadius[d.node_type])
            .attr("fill", d => d.node_type === "course" ? "rgba(66, 133, 244, 0.1)" : "rgba(234, 67, 53, 0.1)")
            .attr("stroke", d => typeColors[d.node_type]);

        circles.append("text")
            .attr("class", "node-label")
            .attr("dy", d => typeRadius[d.node_type] + 16)
            .attr("text-anchor", "middle")
            .attr("font-size", d => d.node_type === "course" ? "13px" : "12px")
            .text(d => d.title);

        // Shape Branching: RECTANGLES for Topics, Subtopics, Concepts, & Leaf Blobs
        const rects = nodeEnter.filter(d => 
            d.node_type !== "course" && d.node_type !== "unit"
        );

        rects.append("rect")
            .attr("class", "node-rect")
            .attr("x", d => -getRectWidth(d.title) / 2)
            .attr("y", -rectH / 2)
            .attr("width", d => getRectWidth(d.title))
            .attr("height", rectH)
            .attr("rx", 8)
            .attr("ry", 8)
            .attr("stroke", d => typeColors[d.node_type]);

        rects.append("text")
            .attr("class", "node-rect-text")
            .attr("dy", 4)
            .attr("text-anchor", "middle")
            .text(d => d.title);

        nodeElements = nodeEnter.merge(nodeElements);

        // Class toggle for collapsed styles
        nodeElements.classed("has-children-collapsed", d => d.children && d.children.length > 0 && !d.expanded);

        // Bind interactions
        nodeElements.on("click", (event, d) => {
            event.stopPropagation();
            if (d.children && d.children.length > 0) {
                d.expanded = !d.expanded;
                updateGraph();
            }
            showPopup(d, event.currentTarget);
        });

        nodeElements.on("dblclick", (event, d) => {
            event.stopPropagation();
            showFullContent(d);
        });

        simulation.nodes(visibleNodes);
        simulation.force("link").links(visibleLinks);
        
        if (physicsEnabled) {
            simulation.alpha(0.3).restart();
        } else {
            simulation.stop();
            tickActions();
        }
    }

    // Tick layout positioning
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

    // 6. Connected Preview Popup Card Operations
    function showPopup(node, nodeElement) {
        activePopupNode = node;
        
        g.selectAll(".node-circle").attr("stroke-width", 2.5);
        g.selectAll(".node-rect").attr("stroke-width", 1.5);
        
        d3.select(nodeElement).select(".node-circle").attr("stroke-width", 4.5);
        d3.select(nodeElement).select(".node-rect").attr("stroke-width", 3);

        popupType.className = `badge ${node.node_type}`;
        popupType.textContent = node.node_type.replace("_", " ");
        popupTitle.textContent = node.title;

        // Paths
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

        // Preview content
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

        nodePopup.classList.remove("hidden");
        updatePopupPosition();
    }

    function updatePopupPosition() {
        if (!activePopupNode) return;
        
        const nodeEl = g.selectAll(".node").filter(d => d.id === activePopupNode.id).node();
        if (!nodeEl) return;
        
        const rect = nodeEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        const left = rect.left - containerRect.left + rect.width / 2;
        const top = rect.top - containerRect.top;
        
        nodePopup.style.left = `${left}px`;
        nodePopup.style.top = `${top}px`;
    }

    function closePopup() {
        activePopupNode = null;
        nodePopup.classList.add("hidden");
        g.selectAll(".node-circle").attr("stroke-width", 2.5);
        g.selectAll(".node-rect").attr("stroke-width", 1.5);
    }

    popupCloseBtn.addEventListener("click", closePopup);
    
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

    // 8. Global Theme Toggle
    btnTheme.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark-theme");
        btnTheme.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        btnTheme.title = isDark ? "Toggle Light Theme" : "Toggle Dark Theme";
    });

    // 9. Tab View Switching
    tabGraph.addEventListener("click", () => {
        if (currentView === "graph") return;
        currentView = "graph";
        tabGraph.classList.add("active");
        tabTextbook.classList.remove("active");
        
        container.classList.remove("hidden");
        textbookContainer.classList.add("hidden");
        searchInput.disabled = false;
        
        // Show zoom buttons
        document.querySelectorAll(".graph-actions > button:not(#btn-theme)").forEach(b => b.classList.remove("hidden"));
        document.getElementById("physics-divider").classList.remove("hidden");
    });

    tabTextbook.addEventListener("click", () => {
        if (currentView === "textbook") return;
        currentView = "textbook";
        tabTextbook.classList.add("active");
        tabGraph.classList.remove("active");
        
        container.classList.add("hidden");
        textbookContainer.classList.remove("hidden");
        searchInput.disabled = true;
        closePopup();
        
        // Hide graph actions
        document.querySelectorAll(".graph-actions > button:not(#btn-theme)").forEach(b => b.classList.add("hidden"));
        document.getElementById("physics-divider").classList.add("hidden");

        renderTextbookTOC();
    });

    // 10. Textbook Reader Dynamic Logic
    function renderTextbookTOC() {
        textbookToc.innerHTML = "";
        
        // Loop through units
        hierarchyData.children.forEach(unit => {
            const unitItem = document.createElement("div");
            unitItem.className = "toc-unit-item";
            unitItem.innerHTML = `<span><i class="fa-solid fa-folder-open"></i> ${unit.title}</span> <i class="fa-solid fa-chevron-down"></i>`;
            textbookToc.appendChild(unitItem);

            const childrenContainer = document.createElement("div");
            childrenContainer.className = "toc-unit-children";
            textbookToc.appendChild(childrenContainer);

            // Populate unit topics
            unit.children.forEach(topic => {
                const topicItem = document.createElement("div");
                topicItem.className = "toc-topic-item";
                topicItem.innerHTML = `<i class="fa-regular fa-file-lines"></i> ${topic.title}`;
                topicItem.addEventListener("click", () => {
                    // Remove active from all
                    document.querySelectorAll(".toc-topic-item").forEach(item => item.classList.remove("active"));
                    topicItem.classList.add("active");
                    renderTextbookContent(topic);
                });
                childrenContainer.appendChild(topicItem);
            });

            // Toggle collapsibility of units in TOC
            unitItem.addEventListener("click", () => {
                const isHidden = childrenContainer.classList.toggle("hidden");
                unitItem.querySelector(".fa-chevron-down").style.transform = isHidden ? "rotate(-90deg)" : "rotate(0deg)";
            });
        });
    }

    function renderTextbookContent(node) {
        textbookContentCard.innerHTML = "";

        // Header / Path breadcrumbs
        const path = document.createElement("div");
        path.className = "path-container";
        node.path.forEach((p, idx) => {
            const span = document.createElement("span");
            span.textContent = p;
            path.appendChild(span);
            if (idx < node.path.length - 1) {
                path.appendChild(document.createTextNode(" > "));
            }
        });
        textbookContentCard.appendChild(path);

        // Generate dynamic HTML from this node downwards recursively
        function renderNodeText(item) {
            const wrapper = document.createElement("div");
            wrapper.style.marginBottom = "30px";

            // Heading based on node type
            let headerTag = "h4";
            let headingClass = "tb-concept-header";
            
            if (item.node_type === "unit") {
                headerTag = "h1";
                headingClass = "tb-unit-header";
            } else if (item.node_type === "topic") {
                headerTag = "h2";
                headingClass = "tb-topic-header";
            } else if (item.node_type === "subtopic") {
                headerTag = "h3";
                headingClass = "tb-subtopic-header";
            }
            
            const titleEl = document.createElement(headerTag);
            titleEl.className = headingClass;
            titleEl.textContent = item.title;
            wrapper.appendChild(titleEl);

            // Append paragraphs
            if (item.content && item.content.length > 0) {
                let currentList = null;
                item.content.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed.length > 0) {
                        // Check for bullets/lists
                        if (trimmed.startsWith("●") || trimmed.startsWith("•") || trimmed.startsWith("o") || trimmed.match(/^\d+\./)) {
                            if (!currentList) {
                                currentList = document.createElement("ul");
                                currentList.className = "tb-bullet-list";
                                wrapper.appendChild(currentList);
                            }
                            const li = document.createElement("li");
                            li.className = "tb-bullet-item";
                            li.textContent = line;
                            currentList.appendChild(li);
                        } else {
                            currentList = null;
                            const p = document.createElement("p");
                            p.className = "tb-paragraph";
                            p.textContent = line;
                            wrapper.appendChild(p);
                        }
                    }
                });
            }

            // Recurse down children to display entire hierarchy of the topic
            if (item.children && item.children.length > 0) {
                item.children.forEach(child => {
                    wrapper.appendChild(renderNodeText(child));
                });
            }

            return wrapper;
        }

        const formattedContent = renderNodeText(node);
        textbookContentCard.appendChild(formattedContent);
    }

    // 11. Zoom and Controls Actions
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

        const padding = 100;
        const graphW = (maxX - minX) || 100;
        const graphH = (maxY - minY) || 100;
        
        const scale = Math.min(
            (width - padding * 2) / graphW,
            (height - padding * 2) / graphH
        );

        const boundedScale = Math.max(0.15, Math.min(scale, 1.8));
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const transform = d3.zoomIdentity
            .translate(width / 2 - boundedScale * midX, height / 2 - boundedScale * midY)
            .scale(boundedScale);

        svg.transition().duration(500).call(zoom.transform, transform);
    });

    btnReset.addEventListener("click", () => {
        function collapseAll(node) {
            node.expanded = (node.id === "course" || node.node_type === "unit");
            if (node.children) {
                node.children.forEach(collapseAll);
            }
        }
        collapseAll(hierarchyData);
        
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

    // 12. Real-time Search
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
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

        g.selectAll(".node")
            .style("opacity", d => matchedNodeIds.has(d.id) ? 1 : 0.15);

        g.selectAll(".link")
            .style("opacity", d => matchedNodeIds.has(d.source.id) && matchedNodeIds.has(d.target.id) ? 0.65 : 0.05);
    });

    // Run graph startup
    updateGraph();
});
