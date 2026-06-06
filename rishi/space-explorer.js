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
    
    // ─── Data State ────────────────────────────────────────────────────────────
    let nodeCoordinates = {}; // nodeId -> [x, y, z]
    let flatNodes = [];       // List of all node objects
    let spaceNodes = [];      // Three.js meshes representing nodes
    let orbitLines = [];      // Three.js lines connecting parent-child
    
    // ─── Flight State ──────────────────────────────────────────────────────────
    const flightState = {
        position: { x: 0, y: 0, z: 400 }, // Start position in space
        velocity: { x: 0, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: 0 },   // pitch = up/down, yaw = left/right
        speed: 0,
        maxSpeed: 80,
        acceleration: 1.5,
        friction: 0.96,
        targetRotation: { pitch: 0, yaw: 0 },
        steerSpeed: 0.003
    };

    // Keyboard state
    const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };
    
    // Steering cursor state (when not pointer-locked)
    let mouse = { x: 0, y: 0 };
    let canvasContainer = null;
    let targetedNode = null;

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
        
        ctx.font = 'Bold 24px "Outfit", "Segoe UI", sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Label background glow shadow
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        
        ctx.fillStyle = colorHex;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        
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
            if (e.key === ' ') keys.space = true;
            if (e.key === 'Shift') keys.shift = true;
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w') keys.w = false;
            if (k === 's') keys.s = false;
            if (k === 'a') keys.a = false;
            if (k === 'd') keys.d = false;
            if (e.key === ' ') keys.space = false;
            if (e.key === 'Shift') keys.shift = false;
        });

        canvasContainer.addEventListener('mousemove', (e) => {
            if (!isRunning) return;
            const rect = canvasContainer.getBoundingClientRect();
            // Normalize cursor: center is (0,0), range is [-1, 1]
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        });

        canvasContainer.addEventListener('mouseleave', () => {
            mouse.x = 0;
            mouse.y = 0;
        });
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

        // Render nodes at UMAP coordinates
        flatNodes.forEach(node => {
            const coords = nodeCoordinates[node.id] || [0, 0, 0];
            const type = defNodeTypes.includes(node.node_type) ? "default" : node.node_type;
            const config = typeConfigs[type] || typeConfigs["default"];
            
            // Sphere Geometry
            const geometry = new THREE.SphereGeometry(config.size, 16, 16);
            
            // Glowing mesh material
            const material = new THREE.MeshBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: 0.95
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(coords[0], coords[1], coords[2]);
            mesh.userData = { nodeData: node };
            
            // Add ring orbit if it is unit/topic
            if (node.node_type === "unit" || node.node_type === "course") {
                const ringGeo = new THREE.RingGeometry(config.size + 4, config.size + 4.5, 32);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: config.color,
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

        // Add parent-child connection lines (gravitational beams)
        flatNodes.forEach(node => {
            if (node.parent) {
                const startCoords = nodeCoordinates[node.parent.id] || [0, 0, 0];
                const endCoords = nodeCoordinates[node.id] || [0, 0, 0];
                
                const points = [
                    new THREE.Vector3(startCoords[0], startCoords[1], startCoords[2]),
                    new THREE.Vector3(endCoords[0], endCoords[1], endCoords[2])
                ];
                
                const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                const lineMat = new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.12
                });
                
                const line = new THREE.Line(lineGeo, lineMat);
                scene.add(line);
                orbitLines.push(line);
            }
        });
    }

    // ─── Proximity & Targeting ─────────────────────────────────────────────────
    function checkProximity() {
        let closestNode = null;
        let minDistance = Infinity;

        spaceNodes.forEach(mesh => {
            const dist = camera.position.distanceTo(mesh.position);
            if (dist < minDistance) {
                minDistance = dist;
                closestNode = mesh;
            }
        });

        // Trigger target threshold (e.g. within 160 units)
        const HUD_THRESHOLD = 180;
        const hudElement = document.getElementById("space-hud");
        
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

    // ─── Flight Navigation Loop ────────────────────────────────────────────────
    function updateFlight(delta) {
        // Steer based on normalized cursor coords
        // pitch = mouse.y, yaw = -mouse.x
        flightState.targetRotation.pitch = mouse.y * 1.2;
        flightState.targetRotation.yaw = -mouse.x * 1.5;

        // Interpolate pitch/yaw rotation (smooth ship steering response)
        flightState.rotation.pitch += (flightState.targetRotation.pitch - flightState.rotation.pitch) * 0.05;
        flightState.rotation.yaw += (flightState.targetRotation.yaw - flightState.rotation.yaw) * 0.05;

        // Apply steering rotation to camera orientation
        camera.rotation.order = "YXZ"; // Standard pitch-yaw ordering
        camera.rotation.x = flightState.rotation.pitch;
        camera.rotation.y = flightState.rotation.yaw;

        // Direction vectors relative to ship heading
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

        // Apply thrust speed acceleration
        const thrust = { x: 0, y: 0, z: 0 };
        let activeInput = false;

        if (keys.w) {
            thrust.addScaledVector(forward, flightState.acceleration);
            activeInput = true;
        }
        if (keys.s) {
            thrust.addScaledVector(forward, -flightState.acceleration);
            activeInput = true;
        }
        if (keys.a) {
            thrust.addScaledVector(right, -flightState.acceleration);
            activeInput = true;
        }
        if (keys.d) {
            thrust.addScaledVector(right, flightState.acceleration);
            activeInput = true;
        }
        if (keys.space) {
            thrust.addScaledVector(up, flightState.acceleration);
            activeInput = true;
        }
        if (keys.shift) {
            thrust.addScaledVector(up, -flightState.acceleration);
            activeInput = true;
        }

        // Apply thrust to velocity
        flightState.velocity.x += thrust.x;
        flightState.velocity.y += thrust.y;
        flightState.velocity.z += thrust.z;

        // Apply space drag friction when key is released
        flightState.velocity.x *= flightState.friction;
        flightState.velocity.y *= flightState.friction;
        flightState.velocity.z *= flightState.friction;

        // Speed calculation
        const currentSpeed = Math.sqrt(
            flightState.velocity.x ** 2 + 
            flightState.velocity.y ** 2 + 
            flightState.velocity.z ** 2
        );

        // Speed limit cap
        if (currentSpeed > flightState.maxSpeed) {
            const ratio = flightState.maxSpeed / currentSpeed;
            flightState.velocity.x *= ratio;
            flightState.velocity.y *= ratio;
            flightState.velocity.z *= ratio;
        }

        // Apply velocity to camera position
        camera.position.x += flightState.velocity.x * delta;
        camera.position.y += flightState.velocity.y * delta;
        camera.position.z += flightState.velocity.z * delta;

        // Prevent camera from straying too far into the void (infinite universe boundaries)
        const BOUNDARY = 1200;
        camera.position.x = Math.max(-BOUNDARY, Math.min(BOUNDARY, camera.position.x));
        camera.position.y = Math.max(-BOUNDARY, Math.min(BOUNDARY, camera.position.y));
        camera.position.z = Math.max(-BOUNDARY, Math.min(BOUNDARY, camera.position.z));

        // Update speedometer display UI
        const displaySpeed = Math.round(currentSpeed * 1.8); // Scale multiplier for aesthetic speedometer reading
        document.getElementById("space-speed-val").textContent = `${displaySpeed} km/h`;
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

        // Slow rotating planetary labels & nodes for celestial life
        spaceNodes.forEach((mesh, idx) => {
            // Self rotation
            mesh.rotation.y += 0.006 * (1 + (idx % 3) * 0.2);
            
            // Make text label always look at camera (Billboard effect)
            mesh.children.forEach(child => {
                if (child instanceof THREE.Sprite) {
                    child.lookAt(camera.position);
                }
            });
        });

        renderer.render(scene, camera);
    }

    // ─── Initialize ────────────────────────────────────────────────────────────
    async function init(hierarchyData) {
        if (scene) {
            // Already initialized, just resume
            resume();
            return;
        }

        canvasContainer = document.getElementById("space-canvas-wrapper");
        flatNodes = flattenHierarchy(hierarchyData);

        // Fetch pre-computed UMAP coordinates
        try {
            const response = await fetch('vector_coords.json');
            if (response.ok) {
                nodeCoordinates = await response.json();
            } else {
                throw new Error("Coords not found");
            }
        } catch (e) {
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

        // Setup THREE scene
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020208, 0.0006);

        // Camera setup
        const containerWidth = canvasContainer.clientWidth;
        const containerHeight = canvasContainer.clientHeight;
        camera = new THREE.PerspectiveCamera(60, containerWidth / containerHeight, 0.1, 3000);
        camera.position.set(0, 50, 600); // Start position

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(containerWidth, containerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        canvasContainer.innerHTML = "";
        canvasContainer.appendChild(renderer.domElement);

        // Ambient Light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
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
            if (!camera || !renderer) return;
            const w = canvasContainer.clientWidth;
            const h = canvasContainer.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });

        resume();
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
    }

    // ─── Public API ────────────────────────────────────────────────────────────
    return {
        init,
        pause,
        resume
    };
})();
