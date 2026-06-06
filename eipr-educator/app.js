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

    // Initialize default dark theme
    document.body.classList.add("dark-theme");
    if (btnTheme) {
        btnTheme.innerHTML = '<i class="fa-solid fa-sun"></i>';
        btnTheme.title = "Toggle Light Theme";
    }

    let preventAutoPopups = false;
    const autoOpenCheckbox = document.getElementById("popup-auto-open-checkbox");
    if (autoOpenCheckbox) {
        autoOpenCheckbox.addEventListener("change", (e) => {
            preventAutoPopups = e.target.checked;
        });
    }

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
    // 4.5 Aligned Deterministic Tree Layout Calculation
    function calculateTreeLayout() {
        if (visibleNodes.length === 0) return;

        let currentY = 50;
        const rowSpacing = 35; // vertical space between separate subtrees/rows
        const TOPIC_COLS = 3;
        const TOPIC_COL_WIDTH = 180; // px between topic columns
        const TOPIC_START_X = 480;
        const SUBTOPIC_X = TOPIC_START_X + TOPIC_COLS * TOPIC_COL_WIDTH + 10; // 480 + 540 + 10 = 1030
        const CONCEPT_X = SUBTOPIC_X + 220;
        const LEAF_X = CONCEPT_X + 210;

        function layoutNode(node) {
            if (!visibleNodes.includes(node)) return;

            // X coordinate assignment based on hierarchy depth/type
            if (node.node_type === "course") {
                node.targetX = 100;
            } else if (node.node_type === "unit") {
                node.targetX = 280;
            } else if (node.node_type === "topic") {
                const visibleTopics = (node.parent.children || []).filter(t => visibleNodes.includes(t));
                const col = visibleTopics.indexOf(node) % TOPIC_COLS;
                node.targetX = TOPIC_START_X + col * TOPIC_COL_WIDTH;
            } else if (node.node_type === "subtopic") {
                node.targetX = SUBTOPIC_X;
            } else if (node.node_type === "concept") {
                node.targetX = CONCEPT_X;
            } else {
                node.targetX = LEAF_X;
            }

            // Y coordinate assignment
            if (node.node_type === "unit") {
                const visibleTopics = (node.children || []).filter(t => visibleNodes.includes(t));
                if (node.expanded && visibleTopics.length > 0) {
                    const rows = [];
                    for (let i = 0; i < visibleTopics.length; i += TOPIC_COLS) {
                        rows.push(visibleTopics.slice(i, i + TOPIC_COLS));
                    }

                    const startY = currentY;
                    rows.forEach(row => {
                        const rowStartY = currentY;
                        let maxSubtreeY = rowStartY;

                        // Layout all topic children first
                        row.forEach(topic => {
                            currentY = rowStartY;
                            layoutChildren(topic);
                            if (currentY > maxSubtreeY) {
                                maxSubtreeY = currentY;
                            }
                        });

                        // Centered Y for the row of topics
                        const rowHeight = maxSubtreeY - rowStartY;
                        const rowY = rowStartY + Math.max(20, rowHeight / 2 - 10);
                        row.forEach(topic => {
                            topic.targetY = rowY;
                            const col = visibleTopics.indexOf(topic) % TOPIC_COLS;
                            topic.targetX = TOPIC_START_X + col * TOPIC_COL_WIDTH;
                        });

                        currentY = maxSubtreeY + rowSpacing;
                    });

                    // Centered Y for the unit node itself based on the range of its topic list
                    node.targetY = (startY + currentY - rowSpacing) / 2;
                } else {
                    node.targetY = currentY;
                    currentY += 90; // vertical space for a collapsed unit
                }
            } else {
                layoutChildren(node);
            }
        }

        function layoutChildren(node) {
            const visibleChildren = (node.children || []).filter(c => visibleNodes.includes(c));
            if (node.expanded && visibleChildren.length > 0) {
                const childYs = [];

                visibleChildren.forEach(child => {
                    layoutNode(child);
                    childYs.push(child.targetY);
                });

                // Centered Y relative to children
                node.targetY = (childYs[0] + childYs[childYs.length - 1]) / 2;
            } else {
                node.targetY = currentY;
                const dim = getNodeDimensions(node);
                currentY += dim.h + 24; // clean spacing based on actual dimensions
            }
        }

        // Run from course node (root)
        layoutNode(hierarchyData);
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

        // Map existing positions to preserve state or spawn nicely
        const nodeMap = new Map(visibleNodes.map(d => [d.id, d]));
        nodesList.forEach(node => {
            const oldNode = nodeMap.get(node.id);
            if (oldNode) {
                node.x = oldNode.x;
                node.y = oldNode.y;
                node.vx = oldNode.vx;
                node.vy = oldNode.vy;
            } else {
                // Spawn new nodes from parent's position for organic outward sliding animation
                if (currentView === "tree") {
                    if (node.parent && nodeMap.has(node.parent.id)) {
                        const parentNode = nodeMap.get(node.parent.id);
                        node.x = parentNode.x;
                        node.y = parentNode.y;
                    } else {
                        node.x = width / 2;
                        node.y = height / 2;
                    }
                } else {
                    node.x = width / 2 + (Math.random() - 0.5) * 200;
                    node.y = node.parent && oldNode ? oldNode.y : height / 2 + (Math.random() - 0.5) * 200;
                }
                node.vx = 0;
                node.vy = 0;
            }
        });

        visibleNodes = nodesList;
        visibleLinks = linksList;

        // Calculate targets if in tree view
        if (currentView === "tree") {
            calculateTreeLayout();
        }

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
                .attr("fill", "rgba(251, 188, 5, 0.10)")
                .attr("stroke", "rgba(251, 188, 5, 0.45)")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "6 3")
                .attr("rx", 14)
                .attr("ry", 14)
                .attr("pointer-events", "none")
                .each(function (d) { d._hullEl = this; });
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
            .each(function (d) {
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

        // Interactions
        nodeElements.on("click", (event, d) => {
            event.stopPropagation();
            const hasChildren = d.children && d.children.length > 0;
            if (hasChildren) {
                d.expanded = !d.expanded;
                updateGraph();
                if (!d.expanded) {
                    if (activePopupNode && activePopupNode.id === d.id) {
                        closePopup();
                    }
                    return; // Don't show popup when collapsing
                }
            }

            // Show popup if not prevented
            if (!preventAutoPopups) {
                showPopup(d, event.currentTarget);
            }
        });

        nodeElements.on("dblclick", (event, d) => {
            event.stopPropagation();
            showFullContent(d);
        });

        nodeElements.on("contextmenu", (event, d) => {
            event.preventDefault();
            event.stopPropagation();
            showNodeContextMenu(event.clientX, event.clientY, d, event.currentTarget);
        });

        simulation.nodes(visibleNodes);
        simulation.force("link").links(visibleLinks);

        // Update simulation parameters based on layout mode
        if (currentView === "tree") {
            // Disable all physical forces by setting their strengths to 0
            if (simulation.force("link")) simulation.force("link").strength(0);
            if (simulation.force("charge")) simulation.force("charge").strength(0);
            if (simulation.force("collision")) simulation.force("collision").strength(0);
            if (simulation.force("x")) simulation.force("x").strength(0);
            if (simulation.force("y")) simulation.force("y").strength(0);

            // Always run smooth animation transition
            simulation.alpha(0.35).restart();
        } else {
            // Restore Fog mode physical forces by adjusting existing configurations
            if (simulation.force("link")) {
                simulation.force("link")
                    .distance(65)
                    .strength(0.45);
            }
            if (simulation.force("charge")) {
                simulation.force("charge")
                    .strength(d => d.node_type === "course" ? -700 : -130);
            }
            if (simulation.force("collision")) {
                simulation.force("collision")
                    .strength(0.7);
            }
            if (simulation.force("x")) {
                simulation.force("x")
                    .x(width / 2)
                    .strength(0.05);
            }
            if (simulation.force("y")) {
                simulation.force("y")
                    .y(height / 2)
                    .strength(0.05);
            }

            if (physicsEnabled) {
                simulation.alphaTarget(0.04).alpha(0.25).restart();
                setTimeout(() => simulation.alphaTarget(0), 2200);
            } else {
                simulation.stop();
                tickActions();
            }
        }
    }

    // Tick layout positioning
    function tickActions() {
        if (currentView === "tree") {
            const PAD = 18; // cluster hull padding

            // Smoothly ease node position toward layout target coordinate
            g.selectAll(".node").each(d => {
                if (d.targetX !== undefined && d.targetY !== undefined) {
                    if (d.x === undefined) d.x = d.targetX;
                    if (d.y === undefined) d.y = d.targetY;
                    d.x += (d.targetX - d.x) * 0.16;
                    d.y += (d.targetY - d.y) * 0.16;
                }
                d.vx = 0;
                d.vy = 0;
            });

            // Update cluster hull rects based on current animated topic positions
            hullLayer.selectAll(".topic-cluster-hull").each(function (d) {
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

        container.classList.remove("hidden");
        textbookContainer.classList.add("hidden");
        searchInput.disabled = false;

        document.querySelectorAll(".graph-actions > button:not(#btn-theme)").forEach(b => b.classList.remove("hidden"));
        document.getElementById("physics-divider").classList.remove("hidden");

        closePopup();
        updateGraph();
    });

    tabFog.addEventListener("click", () => {
        if (currentView === "fog") return;
        currentView = "fog";
        tabFog.classList.add("active");
        tabTree.classList.remove("active");
        tabTextbook.classList.remove("active");

        container.classList.remove("hidden");
        textbookContainer.classList.add("hidden");
        searchInput.disabled = false;

        document.querySelectorAll(".graph-actions > button:not(#btn-theme)").forEach(b => b.classList.remove("hidden"));
        document.getElementById("physics-divider").classList.remove("hidden");

        closePopup();
        updateGraph();
    });

    tabTextbook.addEventListener("click", () => {
        if (currentView === "textbook") return;
        currentView = "textbook";
        tabTextbook.classList.add("active");
        tabTree.classList.remove("active");
        tabFog.classList.remove("active");

        container.classList.add("hidden");
        textbookContainer.classList.remove("hidden");
        searchInput.disabled = true;
        closePopup();

        document.querySelectorAll(".graph-actions > button:not(#btn-theme)").forEach(b => b.classList.add("hidden"));
        document.getElementById("physics-divider").classList.add("hidden");

        renderTextbookTOC();
    });

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

    // Node Context Menu Logic
    const nodeContextMenu = document.getElementById("node-context-menu");
    let selectedContextNode = null;
    let selectedContextElement = null;

    function showNodeContextMenu(x, y, node, element) {
        selectedContextNode = node;
        selectedContextElement = element;

        nodeContextMenu.style.display = "block";
        const menuW = nodeContextMenu.offsetWidth || 180;
        const menuH = nodeContextMenu.offsetHeight || 80;
        const safeX = Math.min(x, window.innerWidth - menuW - 12);
        const safeY = Math.min(y, window.innerHeight - menuH - 12);
        nodeContextMenu.style.left = `${safeX}px`;
        nodeContextMenu.style.top = `${safeY}px`;
        nodeContextMenu.classList.add("visible");
    }

    function hideNodeContextMenu() {
        if (nodeContextMenu) {
            nodeContextMenu.classList.remove("visible");
            setTimeout(() => { nodeContextMenu.style.display = "none"; }, 150);
        }
    }

    // Hide context menu on click elsewhere
    document.addEventListener("click", (e) => {
        if (nodeContextMenu && !nodeContextMenu.contains(e.target)) {
            hideNodeContextMenu();
        }
    });

    // Attach click listeners to menu items
    const ctxPopupBtn = document.getElementById("node-ctx-popup-btn");
    const ctxAiBtn = document.getElementById("node-ctx-ai-btn");

    if (ctxPopupBtn) {
        ctxPopupBtn.addEventListener("click", () => {
            hideNodeContextMenu();
            if (selectedContextNode && selectedContextElement) {
                showPopup(selectedContextNode, selectedContextElement);
            }
        });
    }

    if (ctxAiBtn) {
        ctxAiBtn.addEventListener("click", () => {
            hideNodeContextMenu();
            if (selectedContextNode) {
                triggerAISummary(selectedContextNode);
            }
        });
    }

    // AI Summary Sidebar Panel
    const aiSummaryPanel = document.getElementById("ai-summary-panel");
    const aiPanelInner = aiSummaryPanel ? aiSummaryPanel.querySelector(".ai-summary-panel-inner") : null;
    const aiPanelNodeTitle = document.getElementById("ai-panel-node-title");
    const aiPanelPath = document.getElementById("ai-panel-path");
    const aiPanelContent = document.getElementById("ai-panel-content");
    const aiPanelCloseBtn = document.getElementById("ai-panel-close-btn");

    if (aiPanelCloseBtn) {
        aiPanelCloseBtn.addEventListener("click", () => {
            aiSummaryPanel.classList.add("hidden");
        });
    }

    async function triggerAISummary(node) {
        // Show the panel
        aiSummaryPanel.classList.remove("hidden");
        if (aiPanelInner) aiPanelInner.classList.remove("loaded");

        // Populate header info
        aiPanelNodeTitle.textContent = node.title;

        aiPanelPath.innerHTML = "";
        if (node.path && node.path.length > 0) {
            node.path.forEach((p, idx) => {
                const span = document.createElement("span");
                span.textContent = p;
                aiPanelPath.appendChild(span);
                if (idx < node.path.length - 1) {
                    aiPanelPath.appendChild(document.createTextNode(" > "));
                }
            });
        }

        // Show thinking animation
        aiPanelContent.innerHTML = `
            <div class="ai-thinking-container">
                <div class="ai-google-dots">
                    <span></span><span></span><span></span><span></span>
                </div>
                <div class="ai-thinking-label">Thinking with gemma3:270m...</div>
            </div>
        `;

        const contentText = node.content ? (Array.isArray(node.content) ? node.content.join('\n') : node.content) : "No content available.";

        const prompt = `Preserve each topic but rephrase into shortened version.
        
Topic Title: ${node.title}

Content:
${contentText}`;

        try {
            const response = await fetch("http://localhost:11434/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "gemma3:270m",
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.5,
                        top_p: 0.9,
                        num_predict: 1024
                    }
                })
            });

            if (!response.ok) {
                throw new Error("Ollama connection failed. Make sure Ollama is running and gemma3:270m is pulled.");
            }

            const data = await response.json();
            const summaryText = data.response || "No summary was generated.";

            // Switch border to slower subtle glow on success
            if (aiPanelInner) aiPanelInner.classList.add("loaded");

            aiPanelContent.innerHTML = "";
            const lines = summaryText.split("\n");
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.length > 0) {
                    if (trimmed.startsWith("●") || trimmed.startsWith("•") || trimmed.match(/^[-\*]\s/) || trimmed.match(/^\d+\./)) {
                        const li = document.createElement("p");
                        li.className = "ai-panel-list-item";
                        li.textContent = line;
                        aiPanelContent.appendChild(li);
                    } else {
                        const p = document.createElement("p");
                        p.className = "ai-panel-paragraph";
                        p.textContent = line;
                        aiPanelContent.appendChild(p);
                    }
                }
            });

        } catch (error) {
            if (aiPanelInner) aiPanelInner.classList.add("loaded");
            aiPanelContent.innerHTML = `
                <div style="color: var(--google-red); padding: 12px 0; text-align: center;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; margin-bottom: 10px;"></i>
                    <p style="font-weight: 600; margin-bottom: 6px;">Failed to generate summary</p>
                    <p style="font-size: 12px; color: var(--text-secondary);">${error.message}</p>
                    <p style="font-size: 11px; margin-top: 10px; color: var(--text-muted);">Run: <code>ollama run gemma3:270m</code></p>
                </div>
            `;
        }
    }

    // Run graph startup
    updateGraph();
});
