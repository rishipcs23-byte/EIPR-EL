/**
 * EIPR Knowledge Explorer - Frontend Logic
 * Dual-Mode Visualizations (Knowledge Tree & Fog of War), Collapsible TOC, textbook navigation.
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
    
    // START STATE: Expand Course (root) only. Keep Units collapsed by default.
    hierarchyData.expanded = true;

    // 2. DOM Elements Selection
    const svg = d3.select("#graph-svg");
    const container = document.getElementById("graph-container");
    const textbookContainer = document.getElementById("textbook-container");
    
    // Tabs
    const tabTree = document.getElementById("tab-tree");
    const tabFog = document.getElementById("tab-fog");
    const tabTextbook = document.getElementById("tab-textbook");
    const tabNotes = document.getElementById("tab-notes");
    const tabSpace = document.getElementById("tab-space");
    const searchInput = document.getElementById("search-input");
    const notesContainer = document.getElementById("notes-container");
    const spaceContainer = document.getElementById("space-container");
    
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
    const btnCollapse = document.getElementById("btn-collapse");
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
    let currentView = "tree"; // "tree", "fog", or "textbook"
    let physicsEnabled = true;

    // Handle window resize
    window.addEventListener("resize", () => {
        width = container.clientWidth;
        height = container.clientHeight;
        svg.attr("width", width).attr("height", height);
        updatePopupPosition();
    });

    // 3. Radius & Dimensions Configuration
    const typeRadius = {
        "course": 38,
        "unit": 28
    };

    const rectH = 34; // Constant height for rectangles

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

    // Helper to wrap text dynamically at a max length
    function getWrappedLines(title, maxCharsPerLine = 22) {
        const words = title.split(/\s+/);
        const lines = [];
        let currentLine = "";
        
        words.forEach(word => {
            if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
                currentLine = (currentLine + " " + word).trim();
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });
        if (currentLine) lines.push(currentLine);
        return lines;
    }

    function getNodeDimensions(node) {
        const lines = getWrappedLines(node.title, 22);
        const maxLen = Math.max(...lines.map(l => l.length));
        const w = Math.max(110, Math.min(250, maxLen * 7.5 + 24));
        const h = Math.max(34, lines.length * 13 + 14);
        return { w, h, lines };
    }

    // Active nodes and links
    let visibleNodes = [];
    let visibleLinks = [];

    // Create main SVG group for zooming/panning
    const g = svg.append("g").attr("class", "graph-content");
    // Layer for cluster hulls (drawn behind nodes)
    const hullLayer = g.append("g").attr("class", "hull-layer");

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
            updatePopupPosition();
        });

    svg.call(zoom);

    // 4. Force Simulation Setup — sluggish/smooth physics
    const simulation = d3.forceSimulation()
        .alphaDecay(0.035)          // slow decay so it settles gradually
        .velocityDecay(0.72)        // high friction = less bounce/jumping
        .force("link", d3.forceLink().id(d => d.id).distance(d => {
            if (currentView === "tree") {
                const targetType = d.target.node_type;
                if (targetType === "unit") return 150;
                if (targetType === "topic") return 120;
                return 85;
            } else {
                return 65;
            }
        }).strength(0.45))          // softer link springs
        .force("charge", d3.forceManyBody().strength(d => {
            if (currentView === "tree") return -180;
            return d.node_type === "course" ? -700 : -130;
        }).theta(0.9))
        .force("x", d3.forceX(width / 2).strength(d => currentView === "fog" ? 0.04 : 0))
        .force("y", d3.forceY(height / 2).strength(d => currentView === "fog" ? 0.04 : 0.18))
        .force("collision", d3.forceCollide().radius(d => {
            if (d.node_type === "course" || d.node_type === "unit") {
                return typeRadius[d.node_type] + 22;
            }
            const dim = getNodeDimensions(d);
            return Math.max(dim.w / 2 + 14, dim.h / 2 + 18);
        }).strength(0.7).iterations(2));

    // Drag behavior
    function drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active && physicsEnabled) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
            closePopup();
        }
        
        function dragged(event, d) {
            if (currentView === "tree") {
                // Constrained column position in tree mode
                if (d.node_type === "course") d.fx = 80;
                else if (d.node_type === "unit") d.fx = 240;
                else if (d.node_type === "topic") {
                    const col = d.parent.children.indexOf(d) % 2;
                    d.fx = 420 + col * 185;
                } else if (d.node_type === "subtopic") d.fx = 800;
                else if (d.node_type === "concept") d.fx = 1000;
                else d.fx = 1200;
            } else {
                d.fx = event.x;
            }
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

        // Map existing positions
        const nodeMap = new Map(visibleNodes.map(d => [d.id, d]));
        nodesList.forEach(node => {
            const oldNode = nodeMap.get(node.id);
            if (oldNode) {
                node.x = oldNode.x;
                node.y = oldNode.y;
                node.vx = oldNode.vx;
                node.vy = oldNode.vy;
            } else {
                if (currentView === "tree") {
                    if (node.node_type === "course") node.x = 80;
                    else if (node.node_type === "unit") node.x = 240;
                    else if (node.node_type === "topic") {
                        const col = node.parent.children.indexOf(node) % 2;
                        node.x = 420 + col * 185;
                    } else if (node.node_type === "subtopic") node.x = 800;
                    else if (node.node_type === "concept") node.x = 1000;
                    else node.x = 1200;
                } else {
                    node.x = width / 2 + (Math.random() - 0.5) * 200;
                }
                node.y = node.parent && oldNode ? oldNode.y : height / 2 + (Math.random() - 0.5) * 200;
            }
        });

        visibleNodes = nodesList;
        visibleLinks = linksList;

        // ─── Cluster Hull Containers (translucent yellow behind topics) ─────
        if (currentView === "tree") {
            // Build map: unitId -> topic nodes
            const topicsByUnit = new Map();
            nodesList.forEach(n => {
                if (n.node_type === "topic" && n.parent) {
                    const uid = n.parent.id;
                    if (!topicsByUnit.has(uid)) topicsByUnit.set(uid, []);
                    topicsByUnit.get(uid).push(n);
                }
            });

            // One hull rect per unit that has visible topics
            const hullData = Array.from(topicsByUnit.entries())
                .filter(([, topics]) => topics.length > 0)
                .map(([uid, topics]) => ({ uid, topics }));

            const hulls = hullLayer.selectAll(".topic-cluster-hull")
                .data(hullData, d => d.uid);

            hulls.exit().remove();

            hulls.enter().append("rect")
                .attr("class", "topic-cluster-hull")
                .merge(hulls)
                // Actual positioning is updated in tickActions via data bound
                .attr("fill", "rgba(251, 188, 5, 0.10)")
                .attr("stroke", "rgba(251, 188, 5, 0.45)")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "6 3")
                .attr("rx", 14)
                .attr("ry", 14)
                .attr("pointer-events", "none")
                // Position will be updated in tickActions
                .each(function(d) { d._hullEl = this; });
        } else {
            hullLayer.selectAll(".topic-cluster-hull").remove();
        }

        // Render Links (Path curved S-curve or straight line based on tab view)
        let linkElements = g.selectAll(".link")
            .data(visibleLinks, d => `${d.source}-${d.target}`);

        linkElements.exit().remove();

        const linkEnter = linkElements.enter().append("path")
            .attr("class", "link")
            .attr("stroke", "#bcc1c6")
            .attr("stroke-width", 1.5)
            .attr("stroke-opacity", 0.25)
            .attr("fill", "none");

        linkElements = linkEnter.merge(linkElements);

        // Render Nodes Group
        let nodeElements = g.selectAll(".node")
            .data(visibleNodes, d => d.id);

        nodeElements.exit().remove();

        const nodeEnter = nodeElements.enter().append("g")
            .attr("class", d => `node node-${d.node_type}`)
            .call(drag(simulation));

        // CIRCLES for Course & Unit
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

        // RECTANGLES for Topics, Subtopics, Concepts & Leaves
        const rects = nodeEnter.filter(d => 
            d.node_type !== "course" && d.node_type !== "unit"
        );

        rects.append("rect")
            .attr("class", "node-rect")
            .attr("x", d => -getNodeDimensions(d).w / 2)
            .attr("y", d => -getNodeDimensions(d).h / 2)
            .attr("width", d => getNodeDimensions(d).w)
            .attr("height", d => getNodeDimensions(d).h)
            .attr("rx", 8)
            .attr("ry", 8)
            .attr("stroke", d => typeColors[d.node_type]);

        rects.append("text")
            .attr("class", "node-rect-text")
            .attr("text-anchor", "middle")
            .each(function(d) {
                const textNode = d3.select(this);
                const dims = getNodeDimensions(d);
                const startDy = -((dims.lines.length - 1) * 13) / 2 + 4;
                
                dims.lines.forEach((line, idx) => {
                    textNode.append("tspan")
                        .attr("x", 0)
                        .attr("dy", idx === 0 ? `${startDy}px` : "13px")
                        .text(line);
                });
            });

        nodeElements = nodeEnter.merge(nodeElements);

        nodeElements.classed("has-children-collapsed", d => d.children && d.children.length > 0 && !d.expanded);

        // ─── Fog of War: Apply visual state classes ───
        if (currentView === "fog" && typeof FogGuide !== "undefined") {
            nodeElements
                .classed("fog-locked", d => {
                    if (d.node_type === "course" || d.node_type === "unit") return false;
                    return !FogGuide.isTopicUnlocked(d.id);
                })
                .classed("fog-recommended", d => {
                    return FogGuide.getTopicState(d.id) === 'recommended';
                })
                .classed("fog-completed", d => {
                    return FogGuide.getTopicState(d.id) === 'completed';
                })
                .classed("fog-open", d => {
                    return FogGuide.getTopicState(d.id) === 'open';
                });

            // Apply fog link classes
            linkElements
                .classed("fog-locked-link", d => {
                    const tgt = typeof d.target === 'object' ? d.target : visibleNodes.find(n => n.id === d.target);
                    if (!tgt) return false;
                    if (tgt.node_type === "course" || tgt.node_type === "unit") return false;
                    return !FogGuide.isTopicUnlocked(tgt.id);
                })
                .classed("fog-active-link", d => {
                    const tgt = typeof d.target === 'object' ? d.target : visibleNodes.find(n => n.id === d.target);
                    if (!tgt) return false;
                    return FogGuide.getTopicState(tgt.id) === 'recommended';
                });
        } else {
            // Clear fog classes when not in fog view
            nodeElements
                .classed("fog-locked", false)
                .classed("fog-recommended", false)
                .classed("fog-completed", false)
                .classed("fog-open", false);
        }

        // Interactions
        nodeElements.on("click", (event, d) => {
            event.stopPropagation();

            // Fog of War: block interaction on locked nodes
            if (currentView === "fog" && typeof FogGuide !== "undefined") {
                if (d.node_type !== "course" && d.node_type !== "unit" && !FogGuide.isTopicUnlocked(d.id)) {
                    return; // locked — no interaction
                }
                // Track last opened
                FogGuide.setLastOpened(d.id);
            }

            if (d.children && d.children.length > 0) {
                d.expanded = !d.expanded;
                updateGraph();
            }
            showPopup(d, event.currentTarget);
        });

        nodeElements.on("dblclick", (event, d) => {
            event.stopPropagation();
            // Fog of War: block dblclick on locked nodes
            if (currentView === "fog" && typeof FogGuide !== "undefined") {
                if (d.node_type !== "course" && d.node_type !== "unit" && !FogGuide.isTopicUnlocked(d.id)) {
                    return;
                }
            }
            showFullContent(d);
        });

        simulation.nodes(visibleNodes);
        simulation.force("link").links(visibleLinks);
        
        // Update simulation parameters based on layout mode
        if (currentView === "tree") {
            simulation.force("x", null);
            simulation.force("y", d3.forceY(height / 2).strength(0.25));
        } else {
            simulation.force("x", d3.forceX(width / 2).strength(0.05));
            simulation.force("y", d3.forceY(height / 2).strength(0.05));
        }

        if (physicsEnabled) {
            // Gentle restart — low alpha means slower, smoother settling
            simulation.alphaTarget(0.04).alpha(0.25).restart();
            setTimeout(() => simulation.alphaTarget(0), 2200); // let it glide to rest
        } else {
            simulation.stop();
            tickActions();
        }
    }

    // Tick layout positioning
    function tickActions() {
        if (currentView === "tree") {
            const PAD = 18; // cluster hull padding

            g.selectAll(".node").each(d => {
                if (d.node_type === "course") d.x = 80;
                else if (d.node_type === "unit") d.x = 240;
                else if (d.node_type === "topic") {
                    // 2-column grid per unit
                    const col = d.parent.children.indexOf(d) % 2;
                    d.x = 420 + col * 195;
                }
                else if (d.node_type === "subtopic") d.x = 840;
                else if (d.node_type === "concept") d.x = 1050;
                else d.x = 1260;

                d.vx = 0;
            });

            // Update cluster hull rects
            hullLayer.selectAll(".topic-cluster-hull").each(function(d) {
                if (!d.topics || d.topics.length === 0) return;
                const xs = d.topics.map(t => t.x);
                const ys = d.topics.map(t => t.y);
                const dims = d.topics.map(t => getNodeDimensions(t));
                const minX = d3.min(xs.map((x, i) => x - dims[i].w / 2)) - PAD;
                const maxX = d3.max(xs.map((x, i) => x + dims[i].w / 2)) + PAD;
                const minY = d3.min(ys.map((y, i) => y - dims[i].h / 2)) - PAD;
                const maxY = d3.max(ys.map((y, i) => y + dims[i].h / 2)) + PAD;
                d3.select(this)
                    .attr("x", minX)
                    .attr("y", minY)
                    .attr("width", maxX - minX)
                    .attr("height", maxY - minY);
            });

            g.selectAll(".link")
                .attr("d", d => {
                    const x1 = d.source.x;
                    const y1 = d.source.y;
                    const x2 = d.target.x;
                    const y2 = d.target.y;
                    // S-curved horizontal links
                    return `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
                });
        } else {
            // Curved arc lines for Fog of War mode
            g.selectAll(".link")
                .attr("d", d => {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
                    return `M ${d.source.x} ${d.source.y} A ${dr} ${dr} 0 0 1 ${d.target.x} ${d.target.y}`;
                });
        }

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

        // Path
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
                        p.className = "tb-paragraph";
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
            navigateToTextbook(activePopupNode);
        }
    });

    // 8. Navigation link from Graph Popups to Textbook Reader
    function navigateToTextbook(node) {
        let topicNode = node;
        while (topicNode.depth > 2 && topicNode.parent) {
            topicNode = topicNode.parent;
        }

        tabTextbook.click();

        // Expand nested TOC containers corresponding to path
        let current = node;
        const idsToOpen = [];
        while (current) {
            idsToOpen.push(current.id);
            current = current.parent;
        }

        idsToOpen.reverse().forEach(id => {
            const tocRow = document.querySelector(`[data-toc-id="${id}"]`);
            if (tocRow) {
                const childrenBox = tocRow.nextElementSibling;
                if (childrenBox && childrenBox.classList.contains("toc-children-box")) {
                    childrenBox.style.maxHeight = "1000px";
                    const chevron = tocRow.querySelector(".toc-chevron");
                    if (chevron) chevron.classList.add("open");
                }
            }
        });

        document.querySelectorAll(".toc-header-row").forEach(row => row.classList.remove("active"));
        const activeTopicRow = document.querySelector(`[data-toc-id="${topicNode.id}"]`);
        if (activeTopicRow) activeTopicRow.classList.add("active");

        renderTextbookContent(topicNode);

        setTimeout(() => {
            const element = document.getElementById(`reader-${node.id}`);
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "start" });
                element.classList.add("highlight-flash");
                setTimeout(() => element.classList.remove("highlight-flash"), 2500);
            }
        }, 80);
    }

    // 9. Global Theme Toggle
    btnTheme.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark-theme");
        btnTheme.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        btnTheme.title = isDark ? "Toggle Light Theme" : "Toggle Dark Theme";
    });

    // 10. Tab View Switching
    tabTree.addEventListener("click", () => {
        if (currentView === "tree") return;
        currentView = "tree";
        tabTree.classList.add("active");
        tabFog.classList.remove("active");
        tabTextbook.classList.remove("active");
        tabNotes.classList.remove("active");
        tabSpace.classList.remove("active");
        
        container.classList.remove("hidden");
        textbookContainer.classList.add("hidden");
        notesContainer.classList.add("hidden");
        spaceContainer.classList.add("hidden");
        searchInput.disabled = false;
        
        document.querySelectorAll(".graph-actions > button:not(#btn-theme)").forEach(b => b.classList.remove("hidden"));
        document.getElementById("physics-divider").classList.remove("hidden");

        // Hide fog dashboard and guide panel
        const fogDash = document.getElementById("fog-dashboard");
        if (fogDash) fogDash.classList.add("hidden");
        const fogGuidePanel = document.getElementById("fog-guide-panel");
        if (fogGuidePanel) fogGuidePanel.classList.remove("open");
        container.classList.remove("fog-view-active");

        if (typeof SpaceExplorer !== "undefined") {
            SpaceExplorer.pause();
        }
        
        closePopup();
        updateGraph();
    });

    tabFog.addEventListener("click", () => {
        if (currentView === "fog") return;
        currentView = "fog";
        tabFog.classList.add("active");
        tabTree.classList.remove("active");
        tabTextbook.classList.remove("active");
        tabNotes.classList.remove("active");
        tabSpace.classList.remove("active");
        
        container.classList.remove("hidden");
        textbookContainer.classList.add("hidden");
        notesContainer.classList.add("hidden");
        spaceContainer.classList.add("hidden");
        searchInput.disabled = false;
        
        document.querySelectorAll(".graph-actions > button:not(#btn-theme)").forEach(b => b.classList.remove("hidden"));
        document.getElementById("physics-divider").classList.remove("hidden");

        // Show fog dashboard, hide regular legend
        const fogDash = document.getElementById("fog-dashboard");
        if (fogDash) fogDash.classList.remove("hidden");
        container.classList.add("fog-view-active");

        // Initialize FogGuide if available
        if (typeof FogGuide !== "undefined") {
            FogGuide.init(hierarchyData);
        }

        if (typeof SpaceExplorer !== "undefined") {
            SpaceExplorer.pause();
        }
        
        closePopup();

        // Auto-expand all units for fog view
        hierarchyData.expanded = true;
        if (hierarchyData.children) {
            hierarchyData.children.forEach(unit => {
                unit.expanded = true;
            });
        }

        updateGraph();
    });

    tabTextbook.addEventListener("click", () => {
        if (currentView === "textbook") return;
        currentView = "textbook";
        tabTextbook.classList.add("active");
        tabTree.classList.remove("active");
        tabFog.classList.remove("active");
        tabNotes.classList.remove("active");
        tabSpace.classList.remove("active");
        
        container.classList.add("hidden");
        textbookContainer.classList.remove("hidden");
        notesContainer.classList.add("hidden");
        spaceContainer.classList.add("hidden");
        searchInput.disabled = true;
        closePopup();
        
        document.querySelectorAll(".graph-actions > button:not(#btn-theme)").forEach(b => b.classList.add("hidden"));
        document.getElementById("physics-divider").classList.add("hidden");

        if (typeof SpaceExplorer !== "undefined") {
            SpaceExplorer.pause();
        }

        renderTextbookTOC();
    });

    tabNotes.addEventListener("click", () => {
        if (currentView === "notes") return;
        currentView = "notes";
        tabNotes.classList.add("active");
        tabTree.classList.remove("active");
        tabFog.classList.remove("active");
        tabTextbook.classList.remove("active");
        tabSpace.classList.remove("active");
        
        container.classList.add("hidden");
        textbookContainer.classList.add("hidden");
        notesContainer.classList.remove("hidden");
        spaceContainer.classList.add("hidden");
        searchInput.disabled = true;
        closePopup();
        
        document.querySelectorAll(".graph-actions > button:not(#btn-theme)").forEach(b => b.classList.add("hidden"));
        document.getElementById("physics-divider").classList.add("hidden");

        // Hide fog dashboard and guide panel
        const fogDash = document.getElementById("fog-dashboard");
        if (fogDash) fogDash.classList.add("hidden");
        const fogGuidePanel = document.getElementById("fog-guide-panel");
        if (fogGuidePanel) fogGuidePanel.classList.remove("open");
        container.classList.remove("fog-view-active");

        if (typeof SpaceExplorer !== "undefined") {
            SpaceExplorer.pause();
        }

        initNotesView();
    });

    tabSpace.addEventListener("click", () => {
        if (currentView === "space") return;
        currentView = "space";
        tabSpace.classList.add("active");
        tabTree.classList.remove("active");
        tabFog.classList.remove("active");
        tabTextbook.classList.remove("active");
        tabNotes.classList.remove("active");
        
        container.classList.add("hidden");
        textbookContainer.classList.add("hidden");
        notesContainer.classList.add("hidden");
        spaceContainer.classList.remove("hidden");
        searchInput.disabled = true;
        closePopup();
        
        document.querySelectorAll(".graph-actions > button:not(#btn-theme)").forEach(b => b.classList.add("hidden"));
        document.getElementById("physics-divider").classList.add("hidden");

        // Hide fog dashboard and guide panel
        const fogDash = document.getElementById("fog-dashboard");
        if (fogDash) fogDash.classList.add("hidden");
        const fogGuidePanel = document.getElementById("fog-guide-panel");
        if (fogGuidePanel) fogGuidePanel.classList.remove("open");
        container.classList.remove("fog-view-active");

        if (typeof SpaceExplorer !== "undefined") {
            SpaceExplorer.init(hierarchyData);
        }
    });e");

        initNotesView();
    });

    // 10b. Short Notes View Logic
    let notesInitialized = false;
    function initNotesView() {
        if (notesInitialized) return;
        notesInitialized = true;

        const notesTocItems = document.querySelectorAll(".notes-toc-item");
        const notesFrame = document.getElementById("notes-frame");
        const pdfToggleContainer = document.getElementById("pdf-toggle-container");
        const notesViewHtmlBtn = document.getElementById("notes-view-html");
        const notesViewPdfBtn = document.getElementById("notes-view-pdf");

        let currentSelectedUnitItem = document.querySelector(".notes-toc-item.active");
        let currentSelectedMode = "html";

        function updateNotesContent() {
            if (!currentSelectedUnitItem) return;
            const sourceHtml = currentSelectedUnitItem.getAttribute("data-source");
            const sourcePdf = currentSelectedUnitItem.getAttribute("data-pdf");

            // If the item has a PDF option, show the mode toggle
            if (sourcePdf) {
                pdfToggleContainer.classList.remove("hidden");
            } else {
                pdfToggleContainer.classList.add("hidden");
                // If it's a PDF-only resource (like Unit 5), we use "pdf" mode
                if (sourceHtml && sourceHtml.toLowerCase().endsWith(".pdf")) {
                    currentSelectedMode = "pdf";
                } else {
                    currentSelectedMode = "html";
                }
            }

            // Apply active class to mode buttons
            if (currentSelectedMode === "html") {
                notesViewHtmlBtn.classList.add("active");
                notesViewPdfBtn.classList.remove("active");
                notesFrame.src = sourceHtml;
            } else {
                notesViewHtmlBtn.classList.remove("active");
                notesViewPdfBtn.classList.add("active");
                notesFrame.src = sourcePdf || sourceHtml; // Use sourceHtml if it is the PDF (e.g. Unit 5)
            }
        }

        notesTocItems.forEach(item => {
            item.addEventListener("click", () => {
                notesTocItems.forEach(i => i.classList.remove("active"));
                item.classList.add("active");
                currentSelectedUnitItem = item;
                
                // If the item has NO pdf, reset mode to html
                const src = item.getAttribute("data-source");
                const hasPdf = item.getAttribute("data-pdf");
                if (!hasPdf && !src.toLowerCase().endsWith(".pdf")) {
                    currentSelectedMode = "html";
                } else if (src.toLowerCase().endsWith(".pdf")) {
                    currentSelectedMode = "pdf";
                }
                
                updateNotesContent();
            });
        });

        notesViewHtmlBtn.addEventListener("click", () => {
            if (currentSelectedMode === "html") return;
            currentSelectedMode = "html";
            updateNotesContent();
        });

        notesViewPdfBtn.addEventListener("click", () => {
            if (currentSelectedMode === "pdf") return;
            currentSelectedMode = "pdf";
            updateNotesContent();
        });

        // Load initial content
        updateNotesContent();
    }

    // 11. Nested Collapsible Textbook Sidebar TOC
    function renderTextbookTOC() {
        textbookToc.innerHTML = "";

        function buildTOCNode(node, containerElement) {
            const itemContainer = document.createElement("div");
            itemContainer.className = "toc-item-container";

            const row = document.createElement("div");
            row.className = "toc-header-row";
            row.setAttribute("data-toc-id", node.id);

            let iconHtml = '<i class="fa-regular fa-file-lines"></i>';
            if (node.node_type === "unit") iconHtml = '<i class="fa-solid fa-book"></i>';
            else if (node.node_type === "topic") iconHtml = '<i class="fa-solid fa-folder-open"></i>';
            else if (node.node_type === "subtopic") iconHtml = '<i class="fa-solid fa-chevron-right" style="font-size:10px;"></i>';

            row.innerHTML = `<span>${iconHtml} ${node.title}</span>`;

            const hasChildren = node.children && node.children.length > 0;
            if (hasChildren) {
                const chevron = document.createElement("i");
                chevron.className = "fa-solid fa-chevron-right toc-chevron";
                row.appendChild(chevron);

                const childrenBox = document.createElement("div");
                childrenBox.className = "toc-children-box";
                childrenBox.style.maxHeight = "0px"; // Start collapsed

                chevron.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const isOpen = chevron.classList.toggle("open");
                    childrenBox.style.maxHeight = isOpen ? "1000px" : "0px";
                });

                row.addEventListener("click", () => {
                    document.querySelectorAll(".toc-header-row").forEach(r => r.classList.remove("active"));
                    row.classList.add("active");
                    
                    let topicNode = node;
                    while (topicNode.depth > 2 && topicNode.parent) {
                        topicNode = topicNode.parent;
                    }
                    renderTextbookContent(topicNode);

                    if (node.depth >= 2) {
                        setTimeout(() => {
                            const el = document.getElementById(`reader-${node.id}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 50);
                    }
                });

                itemContainer.appendChild(row);
                
                node.children.forEach(child => {
                    buildTOCNode(child, childrenBox);
                });
                itemContainer.appendChild(childrenBox);
            } else {
                row.addEventListener("click", () => {
                    document.querySelectorAll(".toc-header-row").forEach(r => r.classList.remove("active"));
                    row.classList.add("active");
                    
                    let topicNode = node;
                    while (topicNode.depth > 2 && topicNode.parent) {
                        topicNode = topicNode.parent;
                    }
                    renderTextbookContent(topicNode);

                    setTimeout(() => {
                        const el = document.getElementById(`reader-${node.id}`);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 50);
                });
                itemContainer.appendChild(row);
            }

            containerElement.appendChild(itemContainer);
        }

        hierarchyData.children.forEach(unit => {
            buildTOCNode(unit, textbookToc);
        });
    }

    // 12. Dynamic Ebook/Markdown Reader Rendering
    function renderTextbookContent(node) {
        textbookContentCard.innerHTML = "";

        // Path
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

        // Recursive text builder
        function renderNodeText(item) {
            const wrapper = document.createElement("div");
            wrapper.style.marginBottom = "30px";
            wrapper.id = `reader-${item.id}`;

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

            if (item.content && item.content.length > 0) {
                let currentList = null;
                item.content.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed.length > 0) {
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

    // 13. Zoom and Controls Actions
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
            node.expanded = (node.id === "course");
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

    // Collapse All
    btnCollapse.addEventListener("click", () => {
        function collapseAll(node) {
            node.expanded = (node.id === "course");
            if (node.children) {
                node.children.forEach(collapseAll);
            }
        }
        collapseAll(hierarchyData);
        closePopup();
        updateGraph();
        btnZoomFit.click();
    });

    btnPhysics.addEventListener("click", () => {
        physicsEnabled = !physicsEnabled;
        btnPhysics.classList.toggle("active", physicsEnabled);
        
        if (physicsEnabled) {
            simulation.alphaTarget(0.04).alpha(0.2).restart();
            setTimeout(() => simulation.alphaTarget(0), 2200);
        } else {
            simulation.stop();
        }
    });

    // 14. Real-time Search
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

    // ─── Fog of War: listen for progress updates to re-render ───
    window.addEventListener('fog-progress-updated', () => {
        if (currentView === 'fog') {
            updateGraph();
        }
    });

    // Reset progress button
    const fogResetBtn = document.getElementById('fog-reset-progress');
    if (fogResetBtn) {
        fogResetBtn.addEventListener('click', () => {
            if (confirm('Reset all learning progress? This cannot be undone.')) {
                if (typeof FogGuide !== 'undefined') {
                    FogGuide.resetProgress();
                }
            }
        });
    }

    // Run graph startup
    updateGraph();
});
