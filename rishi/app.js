/**
 * EIPR Knowledge Explorer - Frontend Logic
 * Dynamic Wrap Cards, Locked X layout, Nested TOC Dropdowns, Textbook Scroll Linking
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
    // Expand Course (root) by default. Keep units collapsed.
    hierarchyData.expanded = true;

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

    // 3. Dynamic Node Wrap & Dimensioning Calculations
    const typeRadius = {
        "course": 38,
        "unit": 28
    };

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

    // Words wrapping helper for long text titles in rectangles
    function getWrappedLines(title, maxCharsPerLine = 24) {
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
        const lines = getWrappedLines(node.title, 24);
        const maxLen = Math.max(...lines.map(l => l.length));
        const w = Math.max(120, Math.min(260, maxLen * 7.5 + 24));
        const h = Math.max(34, lines.length * 13 + 14);
        return { w, h, lines };
    }

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

    // 4. Force Simulation Setup (Horizontal Layer Columns Locked X-coordinates)
    const simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(d => {
            const targetType = d.target.node_type;
            if (targetType === "unit") return 140;
            if (targetType === "topic") return 110;
            return 80;
        }))
        .force("charge", d3.forceManyBody().strength(-250))
        .force("y", d3.forceY(height / 2).strength(0.25)) // Centered vertically
        .force("collision", d3.forceCollide().radius(d => {
            if (d.node_type === "course" || d.node_type === "unit") {
                return typeRadius[d.node_type] + 20;
            }
            const dim = getNodeDimensions(d);
            return Math.max(dim.w / 2 + 10, dim.h / 2 + 15);
        }).strength(0.85));

    // Drag behavior
    function drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active && physicsEnabled) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
            closePopup();
        }
        
        function dragged(event, d) {
            // Keep X coordinate locked to its depth column during drag
            d.fx = 80 + d.depth * 250;
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
                node.x = 80 + node.depth * 250;
                node.y = node.parent && oldNode ? oldNode.y : height / 2 + (Math.random() - 0.5) * 200;
            }
        });

        visibleNodes = nodesList;
        visibleLinks = linksList;

        // Render Links
        let linkElements = g.selectAll(".link")
            .data(visibleLinks, d => `${d.source}-${d.target}`);

        linkElements.exit().remove();

        const linkEnter = linkElements.enter().append("path")
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
            .attr("x", d => -getNodeDimensions(d).w / 2)
            .attr("y", d => -getNodeDimensions(d).h / 2)
            .attr("width", d => getNodeDimensions(d).w)
            .attr("height", d => getNodeDimensions(d).h)
            .attr("rx", 8)
            .attr("ry", 8)
            .attr("stroke", d => typeColors[d.node_type]);

        // Render Multi-line text for wrapped lines
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

    // Tick layout positioning (Hard lock on depth columns)
    function tickActions() {
        g.selectAll(".node").each(d => {
            d.x = 80 + d.depth * 250;
            d.vx = 0;
        });

        g.selectAll(".link")
            .attr("d", d => {
                const x1 = d.source.x;
                const y1 = d.source.y;
                const x2 = d.target.x;
                const y2 = d.target.y;
                // Horizontal S-curve (cubic bezier)
                return `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
            });

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
        // Find ancestor at depth 2 (Topic) to render
        let topicNode = node;
        while (topicNode.depth > 2 && topicNode.parent) {
            topicNode = topicNode.parent;
        }

        // Switch Tab View
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

        // Set active on matching Topic row in TOC
        document.querySelectorAll(".toc-header-row").forEach(row => row.classList.remove("active"));
        const activeTopicRow = document.querySelector(`[data-toc-id="${topicNode.id}"]`);
        if (activeTopicRow) activeTopicRow.classList.add("active");

        // Render textbook contents
        renderTextbookContent(topicNode);

        // Wait brief millisecond for DOM render then scroll to ID
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
    tabGraph.addEventListener("click", () => {
        if (currentView === "graph") return;
        currentView = "graph";
        tabGraph.classList.add("active");
        tabTextbook.classList.remove("active");
        
        container.classList.remove("hidden");
        textbookContainer.classList.add("hidden");
        searchInput.disabled = false;
        
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

            // Icon by type
            let iconHtml = '<i class="fa-regular fa-file-lines"></i>';
            if (node.node_type === "unit") iconHtml = '<i class="fa-solid fa-book"></i>';
            else if (node.node_type === "topic") iconHtml = '<i class="fa-solid fa-folder-open"></i>';
            else if (node.node_type === "subtopic") iconHtml = '<i class="fa-solid fa-chevron-right" style="font-size:10px;"></i>';

            row.innerHTML = `<span>${iconHtml} ${node.title}</span>`;

            // Expand icon if it has children
            const hasChildren = node.children && node.children.length > 0;
            if (hasChildren) {
                const chevron = document.createElement("i");
                chevron.className = "fa-solid fa-chevron-right toc-chevron";
                row.appendChild(chevron);

                const childrenBox = document.createElement("div");
                childrenBox.className = "toc-children-box";
                childrenBox.style.maxHeight = "0px"; // Start collapsed

                // Click chevron to toggle collapse without rendering
                chevron.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const isOpen = chevron.classList.toggle("open");
                    childrenBox.style.maxHeight = isOpen ? "1000px" : "0px";
                });

                // Clicking the row itself renders content
                row.addEventListener("click", () => {
                    // Activate row
                    document.querySelectorAll(".toc-header-row").forEach(r => r.classList.remove("active"));
                    row.classList.add("active");
                    
                    // Render
                    let topicNode = node;
                    while (topicNode.depth > 2 && topicNode.parent) {
                        topicNode = topicNode.parent;
                    }
                    renderTextbookContent(topicNode);

                    // If click subtopic, scroll to it
                    if (node.depth >= 2) {
                        setTimeout(() => {
                            const el = document.getElementById(`reader-${node.id}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 50);
                    }
                });

                itemContainer.appendChild(row);
                
                // Recurse children
                node.children.forEach(child => {
                    buildTOCNode(child, childrenBox);
                });
                itemContainer.appendChild(childrenBox);
            } else {
                // Leaf Node click navigation
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

        // Loop through Units under root course
        hierarchyData.children.forEach(unit => {
            buildTOCNode(unit, textbookToc);
        });
    }

    // 12. Dynamic Ebook/Markdown Reader Rendering
    function renderTextbookContent(node) {
        textbookContentCard.innerHTML = "";

        // Path Breadcrumbs
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

        // Recursive text parser to losslessly map tree to reader content
        function renderNodeText(item) {
            const wrapper = document.createElement("div");
            wrapper.style.marginBottom = "30px";
            wrapper.id = `reader-${item.id}`;

            // Heading by type
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

            // Recurse children topics
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

    // Collapse All listener
    const btnCollapse = document.getElementById("btn-collapse");
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
        
        // Refocus center
        btnZoomFit.click();
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

    // Run graph startup
    updateGraph();
});
