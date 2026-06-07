/**
 * EIPR Space Explorer — 3D Celestial Map & Space Flight Simulation (space-explorer.js)
 * ─────────────────────────────────────────────────────────────────────────────
 * Powered by Three.js.
 * Renders nodes at 3D semantic UMAP coordinates and enables flying spaceship navigation.
 */

const SpaceExplorer = (() => {
    // ─── Three.js Globals ──────────────────────────────────────────────────────
    let scene, camera, renderer;
    let animationFrameId = null;
    let isRunning = false;
    
    // Spaceship transform group & mesh
    let shipGroup = new THREE.Group();
    let shipMesh = null;
    let isThirdPerson = false;
    const coopMembers = new Map();

    // AI Scanner state
    let isScanning = false;
    let lastScannedNodeId = null;
    let wobbleMesh = null;
    let wobbleStartTime = 0;
    
    // ─── Data State ────────────────────────────────────────────────────────────
    let nodeCoordinates = {}; // nodeId -> [x, y, z]
    let flatNodes = [];       // List of all node objects
    let spaceNodes = [];      // Three.js meshes representing nodes
    let orbitLines = [];      // Three.js lines connecting parent-child
    
    // ─── Flight State ──────────────────────────────────────────────────────────
    const flightState = {
        position: { x: 0, y: 0, z: 400 }, // Start position in space
        velocity: { x: 0, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: 0, roll: 0 },   // pitch = up/down, yaw = left/right, roll = tilt
        speed: 0,
        maxSpeed: 240, // 3x of original 80
        acceleration: 4.5, // 3x of original 1.5
        friction: 0.96,
        targetRotation: { pitch: 0, yaw: 0, roll: 0 },
        steerSpeed: 0.003
    };

    // Keyboard state
    const keys = { w: false, a: false, s: false, d: false, space: false, shift: false, x: false };
    let currentThrottle = 0; // Throttle value from -50 to 100
    let proMode = false;
    let mouseDelta = { x: 0, y: 0 };
    
    // Steering cursor state (when not pointer-locked)
    let mouse = { x: 0, y: 0 };
    let canvasContainer = null;
    let targetedNode = null;
    let visitedChartedNodes = new Set();

    // Updates flight guide keys panel based on Pro mode status
    function updateControlsGuide() {
        const grid = document.getElementById("space-controls-grid");
        if (grid) {
            if (proMode) {
                grid.innerHTML = `
                    <div class="control-key">W / S</div><div>Change Throttle</div>
                    <div class="control-key">X</div><div>Cut Throttle (0%)</div>
                    <div class="control-key">A / D</div><div>Strafe Left / Right</div>
                    <div class="control-key">Space</div><div>Ascend</div>
                    <div class="control-key">Shift</div><div>Descend</div>
                    <div class="control-key">Mouse</div><div>Pitch / Roll (Steer)</div>
                `;
            } else {
                grid.innerHTML = `
                    <div class="control-key">W / S</div><div>Change Throttle</div>
                    <div class="control-key">X</div><div>Cut Throttle (0%)</div>
                    <div class="control-key">A / D</div><div>Strafe Left / Right</div>
                    <div class="control-key">Space</div><div>Ascend</div>
                    <div class="control-key">Shift</div><div>Descend</div>
                    <div class="control-key">Mouse</div><div>Steer (Pitch / Yaw)</div>
                `;
            }
        }
    }

    // Node colors & sizes configurations
    const typeConfigs = {
        "course":    { color: 0x4285F4, size: 28,  emissive: 0x4285F4, glow: true },
        "unit":      { color: 0xEA4335, size: 16,  emissive: 0xEA4335, glow: true },
        "topic":     { color: 0xFBBC05, size: 9,   emissive: 0xFBBC05, glow: false },
        "subtopic":  { color: 0x34A853, size: 6,   emissive: 0x34A853, glow: false },
        "concept":   { color: 0x8A3FFC, size: 4,   emissive: 0x8A3FFC, glow: false },
        "default":   { color: 0x00FAC6, size: 3.5, emissive: 0x00FAC6, glow: false }
    };

    // ─── Flattens the hierarchyData ──────────────────────────────────────────
    defNodeTypes = ["case_study", "example", "activity"];
    function flattenHierarchy(node, list = []) {
        if (!node) return list;
        list.push(node);
        if (node.children) {
            node.children.forEach(child => flattenHierarchy(child, list));
        }
        return list;
    }

    // Create Canvas Texture for Text Labels
    function createTextSprite(text, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dynamic font size starting at 24px
        let fontSize = 24;
        ctx.font = `Bold ${fontSize}px "Outfit", "Segoe UI", sans-serif`;
        
        // Shrink font size dynamically until text fits inside canvas width (leaving margin)
        const maxTextWidth = canvas.width - 24;
        while (ctx.measureText(text).width > maxTextWidth && fontSize > 12) {
            fontSize -= 1;
            ctx.font = `Bold ${fontSize}px "Outfit", "Segoe UI", sans-serif`;
        }
        
        // Truncate if it's still too long
        let displayText = text;
        if (ctx.measureText(displayText).width > maxTextWidth) {
            while (ctx.measureText(displayText + "...").width > maxTextWidth && displayText.length > 0) {
                displayText = displayText.slice(0, -1);
            }
            displayText += "...";
        }
        
        // Label background glow shadow
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        
        ctx.fillStyle = formatColor(colorHex);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayText, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(60, 15, 1);
        return sprite;
    }

    // ─── Setup Keyboard & Mouse Listeners ──────────────────────────────────────
    function setupInputListeners() {
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w') keys.w = true;
            if (k === 's') keys.s = true;
            if (k === 'a') keys.a = true;
            if (k === 'd') keys.d = true;
            if (k === 'x') keys.x = true;
            if (e.key === ' ') keys.space = true;
            if (e.key === 'Shift') keys.shift = true;

            // Direct Hotkeys
            if (k === 'p') {
                toggleProMode();
            }
            if (k === 'v') {
                toggleViewPerspective();
            }
            if (k === 'r') {
                respawnShip();
            }
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w') keys.w = false;
            if (k === 's') keys.s = false;
            if (k === 'a') keys.a = false;
            if (k === 'd') keys.d = false;
            if (k === 'x') keys.x = false;
            if (e.key === ' ') keys.space = false;
            if (e.key === 'Shift') keys.shift = false;
        });

        const pointerOverlay = document.getElementById("space-pointer-overlay");
        
        // Show pointer lock overlay when loading is complete and tab is visible
        if (pointerOverlay) pointerOverlay.classList.remove("hidden");

        // Request pointer lock on overlay click
        if (pointerOverlay) {
            pointerOverlay.addEventListener("click", () => {
                canvasContainer.requestPointerLock();
            });
        }

        // Pointer Lock State Changes handler
        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === canvasContainer) {
                if (pointerOverlay) pointerOverlay.classList.add("hidden");
            } else {
                if (pointerOverlay) pointerOverlay.classList.remove("hidden");
                mouseDelta.x = 0;
                mouseDelta.y = 0;
            }
        });

        // Steer tracking using mouse delta
        document.addEventListener('mousemove', (e) => {
            if (!isRunning) return;
            if (document.pointerLockElement === canvasContainer) {
                mouseDelta.x += e.movementX;
                mouseDelta.y += e.movementY;
            }
        });

        // Pro Mode toggle setup
        const proBtn = document.getElementById("space-pro-btn");
        if (proBtn) {
            proBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Stop from triggering pointer lock on click
                toggleProMode();
            });
        }

        // Perspective button setup
        const viewBtn = document.getElementById("space-view-btn");
        if (viewBtn) {
            viewBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleViewPerspective();
            });
        }

        // Respawn button setup
        const respawnBtn = document.getElementById("space-respawn-btn");
        if (respawnBtn) {
            respawnBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                respawnShip();
            });
        }

        // Scanner HUD Close button setup
        const scannerCloseBtn = document.getElementById("scanner-close-btn");
        if (scannerCloseBtn) {
            scannerCloseBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                closeScanner();
            });
        }
    }

    // Toggle Pro Mode steer
    function toggleProMode() {
        proMode = !proMode;
        const proBtn = document.getElementById("space-pro-btn");
        if (proBtn) {
            proBtn.classList.toggle("active", proMode);
            proBtn.textContent = proMode ? "PRO MODE: ON" : "PRO MODE: OFF";
        }
        updateControlsGuide();
    }

    // Toggle view perspective between 1st and 3rd person
    function toggleViewPerspective() {
        if (!camera || !shipMesh) return;
        isThirdPerson = !isThirdPerson;
        
        const viewBtn = document.getElementById("space-view-btn");
        if (isThirdPerson) {
            // Place camera up and behind the spaceship, rigidly hooked to ship coordinate system
            camera.position.set(0, 5.5, 24);
            camera.rotation.set(-0.18, 0, 0); // look slightly down
            shipMesh.visible = true;
            if (viewBtn) viewBtn.textContent = "View: Third Person";
        } else {
            // First person: camera is inside cockpit
            camera.position.set(0, 0, 0);
            camera.rotation.set(0, 0, 0);
            shipMesh.visible = false;
            if (viewBtn) viewBtn.textContent = "View: First Person";
        }
    }

    // Reset ship position, orientation, and velocity
    function respawnShip() {
        if (!shipGroup) return;
        shipGroup.position.set(0, 50, 600);
        flightState.velocity.x = 0;
        flightState.velocity.y = 0;
        flightState.velocity.z = 0;
        flightState.rotation.pitch = 0;
        flightState.rotation.yaw = 0;
        flightState.rotation.roll = 0;
        shipGroup.quaternion.set(0, 0, 0, 1);
        currentThrottle = 0;
        
        // Clear scan cooldowns on respawn
        lastScannedNodeId = null;
        closeScanner();
    }

    // Hides scanner HUD
    function closeScanner() {
        isScanning = false;
        wobbleMesh = null;
        const scanHud = document.getElementById("space-scanner-hud");
        if (scanHud) scanHud.classList.add("hidden");
    }

    // Creates Spaceship 3D Fighter mesh
    function createProceduralShipMesh(specs) {
        const group = new THREE.Group();
        const baseColor = new THREE.Color(`hsl(${specs.hue}, 80%, 45%)`);
        const accentColor = new THREE.Color(`hsl(${(specs.hue + 120) % 360}, 90%, 60%)`);
        
        const shipMat = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.3,
            metalness: 0.8
        });
        const accentMat = new THREE.MeshStandardMaterial({
            color: accentColor,
            roughness: 0.2,
            metalness: 0.7
        });
        const glassMat = new THREE.MeshBasicMaterial({
            color: 0x00fac6,
            transparent: true,
            opacity: 0.75
        });

        // 1. Fuselage/Body
        let bodyGeo;
        if (specs.hull.includes("Interceptor")) {
            bodyGeo = new THREE.ConeGeometry(2.4, 13, 4);
        } else if (specs.hull.includes("Dreadnought")) {
            bodyGeo = new THREE.BoxGeometry(3.2, 2.4, 14);
        } else {
            bodyGeo = new THREE.CylinderGeometry(1.0, 2.0, 11, 5);
        }
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, shipMat);
        group.add(body);

        // 2. Cockpit
        const cockpitGeo = new THREE.SphereGeometry(1.1, 8, 8);
        cockpitGeo.scale(1, 0.7, 1.8);
        const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
        cockpit.position.set(0, 1.0, -2.4);
        group.add(cockpit);

        // 3. Wings
        if (specs.wing.includes("Ring")) {
            const ringGeo = new THREE.TorusGeometry(4.8, 0.48, 8, 24);
            const ring = new THREE.Mesh(ringGeo, accentMat);
            ring.position.set(0, 0, 1.6);
            group.add(ring);
        } else if (specs.wing.includes("Delta")) {
            const wingGeo = new THREE.ConeGeometry(6.4, 4.8, 3);
            wingGeo.rotateX(Math.PI / 2);
            const wing = new THREE.Mesh(wingGeo, accentMat);
            wing.position.set(0, -0.3, 1.2);
            group.add(wing);
        } else {
            // Standard sweeping wings
            const wingLeftGeo = new THREE.BoxGeometry(8.8, 0.24, 3.2);
            const wingLeft = new THREE.Mesh(wingLeftGeo, accentMat);
            wingLeft.position.set(-4.8, -0.16, 0.8);
            wingLeft.rotation.y = -Math.PI / 6;
            wingLeft.rotation.z = -Math.PI / 24;
            group.add(wingLeft);

            const wingRight = wingLeft.clone();
            wingRight.position.x = 4.8;
            wingRight.rotation.y = Math.PI / 6;
            wingRight.rotation.z = Math.PI / 24;
            group.add(wingRight);
        }

        // 4. Engines
        const engineGeo = new THREE.CylinderGeometry(0.64, 0.96, 2.4, 6);
        engineGeo.rotateX(Math.PI / 2);
        const engineMat = new THREE.MeshBasicMaterial({ color: accentColor });
        
        const leftEngine = new THREE.Mesh(engineGeo, shipMat);
        leftEngine.position.set(-1.2, -0.4, 5.6);
        const flameLeft = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.6, 6), engineMat);
        flameLeft.rotateX(-Math.PI / 2);
        flameLeft.position.set(0, 0, 1.6);
        leftEngine.add(flameLeft);
        group.add(leftEngine);

        const rightEngine = leftEngine.clone();
        rightEngine.position.x = 1.2;
        group.add(rightEngine);

        // PointLight flare inside the engines
        const engineLight = new THREE.PointLight(accentColor, 2, 16);
        engineLight.position.set(0, -0.4, 7.2);
        group.add(engineLight);

        group.scale.set(0.8, 0.8, 0.8);
        return group;
    }

    // Creates Spaceship 3D Fighter mesh using procedural specifications
    function createSpaceshipMesh() {
        let specs = null;
        if (typeof GalaxyMap !== "undefined" && GalaxyMap.getShipSpecs()) {
            specs = GalaxyMap.getShipSpecs();
        } else {
            // Simulated local player fallback specs if loaded standalone
            specs = {
                hull: "Interceptor Fighter",
                wing: "Swept Wings",
                core: "Plasma Drive",
                system: "Sensors",
                hue: Math.floor(Math.random() * 360),
                name: "Solo-Cruiser"
            };
        }
        return createProceduralShipMesh(specs);
    }

    const UNIT_HUES = {
        1: 210, // Unit 1: Blue
        2: 330, // Unit 2: Pink/Magenta
        3: 270, // Unit 3: Purple
        4: 150, // Unit 4: Green
        5: 30   // Unit 5: Golden Amber
    };

    function getUnitNumber(node) {
        if (!node) return null;
        if (node.path && node.path.length > 0) {
            for (const p of node.path) {
                if (typeof p === 'string') {
                    const match = p.match(/UNIT\s*(\d+)/i);
                    if (match) return parseInt(match[1], 10);
                }
            }
        }
        if (node.id) {
            const match = node.id.match(/unit[-_]?(\d+)/i);
            if (match) return parseInt(match[1], 10);
        }
        if (node.parent) {
            return getUnitNumber(node.parent);
        }
        return null;
    }

    function getNodeColor(node) {
        if (!node) return new THREE.Color(0x00FAC6);
        if (node.node_type === "course") {
            return new THREE.Color(0x00FAC6); // Cyber Cyan for course root
        }
        const unitNum = getUnitNumber(node);
        if (unitNum && UNIT_HUES[unitNum] !== undefined) {
            const baseHue = UNIT_HUES[unitNum];
            let h = baseHue;
            let s = 0.85;
            let l = 0.55;
            switch (node.node_type) {
                case "unit":
                    h = baseHue;
                    s = 0.95;
                    l = 0.50;
                    break;
                case "topic":
                    h = baseHue;
                    s = 0.90;
                    l = 0.60;
                    break;
                case "subtopic":
                    h = (baseHue + 12) % 360;
                    s = 0.85;
                    l = 0.68;
                    break;
                case "concept":
                    h = (baseHue + 24) % 360;
                    s = 0.80;
                    l = 0.76;
                    break;
                case "case_study":
                case "example":
                case "activity":
                default:
                    h = (baseHue - 15 + 360) % 360;
                    s = 0.90;
                    l = 0.65;
                    break;
            }
            return new THREE.Color().setHSL(h / 360, s, l);
        }
        return new THREE.Color(0x00FAC6);
    }

    function formatColor(colorHex) {
        if (colorHex instanceof THREE.Color) {
            return '#' + colorHex.getHexString();
        }
        if (typeof colorHex === 'number') {
            return '#' + colorHex.toString(16).padStart(6, '0');
        }
        if (typeof colorHex === 'string') {
            const trimmed = colorHex.trim();
            if (trimmed.startsWith('#') || trimmed.startsWith('rgb') || trimmed.startsWith('hsl')) {
                return trimmed;
            }
            if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
                const num = parseInt(trimmed, 16);
                if (!isNaN(num)) {
                    return '#' + num.toString(16).padStart(6, '0');
                }
            }
            const num = parseInt(trimmed, 10);
            if (!isNaN(num)) {
                return '#' + num.toString(16).padStart(6, '0');
            }
            if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
                return '#' + trimmed;
            }
        }
        return '#00FAC6';
    }

    function createProceduralPlanetTexture(colorHex, type) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        const colorStr = formatColor(colorHex);
        
        ctx.fillStyle = colorStr;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (type === "course" || type === "unit") {
            const grad = ctx.createRadialGradient(256, 128, 0, 256, 128, 256);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.25, colorStr);
            grad.addColorStop(1, '#050510');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            for (let i = 0; i < 35; i++) {
                ctx.beginPath();
                ctx.arc(Math.random() * 512, Math.random() * 256, 8 + Math.random() * 25, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (type === "topic") {
            for (let y = 0; y < 256; y += 4) {
                const alpha = 0.18 + Math.sin(y * 0.05) * 0.15;
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fillRect(0, y, 512, 4);
                
                const alphaDark = 0.12 + Math.cos(y * 0.07) * 0.1;
                ctx.fillStyle = `rgba(0, 0, 0, ${alphaDark})`;
                ctx.fillRect(0, y + 2, 512, 2);
            }
            ctx.fillStyle = 'rgba(234, 67, 53, 0.35)';
            ctx.beginPath();
            ctx.ellipse(320, 160, 22, 14, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            for (let i = 0; i < 9; i++) {
                ctx.beginPath();
                const cx = Math.random() * 512;
                const cy = Math.random() * 256;
                ctx.arc(cx, cy, 25 + Math.random() * 35, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
            for (let i = 0; i < 24; i++) {
                const cx = Math.random() * 512;
                const cy = Math.random() * 256;
                const r = 2.5 + Math.random() * 8;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    // ─── Build Scene ───────────────────────────────────────────────────────────
    function build3DWorld() {
        // Starfield background
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 2000;
        const starPositions = new Float32Array(starsCount * 3);
        
        for (let i = 0; i < starsCount * 3; i += 3) {
            starPositions[i] = (Math.random() - 0.5) * 3000;
            starPositions[i+1] = (Math.random() - 0.5) * 3000;
            starPositions[i+2] = (Math.random() - 0.5) * 3000;
        }
        
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.5,
            transparent: true,
            opacity: 0.8
        });
        const starField = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(starField);

        // Render nodes at UMAP coordinates as real planets and stars
        flatNodes.forEach(node => {
            const coords = nodeCoordinates[node.id] || [0, 0, 0];
            const type = defNodeTypes.includes(node.node_type) ? "default" : node.node_type;
            const config = typeConfigs[type] || typeConfigs["default"];
            const nodeColor = getNodeColor(node);
            
            // Sphere Geometry
            const geometry = new THREE.SphereGeometry(config.size, 16, 16);
            
            const planetMap = createProceduralPlanetTexture(nodeColor, node.node_type);
            let material;
            
            if (node.node_type === "course" || node.node_type === "unit") {
                material = new THREE.MeshStandardMaterial({
                    map: planetMap,
                    emissive: nodeColor,
                    emissiveIntensity: 1.5,
                    roughness: 0.1,
                    metalness: 0.1
                });
            } else {
                material = new THREE.MeshStandardMaterial({
                    map: planetMap,
                    roughness: 0.65,
                    metalness: 0.15
                });
            }
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(coords[0], coords[1], coords[2]);
            mesh.userData = { nodeData: node };
            
            // Star light source casting starlight onto ship and planets
            if (node.node_type === "course" || node.node_type === "unit") {
                const starLight = new THREE.PointLight(nodeColor, 3.5, 900, 1.2);
                mesh.add(starLight);
            }

            // Add ring orbit if it is unit/topic
            if (node.node_type === "unit" || node.node_type === "course") {
                const ringGeo = new THREE.RingGeometry(config.size + 4, config.size + 4.5, 32);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: nodeColor,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.3
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = Math.PI / 2;
                mesh.add(ring);
            }

            // Text Label
            const textSprite = createTextSprite(node.title, "#ffffff");
            textSprite.position.set(0, config.size + 8, 0);
            mesh.add(textSprite);

            scene.add(mesh);
            spaceNodes.push(mesh);
        });

        // Add parent-child connection lines (gravitational beams) colored dynamically by unit
        flatNodes.forEach(node => {
            if (node.parent) {
                const startCoords = nodeCoordinates[node.parent.id] || [0, 0, 0];
                const endCoords = nodeCoordinates[node.id] || [0, 0, 0];
                
                const points = [
                    new THREE.Vector3(startCoords[0], startCoords[1], startCoords[2]),
                    new THREE.Vector3(endCoords[0], endCoords[1], endCoords[2])
                ];
                
                const lineColor = getNodeColor(node);
                const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                const lineMat = new THREE.LineBasicMaterial({
                    color: lineColor,
                    transparent: true,
                    opacity: 0.15
                });
                
                const line = new THREE.Line(lineGeo, lineMat);
                scene.add(line);
                orbitLines.push(line);
            }
        });

        updateSpaceNodesHighlight();
    }

    // ─── Proximity & Targeting ─────────────────────────────────────────────────
    function checkProximity() {
        let closestNode = null;
        let minDistance = Infinity;

        spaceNodes.forEach(mesh => {
            const dist = shipGroup.position.distanceTo(mesh.position);
            if (dist < minDistance) {
                minDistance = dist;
                closestNode = mesh;
            }
        });

        // Trigger target threshold (e.g. within 160 units)
        const HUD_THRESHOLD = 180;
        
        if (closestNode && minDistance < HUD_THRESHOLD) {
            targetedNode = closestNode.userData.nodeData;
            
            // Update HUD
            document.getElementById("space-hud-title").textContent = targetedNode.title;
            document.getElementById("space-hud-type").textContent = targetedNode.node_type;
            
            // Badge styles
            const typeBadge = document.getElementById("space-hud-type");
            typeBadge.className = `badge ${targetedNode.node_type}`;
            
            // Distance
            document.getElementById("space-hud-dist").textContent = `${Math.round(minDistance)}m`;
            
            // Path
            const pathContainer = document.getElementById("space-hud-path");
            pathContainer.innerHTML = "";
            if (targetedNode.path) {
                targetedNode.path.forEach(p => {
                    const span = document.createElement("span");
                    span.textContent = p;
                    pathContainer.appendChild(span);
                });
            }

            // Summary Content
            const summaryText = document.getElementById("space-hud-summary");
            if (targetedNode.content && targetedNode.content.length > 0) {
                summaryText.innerHTML = targetedNode.content.filter(c => c && c.trim().length > 0).join("<br><br>");
            } else {
                summaryText.textContent = `A node of type ${targetedNode.node_type}. Fly closer or view details to study.`;
            }

            // Enable full notes btn
            const btnDetail = document.getElementById("space-hud-detail-btn");
            btnDetail.disabled = false;

            // Trigger AI Summary scanner when inside node boundary
            const type = defNodeTypes.includes(targetedNode.node_type) ? "default" : targetedNode.node_type;
            const config = typeConfigs[type] || typeConfigs["default"];
            const SCAN_DISTANCE = config.size + 15;
            if (minDistance < SCAN_DISTANCE) {
                triggerScanner(targetedNode, closestNode);
            }
        } else {
            targetedNode = null;
            document.getElementById("space-hud-title").textContent = "No target locked";
            document.getElementById("space-hud-type").textContent = "System";
            document.getElementById("space-hud-type").className = "badge";
            document.getElementById("space-hud-dist").textContent = "---";
            document.getElementById("space-hud-summary").textContent = "Fly closer to a node or click it to reveal its description and options.";
            document.getElementById("space-hud-path").innerHTML = "";
            document.getElementById("space-hud-detail-btn").disabled = true;
        }
    }

    // Handles proximity scanning AI summary generation
    async function triggerScanner(nodeData, mesh) {
        if (isScanning || lastScannedNodeId === nodeData.id) return;
        
        // If in a charted course, do not trigger scanner for non-listed nodes
        if (chartedCourse.size > 0 && !chartedCourse.has(nodeData.id)) {
            return;
        }

        isScanning = true;
        lastScannedNodeId = nodeData.id;
        
        // Mark node as visited if in charted course
        if (chartedCourse.has(nodeData.id)) {
            visitedChartedNodes.add(nodeData.id);
            updateMissionObjectivesHUD();
        }
        
        wobbleMesh = mesh;
        wobbleStartTime = Date.now();
        
        const scanHud = document.getElementById("space-scanner-hud");
        const scanTitle = document.getElementById("scanner-node-title");
        const scanText = document.getElementById("scanner-summary-text");
        
        if (scanHud) scanHud.classList.remove("hidden");
        if (scanTitle) scanTitle.textContent = `${nodeData.node_type.toUpperCase()}: ${nodeData.title}`;
        if (scanText) scanText.innerHTML = `<span style="color: #00fac6;"><i class="fa-solid fa-satellite-dish fa-spin"></i> Establishing telemetry link...</span>`;
        
        // Match the exact gatherContent logic from the main application
        function gatherContent(n, level = 0) {
            let result = "";
            let indent = "  ".repeat(level);
            if (level > 0 && n.title) {
                result += indent + "Subtopic: " + n.title + "\n";
            }
            if (n.content && n.content.length > 0) {
                let text = Array.isArray(n.content) ? n.content.join(' ') : n.content;
                if (text.trim().length > 0) {
                    result += indent + text + "\n";
                }
            }
            if (n.children && n.children.length > 0) {
                n.children.forEach(child => {
                    result += gatherContent(child, level + 1);
                });
            }
            return result;
        }

        const contentText = gatherContent(nodeData) || "No content available.";

        const prompt = `Provide a concise summary of the topic, followed by a single list of key takeaways/bullet points.
        
Topic Title: ${nodeData.title}

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
                        num_predict: 512
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error("Ollama connection failed.");
            }
            
            const data = await response.json();
            const summaryText = data.response || "No summary was generated.";
            
            if (scanText) {
                if (typeof marked !== 'undefined') {
                    scanText.innerHTML = marked.parse(summaryText);
                } else {
                    scanText.textContent = summaryText;
                }
            }
        } catch (err) {
            if (scanText) {
                scanText.innerHTML = `
                    <div style="color: var(--google-red);">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 20px; margin-bottom: 6px;"></i>
                        <p style="font-weight: 600;">Scanner offline</p>
                        <p style="font-size: 11px;">Make sure Ollama is running (ollama run gemma3:270m)</p>
                        <p style="font-size: 11px; margin-top: 10px; color: rgba(255,255,255,0.7);">${contentText}</p>
                    </div>
                `;
            }
        }
    }

    // ─── Flight Navigation Loop ────────────────────────────────────────────────
    function updateFlight(delta) {
        let pitchInput = 0;
        let yawInput = 0;
        let rollInput = 0;

        if (document.pointerLockElement === canvasContainer) {
            const sensitivity = 0.0018; // Balanced flight steering sensitivity
            pitchInput = -mouseDelta.y * sensitivity;
            if (proMode) {
                rollInput = -mouseDelta.x * sensitivity;
            } else {
                yawInput = -mouseDelta.x * sensitivity;
            }

            // Consume mouse delta
            mouseDelta.x = 0;
            mouseDelta.y = 0;
        }

        // Steer inputs interpolation (smoothing)
        flightState.rotation.pitch += (pitchInput - flightState.rotation.pitch) * 0.15;
        flightState.rotation.yaw += (yawInput - flightState.rotation.yaw) * 0.15;
        flightState.rotation.roll += (rollInput - flightState.rotation.roll) * 0.15;

        // Apply local rotation changes directly to spaceship group transform orientation
        shipGroup.rotateX(flightState.rotation.pitch);
        shipGroup.rotateY(flightState.rotation.yaw); // Yaw turning allowed in both modes
        if (proMode) {
            shipGroup.rotateZ(flightState.rotation.roll); // Roll around facing/look direction in pro mode
        }

        // Decay rotation values over time so ship stops turning when mouse stops moving
        flightState.rotation.pitch *= 0.85;
        flightState.rotation.yaw *= 0.85;
        flightState.rotation.roll *= 0.85;

        // Direction vectors relative to ship heading
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipGroup.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(shipGroup.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(shipGroup.quaternion);

        // Update Throttle based on W/S keys, reset on X
        if (keys.w && !isScanning) {
            currentThrottle = Math.min(100, currentThrottle + 60 * delta); // Increase throttle by 60% per second
        }
        if (keys.s && !isScanning) {
            currentThrottle = Math.max(-50, currentThrottle - 60 * delta); // Decrease throttle by 60% per second
        }
        if (keys.x && !isScanning) {
            currentThrottle = 0;
        }

        // Gently set throttle to zero and stop when contacting a node (scanning)
        if (isScanning) {
            if (currentThrottle > 0) {
                currentThrottle = Math.max(0, currentThrottle - 150 * delta); // Decays throttle rapidly
            } else if (currentThrottle < 0) {
                currentThrottle = Math.min(0, currentThrottle + 150 * delta);
            }
            
            // Decelerate ship velocity to a complete gentle stop
            flightState.velocity.x *= 0.85;
            flightState.velocity.y *= 0.85;
            flightState.velocity.z *= 0.85;
        }

        // Apply thrust speed acceleration
        const thrust = new THREE.Vector3(0, 0, 0);

        // Apply throttle acceleration continuously (forward or reverse)
        const throttleAccel = (currentThrottle / 100) * flightState.acceleration;
        thrust.addScaledVector(forward, throttleAccel);

        // Strafe and vertical thrust keys (Strafe with A/D is enabled in both modes, dampened to 0.35)
        if (keys.a) {
            thrust.addScaledVector(right, -flightState.acceleration * 0.35);
        }
        if (keys.d) {
            thrust.addScaledVector(right, flightState.acceleration * 0.35);
        }
        if (keys.space) {
            thrust.addScaledVector(up, flightState.acceleration);
        }
        if (keys.shift) {
            thrust.addScaledVector(up, -flightState.acceleration);
        }

        // Apply thrust to velocity
        flightState.velocity.x += thrust.x;
        flightState.velocity.y += thrust.y;
        flightState.velocity.z += thrust.z;

        // Apply space drag friction when key is released
        flightState.velocity.x *= flightState.friction;
        flightState.velocity.y *= flightState.friction;
        flightState.velocity.z *= flightState.friction;

        // Speed calculation (with 3x speed limit cap)
        const currentSpeed = Math.sqrt(
            flightState.velocity.x ** 2 + 
            flightState.velocity.y ** 2 + 
            flightState.velocity.z ** 2
        );

        // Speed limit cap (3x original limit = 240)
        if (currentSpeed > flightState.maxSpeed) {
            const ratio = flightState.maxSpeed / currentSpeed;
            flightState.velocity.x *= ratio;
            flightState.velocity.y *= ratio;
            flightState.velocity.z *= ratio;
        }

        // Apply velocity to ship group position
        shipGroup.position.x += flightState.velocity.x * delta;
        shipGroup.position.y += flightState.velocity.y * delta;
        shipGroup.position.z += flightState.velocity.z * delta;

        // Prevent ship from straying too far into the void (boundaries)
        const BOUNDARY = 1200;
        shipGroup.position.x = Math.max(-BOUNDARY, Math.min(BOUNDARY, shipGroup.position.x));
        shipGroup.position.y = Math.max(-BOUNDARY, Math.min(BOUNDARY, shipGroup.position.y));
        shipGroup.position.z = Math.max(-BOUNDARY, Math.min(BOUNDARY, shipGroup.position.z));

        // Update speedometer display UI
        const displaySpeed = Math.round(currentSpeed * 1.8); // Scale multiplier for aesthetic speedometer reading
        const speedValEl = document.getElementById("space-speed-val");
        if (speedValEl) speedValEl.textContent = `${displaySpeed} km/h`;

        const throttleValEl = document.getElementById("space-throttle-val");
        if (throttleValEl) {
            throttleValEl.textContent = `${Math.round(currentThrottle)}%`;
            if (currentThrottle > 0) {
                throttleValEl.style.color = "#00fac6"; // green/cyan thrusting
            } else if (currentThrottle < 0) {
                throttleValEl.style.color = "#EA4335"; // red reverse
            } else {
                throttleValEl.style.color = "#4285F4"; // blue neutral
            }
        }

        // Broadcast position and orientation to other players in the party
        if (typeof GalaxyMap !== "undefined" && GalaxyMap.getPartyCode()) {
            GalaxyMap.broadcastPosition(
                { x: shipGroup.position.x, y: shipGroup.position.y, z: shipGroup.position.z },
                { x: shipGroup.quaternion.x, y: shipGroup.quaternion.y, z: shipGroup.quaternion.z, w: shipGroup.quaternion.w }
            );
        }
    }

    function updateCoopPlayers() {
        if (typeof GalaxyMap === "undefined" || !GalaxyMap.getPartyCode()) {
            coopMembers.forEach((val, id) => {
                if (val.shipMesh) scene.remove(val.shipMesh);
                if (val.tagEl && val.tagEl.parentNode) val.tagEl.parentNode.removeChild(val.tagEl);
            });
            coopMembers.clear();
            return;
        }

        const partyMembers = GalaxyMap.getPartyMembers();
        const myPlayerId = GalaxyMap.getPlayerId ? GalaxyMap.getPlayerId() : null;
        if (!partyMembers) return;

        // 1. Remove members who left
        coopMembers.forEach((val, id) => {
            if (!partyMembers.has(id)) {
                if (val.shipMesh) scene.remove(val.shipMesh);
                if (val.tagEl && val.tagEl.parentNode) val.tagEl.parentNode.removeChild(val.tagEl);
                coopMembers.delete(id);
            }
        });

        // 2. Add / Update active members
        partyMembers.forEach((member, id) => {
            if (id === myPlayerId) return; // skip self

            let coop = coopMembers.get(id);
            if (!coop) {
                // Spawn new co-op ship mesh
                const mesh = createProceduralShipMesh(member.shipSpecs);
                scene.add(mesh);

                // Spawn tag element
                const tag = document.createElement("div");
                tag.className = "galaxy-member-tag"; // reuse the lobby/galaxy tag styling
                tag.style.borderColor = "#4285F4"; // light blue for co-op members
                tag.innerHTML = `<i class="fa-solid fa-user-astronaut"></i> ${member.name} (${member.shipSpecs.name})`;
                canvasContainer.appendChild(tag);

                coop = {
                    id: id,
                    shipMesh: mesh,
                    tagEl: tag,
                    lastSeen: member.lastSeen
                };
                coopMembers.set(id, coop);
            }

            // Update position and quaternion
            if (member.position) {
                coop.shipMesh.position.set(member.position.x, member.position.y, member.position.z);
            }
            if (member.quaternion) {
                coop.shipMesh.quaternion.set(member.quaternion.x, member.quaternion.y, member.quaternion.z, member.quaternion.w);
            }
            coop.lastSeen = member.lastSeen;
        });

        // 3. Project and position tags
        if (canvasContainer) {
            const width = canvasContainer.clientWidth;
            const height = canvasContainer.clientHeight;
            const tempV = new THREE.Vector3();

            coopMembers.forEach(coop => {
                if (coop.tagEl && coop.shipMesh) {
                    tempV.setFromMatrixPosition(coop.shipMesh.matrixWorld);
                    tempV.project(camera);

                    if (tempV.z > 1) {
                        coop.tagEl.style.display = 'none';
                    } else {
                        const x = (tempV.x * 0.5 + 0.5) * width;
                        const y = (tempV.y * -0.5 + 0.5) * height;

                        coop.tagEl.style.display = 'block';
                        coop.tagEl.style.left = `${x}px`;
                        coop.tagEl.style.top = `${y - 25}px`;
                    }
                }
            });
        }
    }

    // ─── Render Frame Animation ───────────────────────────────────────────────
    let lastTime = performance.now();
    function animate() {
        if (!isRunning) return;
        animationFrameId = requestAnimationFrame(animate);
        
        const now = performance.now();
        const delta = Math.min((now - lastTime) / 1000, 0.1); // Cap delta to prevent huge jumps
        lastTime = now;

        updateFlight(delta);
        checkProximity();
        updateCoopPlayers();

        // Animate scanner planet/star wobble if scanning is in progress
        if (wobbleMesh) {
            const time = (now - wobbleStartTime) * 0.008;
            const wScale = 1.0 + Math.sin(time * 6.0) * 0.18 * Math.exp(-time * 0.08); // Decaying planetary wobble
            wobbleMesh.scale.set(wScale, wScale, wScale);
        }

        // Get Camera World Position for billboard calculations
        const cameraWorldPos = new THREE.Vector3();
        camera.getWorldPosition(cameraWorldPos);

        // Slow rotating planetary labels & nodes for celestial life
        spaceNodes.forEach((mesh, idx) => {
            // Self rotation
            mesh.rotation.y += 0.006 * (1 + (idx % 3) * 0.2);
            
            // Make text label always look at camera (Billboard effect)
            mesh.children.forEach(child => {
                if (child instanceof THREE.Sprite) {
                    child.lookAt(cameraWorldPos);
                }
            });
        });

        renderer.render(scene, camera);
    }

    // ─── Initialize ────────────────────────────────────────────────────────────
    // ─── Initialize ────────────────────────────────────────────────────────────
    async function init(hierarchyData) {
        if (scene) {
            // Already initialized, just resume
            resume();
            return;
        }

        const loader = document.getElementById("space-loader");
        const loaderFill = document.getElementById("space-loader-fill");
        const loaderStatus = document.getElementById("space-loader-status");

        const updateLoader = (pct, statusText) => {
            if (loaderFill) loaderFill.style.width = `${pct}%`;
            if (loaderStatus) loaderStatus.textContent = statusText;
        };

        if (loader) {
            loader.classList.remove("hidden");
        }
        updateLoader(15, "Initializing celestial databases...");

        canvasContainer = document.getElementById("space-canvas-wrapper");
        flatNodes = flattenHierarchy(hierarchyData);

        // Fetch pre-computed UMAP coordinates
        updateLoader(35, "Fetching neural map coordinates...");
        try {
            const response = await fetch('vector_coords.json');
            if (response.ok) {
                updateLoader(55, "Parsing coordinate structures...");
                nodeCoordinates = await response.json();
            } else {
                throw new Error("Coords not found");
            }
        } catch (e) {
            updateLoader(50, "Synthesizing fallback orbit locations...");
            console.warn("[SpaceExplorer] Could not load vector_coords.json, simulating coordinate distribution...", e);
            // Simulate coords in space if python precomputation fails
            flatNodes.forEach((n, idx) => {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.random() * 2 - 1);
                const r = 200 + Math.random() * 600;
                nodeCoordinates[n.id] = [
                    r * Math.sin(phi) * Math.cos(theta),
                    r * Math.sin(phi) * Math.sin(theta),
                    r * Math.cos(phi)
                ];
            });
        }

        updateLoader(75, "Starting WebGL Three.js context...");

        // Setup THREE scene
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020208, 0.0006);

        // Setup Spaceship Group inside scene
        scene.add(shipGroup);

        // Setup 3D spaceship mesh model
        shipMesh = createSpaceshipMesh();
        shipGroup.add(shipMesh);
        shipMesh.visible = false; // Hidden in First-Person by default

        // Camera setup (added to shipGroup to follow it)
        const containerWidth = canvasContainer.clientWidth || window.innerWidth;
        const containerHeight = canvasContainer.clientHeight || window.innerHeight;
        camera = new THREE.PerspectiveCamera(60, containerWidth / containerHeight, 0.1, 3000);
        camera.position.set(0, 0, 0); // Position relative to ship cockpit
        shipGroup.add(camera);

        // Set initial shipGroup position in space (facing UMAP coordinates)
        shipGroup.position.set(0, 50, 600);

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(containerWidth, containerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        canvasContainer.innerHTML = "";
        canvasContainer.appendChild(renderer.domElement);

        updateLoader(85, "Spawning celestial bodies and gravity lines...");

        // Ambient Light - reduced to let star point lights illuminate the ship and planets dynamically
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.32);
        scene.add(ambientLight);

        // Build stars and nodes
        build3DWorld();

        // Setup input controls
        setupInputListeners();

        // Details details button click handler
        document.getElementById("space-hud-detail-btn").addEventListener("click", () => {
            if (targetedNode) {
                // Trigger standard app modal view
                if (typeof showFullContent === "function") {
                    showFullContent(targetedNode);
                }
            }
        });

        // Resize handler
        window.addEventListener('resize', () => {
            handleResize();
        });

        updateLoader(100, "Telemetry online. Entering simulation!");

        // Hide loader after a short aesthetic delay
        setTimeout(() => {
            if (loader) {
                loader.classList.add("hidden");
            }
        }, 850);

        resume();
    }

    function handleResize() {
        if (!camera || !renderer || !canvasContainer) return;
        const w = canvasContainer.clientWidth;
        const h = canvasContainer.clientHeight;
        if (w > 0 && h > 0) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
    }

    // ─── Start/Stop Animation loops ──────────────────────────────────────────
    function resume() {
        if (isRunning) return;
        isRunning = true;
        lastTime = performance.now();
        animate();
    }

    function pause() {
        isRunning = false;
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        // Clean up co-op ship meshes and tags from scene/DOM on tab-out/pause
        coopMembers.forEach((val, id) => {
            if (val.shipMesh) scene.remove(val.shipMesh);
            if (val.tagEl && val.tagEl.parentNode) val.tagEl.parentNode.removeChild(val.tagEl);
        });
        coopMembers.clear();
    }

    // ─── Chart Course Highlighting states ──────────────────────────────────────
    let chartedCourse = new Set();

    function setChartedCourse(nodeIds) {
        chartedCourse = new Set(nodeIds);
        visitedChartedNodes.clear();
        updateSpaceNodesHighlight();
        updateMissionObjectivesHUD();
    }

    function clearChartedCourse() {
        chartedCourse.clear();
        visitedChartedNodes.clear();
        updateSpaceNodesHighlight();
        updateMissionObjectivesHUD();
    }

    function updateMissionObjectivesHUD() {
        const hud = document.getElementById("space-mission-hud");
        const list = document.getElementById("space-mission-list");
        if (!hud || !list) return;

        if (chartedCourse.size === 0) {
            hud.classList.add("hidden");
            list.innerHTML = "";
            return;
        }

        hud.classList.remove("hidden");
        list.innerHTML = "";

        flatNodes.forEach(node => {
            if (chartedCourse.has(node.id)) {
                const isCompleted = visitedChartedNodes.has(node.id);
                
                const item = document.createElement("div");
                item.className = `mission-item ${isCompleted ? 'completed' : ''}`;
                item.dataset.nodeId = node.id;

                const checkbox = document.createElement("div");
                checkbox.className = "mission-item-checkbox";
                checkbox.innerHTML = '<i class="fa-solid fa-check"></i>';
                
                const title = document.createElement("span");
                title.className = "mission-item-title";
                title.textContent = node.title;
                
                item.appendChild(checkbox);
                item.appendChild(title);
                list.appendChild(item);
            }
        });
    }

    function updateSpaceNodesHighlight() {
        if (!scene) return;
        const hasActiveCourse = chartedCourse.size > 0;

        spaceNodes.forEach(mesh => {
            const nodeData = mesh.userData.nodeData;
            const isTarget = chartedCourse.has(nodeData.id);
            const textSprite = mesh.children.find(c => c instanceof THREE.Sprite);

            if (hasActiveCourse) {
                if (isTarget) {
                    mesh.material.opacity = 0.95;
                    mesh.scale.set(1.4, 1.4, 1.4); // Target nodes are larger and fully opaque
                    if (textSprite) textSprite.visible = true;
                } else {
                    mesh.material.opacity = 0.05; // 3D ghost blur/fade special effect
                    mesh.scale.set(0.65, 0.65, 0.65); // make non-course nodes small
                    if (textSprite) textSprite.visible = false; // hide labels for non-course nodes
                }
            } else {
                // Restore standard default highlights
                mesh.material.opacity = 0.95;
                mesh.scale.set(1.0, 1.0, 1.0);
                if (textSprite) textSprite.visible = true;
            }
        });

        // Dim orbit lines as well in Chart Course mode
        orbitLines.forEach(line => {
            if (hasActiveCourse) {
                line.material.opacity = 0.02;
            } else {
                line.material.opacity = 0.12;
            }
        });
    }

    // ─── Public API ────────────────────────────────────────────────────────────
    return {
        init,
        pause,
        resume,
        handleResize,
        setChartedCourse,
        clearChartedCourse,
        flattenHierarchy,
        getShipTransform: () => {
            return {
                position: { x: shipGroup.position.x, y: shipGroup.position.y, z: shipGroup.position.z },
                quaternion: { x: shipGroup.quaternion.x, y: shipGroup.quaternion.y, z: shipGroup.quaternion.z, w: shipGroup.quaternion.w }
            };
        }
    };
})();
