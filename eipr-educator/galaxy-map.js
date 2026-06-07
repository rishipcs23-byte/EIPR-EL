/**
 * EIPR Galaxy Map — 3D Embeddings Map & Co-op Multiplayer Lobby (galaxy-map.js)
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the full UMAP space nodes, provides party creation/joining,
 * and tracks live positions of co-op players via WebSocket LAN relay server.
 *
 * Multiplayer setup:
 *   Teacher: npm install && node server.js  (starts WebSocket relay on port 3001)
 *   Students: Open http://TEACHER_IP:8000 → Galaxy Map → enter teacher IP → join party
 */

const GalaxyMap = (() => {
    // ─── Three.js Globals ──────────────────────────────────────────────────────
    let scene, camera, renderer, controls;
    let canvasContainer = null;
    let isRunning = false;
    let animationFrameId = null;

    let spaceNodes = [];
    let orbitLines = [];
    let flatNodes = [];
    let nodeCoordinates = {};

    // ─── Multiplayer & Party State ─────────────────────────────────────────────
    let myPlayerId = "player_" + Math.floor(1000 + Math.random() * 9000);
    let myPlayerName = "Pilot-" + Math.floor(100 + Math.random() * 900);
    let currentPartyCode = "";

    // Roster of members: memberId -> { id, name, shipSpecs, position, quaternion, lastSeen, shipMesh, tagEl }
    const partyMembers = new Map();

    // Procedural Ship Specifications for current player
    let myShipSpecs = null;
    let myShipMesh = null;
    let myTagEl = null;
    let partyLeaderId = "";

    // Simulated Bot Pilots (for co-op demonstration)
    const bots = [];

    // ─── Teacher Mode ───────────────────────────────────────────────────────────
    let isTeacherMode = false;
    let teacherWsClient = null;           // Separate WS connection for teacher
    let teacherWsConnected = false;
    // Global student registry (teacher only): playerId -> record
    const globalStudents = new Map();

    // ─── WebSocket Multiplayer (LAN relay) ─────────────────────────────────────
    // ws:// relay server — defaults to same host, port 3001
    let wsServerHost = window.location.hostname || 'localhost';
    let wsClient = null;
    let wsReconnectTimer = null;
    let wsConnected = false;
    let wsReconnectDelay = 1500; // ms, doubles on each failure
    const WS_PORT = 3001;
    const WS_MAX_RECONNECT = 12000; // cap backoff at 12s

    // Node configuration
    const typeConfigs = {
        "course":    { color: 0x4285F4, size: 10, glow: true },
        "unit":      { color: 0xEA4335, size: 7,  glow: true },
        "topic":     { color: 0xFBBC05, size: 4.5,glow: false },
        "subtopic":  { color: 0x34A853, size: 3,  glow: false },
        "concept":   { color: 0x8A3FFC, size: 2.2,glow: false },
        "default":   { color: 0x00FAC6, size: 2,  glow: false }
    };
    const defNodeTypes = ["case_study", "example", "activity"];

    // ─── Ship Procedural Generator ─────────────────────────────────────────────
    function generateShipSpecs() {
        const hullTypes = ["Dreadnought", "Interceptor", "Scout Cruiser", "Wasp Fighter", "Apex Sentinel"];
        const wings = ["Swept Wings", "Delta Wings", "Stabilizer Ring", "Dual Folding Wings"];
        const cores = ["Singularity Drive", "Plasma Reactor", "Antimatter Burner", "Hyper-drive Engine"];
        const systems = ["Lidar Sensor Spire", "Nanite Autorepair", "Tactical Deflectors", "EMP Discharger"];
        
        const hull = hullTypes[Math.floor(Math.random() * hullTypes.length)];
        const wing = wings[Math.floor(Math.random() * wings.length)];
        const core = cores[Math.floor(Math.random() * cores.length)];
        const system = systems[Math.floor(Math.random() * systems.length)];
        const hue = Math.floor(Math.random() * 360);

        return {
            hull,
            wing,
            core,
            system,
            hue,
            name: `${hull.split(' ')[0]} ${wing.split(' ')[0]}-${Math.floor(10 + Math.random() * 89)}`
        };
    }

    function renderShipSpecsUI() {
        const container = document.getElementById("procedural-ship-specs");
        if (container && myShipSpecs) {
            container.innerHTML = `
                <div class="spec-item"><span>Ship Name:</span> <span class="spec-val" style="color: hsl(${myShipSpecs.hue}, 100%, 70%)">${myShipSpecs.name}</span></div>
                <div class="spec-item"><span>Hull Frame:</span> <span class="spec-val">${myShipSpecs.hull}</span></div>
                <div class="spec-item"><span>Wing Type:</span> <span class="spec-val">${myShipSpecs.wing}</span></div>
                <div class="spec-item"><span>Power Core:</span> <span class="spec-val">${myShipSpecs.core}</span></div>
                <div class="spec-item"><span>Sub-system:</span> <span class="spec-val">${myShipSpecs.system}</span></div>
            `;
        }
    }

    // Creates a unique procedural spaceship mesh based on specs
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
            bodyGeo = new THREE.ConeGeometry(3, 16, 4);
        } else if (specs.hull.includes("Dreadnought")) {
            bodyGeo = new THREE.BoxGeometry(4, 3, 18);
        } else {
            bodyGeo = new THREE.CylinderGeometry(1.2, 2.5, 14, 5);
        }
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, shipMat);
        group.add(body);

        // 2. Cockpit
        const cockpitGeo = new THREE.SphereGeometry(1.4, 8, 8);
        cockpitGeo.scale(1, 0.8, 2);
        const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
        cockpit.position.set(0, 1.2, -3);
        group.add(cockpit);

        // 3. Wings
        if (specs.wing.includes("Ring")) {
            const ringGeo = new THREE.TorusGeometry(6, 0.6, 8, 24);
            const ring = new THREE.Mesh(ringGeo, accentMat);
            ring.position.set(0, 0, 2);
            group.add(ring);
        } else if (specs.wing.includes("Delta")) {
            const wingGeo = new THREE.ConeGeometry(8, 6, 3);
            wingGeo.rotateX(Math.PI / 2);
            const wing = new THREE.Mesh(wingGeo, accentMat);
            wing.position.set(0, -0.4, 1.5);
            group.add(wing);
        } else {
            // Standard sweeping wings
            const wingLeftGeo = new THREE.BoxGeometry(11, 0.3, 4);
            const wingLeft = new THREE.Mesh(wingLeftGeo, accentMat);
            wingLeft.position.set(-6, -0.2, 1);
            wingLeft.rotation.y = -Math.PI / 6;
            wingLeft.rotation.z = -Math.PI / 24;
            group.add(wingLeft);

            const wingRight = wingLeft.clone();
            wingRight.position.x = 6;
            wingRight.rotation.y = Math.PI / 6;
            wingRight.rotation.z = Math.PI / 24;
            group.add(wingRight);
        }

        // 4. Engines
        const engineGeo = new THREE.CylinderGeometry(0.8, 1.2, 3, 6);
        engineGeo.rotateX(Math.PI / 2);
        const engineMat = new THREE.MeshBasicMaterial({ color: accentColor });
        
        const leftEngine = new THREE.Mesh(engineGeo, shipMat);
        leftEngine.position.set(-1.5, -0.5, 7);
        const flameLeft = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2, 6), engineMat);
        flameLeft.rotateX(-Math.PI / 2);
        flameLeft.position.set(0, 0, 2);
        leftEngine.add(flameLeft);
        group.add(leftEngine);

        const rightEngine = leftEngine.clone();
        rightEngine.position.x = 1.5;
        group.add(rightEngine);

        // Add a PointLight flare inside the engines
        const engineLight = new THREE.PointLight(accentColor, 2, 20);
        engineLight.position.set(0, -0.5, 9);
        group.add(engineLight);

        // Scale down for map display
        group.scale.set(0.6, 0.6, 0.6);
        return group;
    }

    function setWsStatus(connected) {
        wsConnected = connected;
        const chips = [document.getElementById('ws-status-chip'), document.getElementById('ws-status-chip-map')];
        chips.forEach(el => {
            if (!el) return;
            if (connected) {
                el.innerHTML = '&#9679; ONLINE';
                el.className = 'glb-status-chip online';
                el.style.color = ''; // reset inline styles if any
            } else {
                el.innerHTML = '&#9675; OFFLINE';
                el.className = 'glb-status-chip offline';
                el.style.color = '';
            }
        });
    }

    function connectWebSocket(partyCode) {
        if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
        if (wsClient) { try { wsClient.close(); } catch(e){} wsClient = null; }

        const wsUrl = `ws://${wsServerHost}:${WS_PORT}?party=${encodeURIComponent(partyCode)}`;
        console.log(`[GalaxyMap] Connecting to ${wsUrl}`);
        setWsStatus(false);

        let ws;
        try {
            ws = new WebSocket(wsUrl);
        } catch (e) {
            console.error('[GalaxyMap] WebSocket creation failed:', e);
            scheduleWsReconnect(partyCode);
            return;
        }
        wsClient = ws;

        ws.onopen = () => {
            console.log('[GalaxyMap] WebSocket connected');
            setWsStatus(true);
            wsReconnectDelay = 1500; // reset backoff
            broadcastState();
        };

        ws.onmessage = (e) => {
            let data;
            try { data = JSON.parse(e.data); } catch(err) { return; }
            if (!data) return;

            // Server welcome — nothing to do
            if (data.type === 'SERVER_WELCOME') return;

            // Guard: only process messages for our current party
            if (data.partyCode && data.partyCode !== currentPartyCode) return;

            if (data.type === 'MEMBER_STATE') {
                handleMemberState(data);
            } else if (data.type === 'MEMBER_POS') {
                handleMemberPosition(data);
            } else if (data.type === 'MEMBER_LEAVE') {
                removePartyMember(data.memberId);
            } else if (data.type === 'LEADER_CHART_COURSE') {
                if (myPlayerId !== data.leaderId) {
                    partyLeaderId = data.leaderId;
                    if (typeof SpaceExplorer !== 'undefined') {
                        SpaceExplorer.setChartedCourse(data.nodeIds);
                    }
                }
            } else if (data.type === 'MISSION_BROADCAST') {
                // Student received a teacher mission broadcast
                showMissionToast(data);
            }
        };

        ws.onclose = (ev) => {
            console.warn('[GalaxyMap] WebSocket closed:', ev.code, ev.reason);
            setWsStatus(false);
            wsClient = null;
            if (currentPartyCode) {
                scheduleWsReconnect(currentPartyCode);
            }
        };

        ws.onerror = (err) => {
            console.error('[GalaxyMap] WebSocket error:', err);
            setWsStatus(false);
        };
    }

    const studentCompletions = new Map(); // playerId -> Set of completed nodeIds

    // ─── Ship Procedural Generator ─────────────────────────────────────────────
    function generateShipSpecs() {
        const hullTypes = ["Dreadnought", "Interceptor", "Scout Cruiser", "Wasp Fighter", "Apex Sentinel"];
        const wings = ["Swept Wings", "Delta Wings", "Stabilizer Ring", "Dual Folding Wings"];
        const cores = ["Singularity Drive", "Plasma Reactor", "Antimatter Burner", "Hyper-drive Engine"];
        const systems = ["Lidar Sensor Spire", "Nanite Autorepair", "Tactical Deflectors", "EMP Discharger"];
        
        const hull = hullTypes[Math.floor(Math.random() * hullTypes.length)];
        const wing = wings[Math.floor(Math.random() * wings.length)];
        const core = cores[Math.floor(Math.random() * cores.length)];
        const system = systems[Math.floor(Math.random() * systems.length)];
        const hue = Math.floor(Math.random() * 360);

        return {
            hull,
            wing,
            core,
            system,
            hue,
            name: `${hull.split(' ')[0]} ${wing.split(' ')[0]}-${Math.floor(10 + Math.random() * 89)}`
        };
    }

    function renderShipSpecsUI() {
        const container = document.getElementById("procedural-ship-specs");
        if (container && myShipSpecs) {
            container.innerHTML = `
                <div class="spec-item"><span>Ship Name:</span> <span class="spec-val" style="color: hsl(${myShipSpecs.hue}, 100%, 70%)">${myShipSpecs.name}</span></div>
                <div class="spec-item"><span>Hull Frame:</span> <span class="spec-val">${myShipSpecs.hull}</span></div>
                <div class="spec-item"><span>Wing Type:</span> <span class="spec-val">${myShipSpecs.wing}</span></div>
                <div class="spec-item"><span>Power Core:</span> <span class="spec-val">${myShipSpecs.core}</span></div>
                <div class="spec-item"><span>Sub-system:</span> <span class="spec-val">${myShipSpecs.system}</span></div>
            `;
        }
    }

    // Creates a unique procedural spaceship mesh based on specs
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
            bodyGeo = new THREE.ConeGeometry(3, 16, 4);
        } else if (specs.hull.includes("Dreadnought")) {
            bodyGeo = new THREE.BoxGeometry(4, 3, 18);
        } else {
            bodyGeo = new THREE.CylinderGeometry(1.2, 2.5, 14, 5);
        }
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, shipMat);
        group.add(body);

        // 2. Cockpit
        const cockpitGeo = new THREE.SphereGeometry(1.4, 8, 8);
        cockpitGeo.scale(1, 0.8, 2);
        const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
        cockpit.position.set(0, 1.2, -3);
        group.add(cockpit);

        // 3. Wings
        if (specs.wing.includes("Ring")) {
            const ringGeo = new THREE.TorusGeometry(6, 0.6, 8, 24);
            const ring = new THREE.Mesh(ringGeo, accentMat);
            ring.position.set(0, 0, 2);
            group.add(ring);
        } else if (specs.wing.includes("Delta")) {
            const wingGeo = new THREE.ConeGeometry(8, 6, 3);
            wingGeo.rotateX(Math.PI / 2);
            const wing = new THREE.Mesh(wingGeo, accentMat);
            wing.position.set(0, -0.4, 1.5);
            group.add(wing);
        } else {
            // Standard sweeping wings
            const wingLeftGeo = new THREE.BoxGeometry(11, 0.3, 4);
            const wingLeft = new THREE.Mesh(wingLeftGeo, accentMat);
            wingLeft.position.set(-6, -0.2, 1);
            wingLeft.rotation.y = -Math.PI / 6;
            wingLeft.rotation.z = -Math.PI / 24;
            group.add(wingLeft);

            const wingRight = wingLeft.clone();
            wingRight.position.x = 6;
            wingRight.rotation.y = Math.PI / 6;
            wingRight.rotation.z = Math.PI / 24;
            group.add(wingRight);
        }

        // 4. Engines
        const engineGeo = new THREE.CylinderGeometry(0.8, 1.2, 3, 6);
        engineGeo.rotateX(Math.PI / 2);
        const engineMat = new THREE.MeshBasicMaterial({ color: accentColor });
        
        const leftEngine = new THREE.Mesh(engineGeo, shipMat);
        leftEngine.position.set(-1.5, -0.5, 7);
        const flameLeft = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2, 6), engineMat);
        flameLeft.rotateX(-Math.PI / 2);
        flameLeft.position.set(0, 0, 2);
        leftEngine.add(flameLeft);
        group.add(leftEngine);

        const rightEngine = leftEngine.clone();
        rightEngine.position.x = 1.5;
        group.add(rightEngine);

        // Add a PointLight flare inside the engines
        const engineLight = new THREE.PointLight(accentColor, 2, 20);
        engineLight.position.set(0, -0.5, 9);
        group.add(engineLight);

        // Scale down for map display
        group.scale.set(0.6, 0.6, 0.6);
        return group;
    }

    function setWsStatus(connected) {
        wsConnected = connected;
        const chips = [document.getElementById('ws-status-chip'), document.getElementById('ws-status-chip-map')];
        chips.forEach(el => {
            if (!el) return;
            if (connected) {
                el.innerHTML = '&#9679; ONLINE';
                el.className = 'glb-status-chip online';
                el.style.color = ''; // reset inline styles if any
            } else {
                el.innerHTML = '&#9675; OFFLINE';
                el.className = 'glb-status-chip offline';
                el.style.color = '';
            }
        });
    }

    function connectWebSocket(partyCode) {
        if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
        if (wsClient) { try { wsClient.close(); } catch(e){} wsClient = null; }

        const wsUrl = `ws://${wsServerHost}:${WS_PORT}?party=${encodeURIComponent(partyCode)}`;
        console.log(`[GalaxyMap] Connecting to ${wsUrl}`);
        setWsStatus(false);

        let ws;
        try {
            ws = new WebSocket(wsUrl);
        } catch (e) {
            console.error('[GalaxyMap] WebSocket creation failed:', e);
            scheduleWsReconnect(partyCode);
            return;
        }
        wsClient = ws;

        ws.onopen = () => {
            console.log('[GalaxyMap] WebSocket connected');
            setWsStatus(true);
            wsReconnectDelay = 1500; // reset backoff
            broadcastState();
        };

        ws.onmessage = (e) => {
            let data;
            try { data = JSON.parse(e.data); } catch(err) { return; }
            if (!data) return;

            // Server welcome — nothing to do
            if (data.type === 'SERVER_WELCOME') return;

            // Guard: only process messages for our current party
            if (data.partyCode && data.partyCode !== currentPartyCode) return;

            if (data.type === 'MEMBER_STATE') {
                handleMemberState(data);
            } else if (data.type === 'MEMBER_POS') {
                handleMemberPosition(data);
            } else if (data.type === 'MEMBER_LEAVE') {
                removePartyMember(data.memberId);
            } else if (data.type === 'LEADER_CHART_COURSE') {
                if (myPlayerId !== data.leaderId) {
                    partyLeaderId = data.leaderId;
                    if (typeof SpaceExplorer !== 'undefined') {
                        SpaceExplorer.setChartedCourse(data.nodeIds);
                    }
                }
            } else if (data.type === 'MISSION_BROADCAST') {
                // Student received a teacher mission broadcast
                showMissionToast(data);
            }
        };

        ws.onclose = (ev) => {
            console.warn('[GalaxyMap] WebSocket closed:', ev.code, ev.reason);
            setWsStatus(false);
            wsClient = null;
            if (currentPartyCode) {
                scheduleWsReconnect(currentPartyCode);
            }
        };

        ws.onerror = (err) => {
            console.error('[GalaxyMap] WebSocket error:', err);
            setWsStatus(false);
        };
    }

    // ─── Teacher WebSocket (connects on __TEACHER__ party) ─────────────────────
    function connectTeacherWebSocket() {
        if (teacherWsClient) { try { teacherWsClient.close(); } catch(e){} teacherWsClient = null; }

        const wsUrl = `ws://${wsServerHost}:${WS_PORT}?party=__TEACHER__`;
        console.log(`[Teacher] Connecting to ${wsUrl}`);

        let ws;
        try { ws = new WebSocket(wsUrl); } catch(e) {
            console.error('[Teacher] WebSocket creation failed:', e);
            return;
        }
        teacherWsClient = ws;

        ws.onopen = () => {
            console.log('[Teacher] Teacher WS connected');
            teacherWsConnected = true;
            const el = document.getElementById('teacher-ws-indicator');
            if (el) { el.textContent = '● ONLINE'; el.style.color = '#34A853'; }
        };

        ws.onmessage = (e) => {
            let data;
            try { data = JSON.parse(e.data); } catch(err) { return; }
            if (!data) return;

            if (data.type === 'GLOBAL_ROSTER') {
                handleGlobalRoster(data.roster || []);
            } else if (data.type === 'GLOBAL_POS_UPDATE') {
                handleGlobalPosUpdate(data);
            } else if (data.type === 'MISSION_COMPLETE') {
                // Track completion
                if (!studentCompletions.has(data.playerId)) {
                    studentCompletions.set(data.playerId, new Set());
                }
                studentCompletions.get(data.playerId).add(data.nodeId);
                // Re-render UI
                handleGlobalRoster(Array.from(globalStudents.values()));
            } else if (data.type === 'MISSION_BROADCAST_ACK') {
                // Teacher's broadcast was confirmed
                const btn = document.getElementById('teacher-broadcast-btn');
                if (btn) {
                    btn.classList.add('sent');
                    btn.innerHTML = `<i class="fa-solid fa-check"></i>&nbsp; Sent to ${data.recipientCount} Students!`;
                    setTimeout(() => {
                        btn.classList.remove('sent');
                        btn.innerHTML = `<i class="fa-solid fa-satellite-dish"></i>&nbsp; Broadcast Mission to All Students`;
                    }, 3000);
                }
                // Increment missions sent counter
                const counter = document.getElementById('teacher-stat-missions');
                if (counter) counter.textContent = (parseInt(counter.textContent) || 0) + 1;
            }
        };

        ws.onclose = () => {
            console.warn('[Teacher] Teacher WS closed');
            teacherWsConnected = false;
            teacherWsClient = null;
            const el = document.getElementById('teacher-ws-indicator');
            if (el) { el.textContent = '○ OFFLINE'; el.style.color = '#EA4335'; }
            // Reconnect after 3 seconds
            if (isTeacherMode) {
                setTimeout(() => connectTeacherWebSocket(), 3000);
            }
        };

        ws.onerror = () => {
            teacherWsConnected = false;
        };
    }

    function handleGlobalRoster(roster) {
        // Remove students who are no longer present
        const activeIds = new Set(roster.map(r => r.playerId));
        globalStudents.forEach((student, id) => {
            if (!activeIds.has(id)) {
                removeGlobalStudent(id);
            }
        });

        // Add/update students
        roster.forEach(r => {
            if (!r.playerId) return;
            if (!globalStudents.has(r.playerId)) {
                // New student — spawn their ship
                const student = { ...r, shipMesh: null, tagEl: null };
                globalStudents.set(r.playerId, student);
                spawnGlobalStudentShip(student);
            } else {
                // Update existing
                const existing = globalStudents.get(r.playerId);
                Object.assign(existing, r);
            }
        });

        // Update teacher dashboard roster
        updateTeacherRosterUI(roster);

        // Update stats
        const studentStat = document.getElementById('teacher-stat-students');
        if (studentStat) studentStat.textContent = roster.length;

        const parties = new Set(roster.map(r => r.partyCode).filter(c => c && c !== '__TEACHER__'));
        const partyStat = document.getElementById('teacher-stat-parties');
        if (partyStat) partyStat.textContent = parties.size;
    }

    function handleGlobalPosUpdate(data) {
        const student = globalStudents.get(data.playerId);
        if (student && student.shipMesh) {
            student.shipMesh.position.set(data.position.x, data.position.y, data.position.z);
            student.shipMesh.quaternion.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
            student.position = data.position;
            student.quaternion = data.quaternion;
        }
    }

    // Spawn gold-aura ship for a global student (visible only to teacher)
    function spawnGlobalStudentShip(student) {
        if (!scene || !student.shipSpecs) return;
        const ship = createProceduralShipMesh(student.shipSpecs);

        // Gold ring aura to distinguish from party members
        const ringGeo = new THREE.TorusGeometry(9, 0.8, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xFBBC05, transparent: true, opacity: 0.6 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ship.add(ring);

        if (student.position) {
            ship.position.set(student.position.x, student.position.y, student.position.z);
        } else {
            ship.position.set(0, 50, 600);
        }
        scene.add(ship);
        student.shipMesh = ship;
    }

    function removeGlobalStudent(playerId) {
        const student = globalStudents.get(playerId);
        if (student) {
            if (student.shipMesh && scene) scene.remove(student.shipMesh);
            globalStudents.delete(playerId);
        }
    }

    function updateTeacherRosterUI(roster) {
        const tbody = document.getElementById('teacher-roster-tbody');
        if (!tbody) return;

        if (roster.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4">
                <div class="teacher-roster-empty">
                    <i class="fa-solid fa-satellite-dish"></i>
                    <p>No students connected.<br>Start the server and share your IP with students.</p>
                </div>
            </td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        roster.forEach(r => {
            const hue = r.shipSpecs ? r.shipSpecs.hue : 180;
            const partyDisplay = r.partyCode && r.partyCode !== '__TEACHER__' ? r.partyCode : 'SOLO';
            const isSolo = partyDisplay === 'SOLO';
            const shipName = r.shipSpecs ? r.shipSpecs.name : 'Unknown';
            const initials = (r.playerName || '??').substring(0, 2).toUpperCase();
            const tr = document.createElement('tr');
            
            const completions = studentCompletions.has(r.playerId) ? studentCompletions.get(r.playerId).size : 0;
            const completionsDisplay = completions > 0 
                ? `<span class="completion-badge" style="background:rgba(251,188,5,0.2);color:#FBBC05;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;border:1px solid rgba(251,188,5,0.4);">${completions} ✓</span>`
                : `<span style="color:rgba(255,255,255,0.25);">0 completed</span>`;

            tr.innerHTML = `
                <td>
                    <div class="tr-name-cell">
                        <div class="tr-avatar" style="background:hsl(${hue},85%,48%)">${initials}</div>
                        <span>${r.playerName || 'Unknown Pilot'}</span>
                    </div>
                </td>
                <td style="font-size:11px;color:rgba(255,255,255,0.55);">${shipName}</td>
                <td><span class="tr-party-badge ${isSolo ? 'solo' : ''}">${partyDisplay}</span></td>
                <td>${completionsDisplay}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function scheduleWsReconnect(partyCode) {
        if (wsReconnectTimer) return;
        wsReconnectTimer = setTimeout(() => {
            wsReconnectTimer = null;
            if (currentPartyCode) connectWebSocket(partyCode);
        }, wsReconnectDelay);
        wsReconnectDelay = Math.min(wsReconnectDelay * 2, WS_MAX_RECONNECT);
    }

    function wsSend(data) {
        if (!wsClient || wsClient.readyState !== WebSocket.OPEN) return;
        try { wsClient.send(JSON.stringify(data)); } catch(e) {}
    }

    // Teacher-specific send (over teacher WS)
    function teacherWsSend(data) {
        if (!teacherWsClient || teacherWsClient.readyState !== WebSocket.OPEN) return;
        try { teacherWsClient.send(JSON.stringify(data)); } catch(e) {}
    }


    function broadcastState() {
        if (!currentPartyCode) return;
        wsSend({
            type: 'MEMBER_STATE',
            partyCode: currentPartyCode,
            memberId: myPlayerId,
            memberName: myPlayerName,
            shipSpecs: myShipSpecs,
            isLeader: (partyLeaderId === myPlayerId),
            leaderId: partyLeaderId
        });
    }

    // Invoked by SpaceExplorer flight loop to pipe positions live to the party map
    function broadcastPosition(pos, quat) {
        if (!currentPartyCode) return;
        wsSend({
            type: 'MEMBER_POS',
            partyCode: currentPartyCode,
            memberId: myPlayerId,
            position: pos,
            quaternion: quat
        });
    }

    function broadcastChartedCourse(nodeIds) {
        if (!currentPartyCode) return;
        if (partyLeaderId !== myPlayerId) return;
        wsSend({
            type: 'LEADER_CHART_COURSE',
            partyCode: currentPartyCode,
            leaderId: myPlayerId,
            nodeIds: nodeIds
        });
    }

    function handleMemberState(data) {
        if (data.memberId === myPlayerId) return; // Ignore self
        
        let member = partyMembers.get(data.memberId);
        let isNew = !member;
        if (isNew) {
            member = {
                id: data.memberId,
                name: data.memberName,
                shipSpecs: data.shipSpecs,
                position: { x: 0, y: 50, z: 600 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
                shipMesh: null,
                tagEl: null
            };
            partyMembers.set(data.memberId, member);
            spawnMemberShip(member);
        } else {
            // Update details
            member.name = data.memberName;
            member.shipSpecs = data.shipSpecs;
        }
        member.lastSeen = Date.now();
        updatePartyRosterUI();

        // If a new member joined, reply with our state immediately so they discover us
        if (isNew) {
            broadcastState();
        }
    }

    function handleMemberPosition(data) {
        if (data.memberId === myPlayerId) return;
        const member = partyMembers.get(data.memberId);
        if (member) {
            member.position = data.position;
            member.quaternion = data.quaternion;
            member.lastSeen = Date.now();

            if (member.shipMesh) {
                member.shipMesh.position.set(data.position.x, data.position.y, data.position.z);
                member.shipMesh.quaternion.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
            }
        }
    }

    function spawnMemberShip(member) {
        if (!scene) return;
        if (member.shipMesh) scene.remove(member.shipMesh);
        
        const ship = createProceduralShipMesh(member.shipSpecs);
        ship.position.set(member.position.x, member.position.y, member.position.z);
        scene.add(ship);
        member.shipMesh = ship;

        // Create overlay tag
        const tag = document.createElement("div");
        tag.className = "galaxy-member-tag";
        tag.innerHTML = `<i class="fa-solid fa-user-astronaut"></i> ${member.name} (${member.shipSpecs.name})`;
        canvasContainer.appendChild(tag);
        member.tagEl = tag;
    }

    function removePartyMember(memberId) {
        const member = partyMembers.get(memberId);
        if (member) {
            if (member.shipMesh && scene) scene.remove(member.shipMesh);
            if (member.tagEl && member.tagEl.parentNode) member.tagEl.parentNode.removeChild(member.tagEl);
            partyMembers.delete(memberId);
            updatePartyRosterUI();
        }
    }

    // ─── Bots (Co-op Simulation) ──────────────────────────────────────────────
    function spawnBots() {
        // Clear existing bots
        bots.forEach(b => {
            if (b.shipMesh && scene) scene.remove(b.shipMesh);
            if (b.tagEl && b.tagEl.parentNode) b.tagEl.parentNode.removeChild(b.tagEl);
        });
        bots.length = 0;

        if (!currentPartyCode) return;

        const botSpecs = [
            { id: "bot_gemma", name: "Gemma-Pilot", specs: { hull: "Interceptor", wing: "Swept Wings", core: "Plasma Reactor", system: "Deflectors", hue: 120, name: "Gemma-1" } },
            { id: "bot_navi", name: "Explorer-Bot", specs: { hull: "Scout Cruiser", wing: "Stabilizer Ring", core: "Singularity Drive", system: "EMP", hue: 280, name: "Explorer-X" } }
        ];

        botSpecs.forEach(b => {
            const ship = createProceduralShipMesh(b.specs);
            ship.position.set(0, 50, 600);
            scene.add(ship);

            const tag = document.createElement("div");
            tag.className = "galaxy-member-tag";
            tag.style.borderColor = "#FBBC05"; // yellow border for bots
            tag.innerHTML = `<i class="fa-solid fa-robot"></i> ${b.name} (${b.specs.name})`;
            canvasContainer.appendChild(tag);

            // Pathfinding data: target random nodes
            const botData = {
                id: b.id,
                name: b.name,
                specs: b.specs,
                shipMesh: ship,
                tagEl: tag,
                position: new THREE.Vector3(0, 50, 600),
                targetPos: new THREE.Vector3(0, 50, 600),
                speed: 80 + Math.random() * 50
            };
            bots.push(botData);
            pickNewBotTarget(botData);
        });

        updatePartyRosterUI();
    }

    function pickNewBotTarget(bot) {
        if (flatNodes.length === 0) return;
        const randomNode = flatNodes[Math.floor(Math.random() * flatNodes.length)];
        const coords = nodeCoordinates[randomNode.id] || [0, 0, 0];
        bot.targetPos.set(coords[0], coords[1], coords[2]);
    }

    function updateBots(delta) {
        bots.forEach(bot => {
            const dir = new THREE.Vector3().subVectors(bot.targetPos, bot.position);
            const dist = dir.length();

            if (dist < 10) {
                pickNewBotTarget(bot);
            } else {
                dir.normalize();
                bot.position.addScaledVector(dir, bot.speed * delta);
                bot.shipMesh.position.copy(bot.position);

                // Look at target point smoothly
                const targetMatrix = new THREE.Matrix4().lookAt(bot.targetPos, bot.position, new THREE.Vector3(0, 1, 0));
                const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(targetMatrix);
                bot.shipMesh.quaternion.slerp(targetQuaternion, 0.05);
            }
        });
    }

    function updatePartyRosterUI() {
        // 1. Lobby Roster
        const roster = document.getElementById("party-roster-list");
        if (roster) {
            roster.innerHTML = "";
            const isILeader = (partyLeaderId === myPlayerId) || (!partyLeaderId);

            // Local Player
            const localItem = document.createElement("div");
            localItem.className = "glb-roster-member";
            localItem.innerHTML = `
                <div class="member-avatar" style="background: hsl(${myShipSpecs.hue}, 100%, 40%)">You</div>
                <div class="member-info">
                    <div class="member-name">${myPlayerName}</div>
                    <div class="member-ship">${myShipSpecs.name}</div>
                </div>
                <span class="member-badge badge-you">YOU</span>
            `;
            roster.appendChild(localItem);

            // Party Members
            partyMembers.forEach(member => {
                const isMemLeader = (partyLeaderId === member.id) || member.isLeader;
                const item = document.createElement("div");
                item.className = "glb-roster-member";
                item.innerHTML = `
                    <div class="member-avatar" style="background: hsl(${member.shipSpecs.hue}, 100%, 40%)">${member.name.substring(0, 2)}</div>
                    <div class="member-info">
                        <div class="member-name">${member.name}</div>
                        <div class="member-ship">${member.shipSpecs.name}</div>
                    </div>
                    <span class="member-badge ${isMemLeader ? 'badge-leader' : 'badge-member'}">${isMemLeader ? 'LEADER' : 'MEMBER'}</span>
                `;
                roster.appendChild(item);
            });

            // Bots
            bots.forEach(bot => {
                const item = document.createElement("div");
                item.className = "glb-roster-member";
                item.innerHTML = `
                    <div class="member-avatar" style="background: hsl(${bot.specs.hue}, 100%, 40%)">AI</div>
                    <div class="member-info">
                        <div class="member-name">${bot.name}</div>
                        <div class="member-ship">${bot.specs.name}</div>
                    </div>
                    <span class="member-badge badge-bot">BOT</span>
                `;
                roster.appendChild(item);
            });
            
            if (roster.children.length === 0) {
                roster.innerHTML = `
                    <div class="glb-roster-empty">
                        <i class="fa-solid fa-satellite-dish"></i>
                        <p>No pilots connected.<br>Create or join a party to see your crew.</p>
                    </div>
                `;
            }
        }

        // 2. Live Map Overlay Roster
        const liveRoster = document.getElementById("galaxy-live-roster-list");
        if (liveRoster) {
            liveRoster.innerHTML = "";
            
            // Local Player
            const localLive = document.createElement("div");
            localLive.className = "glr-item";
            localLive.innerHTML = `
                <div class="glr-dot" style="background: hsl(${myShipSpecs.hue}, 100%, 50%)"></div>
                <span class="glr-name">${myPlayerName} (You)</span>
                <span class="glr-ship">${myShipSpecs.name}</span>
            `;
            liveRoster.appendChild(localLive);

            // Party Members
            partyMembers.forEach(member => {
                const itemLive = document.createElement("div");
                itemLive.className = "glr-item";
                itemLive.innerHTML = `
                    <div class="glr-dot" style="background: hsl(${member.shipSpecs.hue}, 100%, 50%)"></div>
                    <span class="glr-name">${member.name}</span>
                    <span class="glr-ship">${member.shipSpecs.name}</span>
                `;
                liveRoster.appendChild(itemLive);
            });

            // Bots
            bots.forEach(bot => {
                const itemLive = document.createElement("div");
                itemLive.className = "glr-item";
                itemLive.innerHTML = `
                    <div class="glr-dot" style="background: hsl(${bot.specs.hue}, 100%, 50%)"></div>
                    <span class="glr-name">${bot.name}</span>
                    <span class="glr-ship">${bot.specs.name}</span>
                `;
                liveRoster.appendChild(itemLive);
            });
        }

        // Update Party Label inside 3D Live Map View status bar
        const partyLabel = document.getElementById("galaxy-map-party-label");
        if (partyLabel) {
            partyLabel.textContent = currentPartyCode ? `PARTY: ${currentPartyCode}` : "SOLO MODE";
        }
    }

    function setupUIListerners() {
        const btnCreate = document.getElementById('btn-create-party');
        const btnJoin = document.getElementById('btn-join-party');
        const btnLeave = document.getElementById('btn-leave-party');
        const inputCode = document.getElementById('party-code-input');
        const serverHostInput = document.getElementById('ws-server-host');

        const btnEnterGalaxy = document.getElementById('btn-enter-galaxy');
        const btnSoloEnter = document.getElementById('btn-solo-enter');
        const btnBackToLobby = document.getElementById('btn-back-to-lobby');

        console.log('[Lobby UI] Setting up listeners. btnCreate:', !!btnCreate, 'btnJoin:', !!btnJoin, 'inputCode:', !!inputCode);

        if (btnEnterGalaxy) {
            btnEnterGalaxy.addEventListener('click', () => {
                console.log('[Lobby UI] Enter Galaxy clicked');
                const tab = document.getElementById('tab-galaxy');
                if (tab) tab.click();
            });
        }

        if (btnSoloEnter) {
            btnSoloEnter.addEventListener('click', () => {
                console.log('[Lobby UI] Solo Enter clicked');
                leaveParty(); // solo mode clears party
                const tab = document.getElementById('tab-galaxy');
                if (tab) tab.click();
            });
        }

        if (btnBackToLobby) {
            btnBackToLobby.addEventListener('click', () => {
                console.log('[Lobby UI] Back to Lobby clicked');
                const tab = document.getElementById('tab-lobby');
                if (tab) tab.click();
            });
        }

        // Allow teacher/student to set custom server IP
        if (serverHostInput) {
            serverHostInput.value = wsServerHost;
            serverHostInput.addEventListener('change', () => {
                const val = serverHostInput.value.trim();
                console.log('[Lobby UI] Server host changed:', val);
                if (val) {
                    wsServerHost = val;
                    // If already in a party, reconnect
                    if (currentPartyCode) connectWebSocket(currentPartyCode);
                }
            });
        }

        if (btnCreate) {
            btnCreate.addEventListener('click', () => {
                console.log('[Lobby UI] Create Party clicked');
                const code = 'GALAXY-' + Math.floor(100 + Math.random() * 899);
                if (inputCode) inputCode.value = code;
                joinParty(code, true);
            });
        }

        if (btnJoin) {
            btnJoin.addEventListener('click', () => {
                const code = inputCode ? inputCode.value.trim().toUpperCase() : '';
                console.log('[Lobby UI] Join Party clicked with code:', code);
                if (code.length === 0) {
                    alert('Please enter a valid party code!');
                    return;
                }
                joinParty(code, false);
            });
        }

        if (btnLeave) {
            btnLeave.addEventListener('click', () => {
                leaveParty();
            });
        }

        // Support holding Space + Left-Click Drag to Pan/change position in OrbitControls
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                const galaxyTab = document.getElementById('tab-galaxy');
                if (galaxyTab && galaxyTab.classList.contains('active')) {
                    e.preventDefault(); // prevent browser scrolling
                }
                if (controls) {
                    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
                }
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                if (controls) {
                    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
                }
            }
        });
    }

    function joinParty(code, isCreator = false) {
        currentPartyCode = code;
        partyLeaderId = isCreator ? myPlayerId : '';

        const btnCreate = document.getElementById('btn-create-party');
        const btnLeave = document.getElementById('btn-leave-party');
        const statusText = document.getElementById('party-status');

        if (btnCreate) btnCreate.classList.add('hidden');
        if (btnLeave) btnLeave.classList.remove('hidden');
        if (statusText) {
            statusText.textContent = isCreator
                ? `Status: Connected (Lobby: ${code} — Leader)`
                : `Status: Joining (Lobby: ${code})...`;
        }

        // Connect WebSocket to relay server
        connectWebSocket(code);
        spawnBots();
        updatePartyRosterUI();
    }

    function leaveParty() {
        // Notify other party members
        wsSend({
            type: 'MEMBER_LEAVE',
            partyCode: currentPartyCode,
            memberId: myPlayerId
        });

        // Close WebSocket
        if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
        if (wsClient) { try { wsClient.close(); } catch(e){} wsClient = null; }
        setWsStatus(false);

        currentPartyCode = '';
        partyLeaderId = '';
        partyMembers.forEach(member => {
            if (member.shipMesh && scene) scene.remove(member.shipMesh);
            if (member.tagEl && member.tagEl.parentNode) member.tagEl.parentNode.removeChild(member.tagEl);
        });
        partyMembers.clear();

        bots.forEach(b => {
            if (b.shipMesh && scene) scene.remove(b.shipMesh);
            if (b.tagEl && b.tagEl.parentNode) b.tagEl.parentNode.removeChild(b.tagEl);
        });
        bots.length = 0;

        const btnCreate = document.getElementById('btn-create-party');
        const btnLeave = document.getElementById('btn-leave-party');
        const statusText = document.getElementById('party-status');
        const inputCode = document.getElementById('party-code-input');

        if (btnCreate) btnCreate.classList.remove('hidden');
        if (btnLeave) btnLeave.classList.add('hidden');
        if (statusText) statusText.textContent = 'Status: Offline (Solo)';
        if (inputCode) inputCode.value = '';

        updatePartyRosterUI();
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

    // ─── Build 3D Map World ────────────────────────────────────────────────────
    function build3DWorld() {
        // Starfield
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 1500;
        const starPositions = new Float32Array(starsCount * 3);
        for (let i = 0; i < starsCount * 3; i += 3) {
            starPositions[i] = (Math.random() - 0.5) * 2000;
            starPositions[i+1] = (Math.random() - 0.5) * 2000;
            starPositions[i+2] = (Math.random() - 0.5) * 2000;
        }
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0.6 });
        const starField = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(starField);

        // Nodes
        flatNodes.forEach(node => {
            const coords = nodeCoordinates[node.id] || [0, 0, 0];
            const type = defNodeTypes.includes(node.node_type) ? "default" : node.node_type;
            const config = typeConfigs[type] || typeConfigs["default"];
            const nodeColor = getNodeColor(node);

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

            // Star light source casting starlight onto ship and planets in galaxy map
            if (node.node_type === "course" || node.node_type === "unit") {
                const starLight = new THREE.PointLight(nodeColor, 3.5, 900, 1.2);
                mesh.add(starLight);
            }

            // Text Label Sprite (disable raycasting so the label never blocks clicks on the planet sphere)
            const textSprite = createTextSprite(node.title, "#ffffff");
            textSprite.position.set(0, config.size + 6, 0);
            textSprite.raycast = () => {}; // opt out of raycasting entirely
            mesh.add(textSprite);

            scene.add(mesh);
            spaceNodes.push(mesh);
        });

        // Orbit connections colored dynamically by unit
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
    }

    // ─── Projections & Tags Renderer ───────────────────────────────────────────
    const tempV = new THREE.Vector3();
    function updateOverlayTags() {
        if (!camera || !renderer || !canvasContainer) return;
        const width = canvasContainer.clientWidth;
        const height = canvasContainer.clientHeight;

        // Project and position tag for local player
        if (myTagEl && myShipMesh) {
            tempV.setFromMatrixPosition(myShipMesh.matrixWorld);
            tempV.project(camera);
            
            if (tempV.z > 1) {
                myTagEl.style.display = 'none';
            } else {
                const x = (tempV.x *  .5 + .5) * width;
                const y = (tempV.y * -.5 + .5) * height;

                myTagEl.style.display = 'block';
                myTagEl.style.left = `${x}px`;
                myTagEl.style.top = `${y - 25}px`;
            }
        }

        // Project and position tags for players
        partyMembers.forEach(member => {
            if (member.tagEl && member.shipMesh) {
                tempV.setFromMatrixPosition(member.shipMesh.matrixWorld);
                tempV.project(camera);
                
                // Check if behind camera
                if (tempV.z > 1) {
                    member.tagEl.style.display = 'none';
                    return;
                }
                
                const x = (tempV.x *  .5 + .5) * width;
                const y = (tempV.y * -.5 + .5) * height;

                member.tagEl.style.display = 'block';
                member.tagEl.style.left = `${x}px`;
                member.tagEl.style.top = `${y - 25}px`;
            }
        });

        // Project and position tags for bots
        bots.forEach(bot => {
            if (bot.tagEl && bot.shipMesh) {
                tempV.setFromMatrixPosition(bot.shipMesh.matrixWorld);
                tempV.project(camera);
                
                if (tempV.z > 1) {
                    bot.tagEl.style.display = 'none';
                    return;
                }
                
                const x = (tempV.x *  .5 + .5) * width;
                const y = (tempV.y * -.5 + .5) * height;

                bot.tagEl.style.display = 'block';
                bot.tagEl.style.left = `${x}px`;
                bot.tagEl.style.top = `${y - 25}px`;
            }
        });
    }

    // ─── Render loop ───────────────────────────────────────────────────────────
    let lastTime = performance.now();
    function animate() {
        if (!isRunning) return;
        animationFrameId = requestAnimationFrame(animate);

        const now = performance.now();
        const delta = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        controls.update();
        
        // Update local player ship position from SpaceExplorer
        if (typeof SpaceExplorer !== "undefined" && myShipMesh) {
            const transform = SpaceExplorer.getShipTransform();
            if (transform && transform.position) {
                myShipMesh.position.set(transform.position.x, transform.position.y, transform.position.z);
                myShipMesh.quaternion.set(transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w);
            }
        }

        updateBots(delta);
        updateOverlayTags();

        // Slow rotation of galaxy UMAP orbits and billboard text sprites to camera
        const cameraWorldPos = new THREE.Vector3();
        camera.getWorldPosition(cameraWorldPos);
        
        spaceNodes.forEach((mesh, idx) => {
            mesh.rotation.y += 0.005;
            mesh.children.forEach(child => {
                if (child instanceof THREE.Sprite) {
                    child.lookAt(cameraWorldPos);
                }
            });
        });

        // Cleanup stale members (longer than 10 seconds silent)
        partyMembers.forEach((member, memberId) => {
            if (Date.now() - member.lastSeen > 10000) {
                removePartyMember(memberId);
            }
        });

        // Broadcast live position over WebSocket (~10 Hz, every 6th frame ≈ 100ms)
        if (currentPartyCode && wsConnected) {
            const transform = (typeof SpaceExplorer !== 'undefined') ? SpaceExplorer.getShipTransform() : null;
            if (transform && transform.position) {
                // Use a simple counter to throttle broadcast rate
                if (!animate._posFrameCount) animate._posFrameCount = 0;
                animate._posFrameCount++;
                if (animate._posFrameCount % 6 === 0) {
                    broadcastPosition(transform.position, transform.quaternion);
                }
            }
        }

        // Periodic state announcements (every ~3 seconds)
        if (Math.random() < 0.005) {
            broadcastState();
        }

        renderer.render(scene, camera);
    }

    // ─── Lobby Screen Helpers ──────────────────────────────────────────────────
    let lobbyStarfieldInterval = null;
    function initLobbyStarfield() {
        const canvas = document.getElementById('galaxy-lobby-bg');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let width = canvas.width = canvas.offsetWidth || window.innerWidth;
        let height = canvas.height = canvas.offsetHeight || window.innerHeight;

        window.addEventListener('resize', () => {
            if (canvas.offsetWidth) {
                width = canvas.width = canvas.offsetWidth;
                height = canvas.height = canvas.offsetHeight;
            }
        });

        const stars = [];
        for (let i = 0; i < 120; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                z: Math.random() * width,
                size: 0.5 + Math.random() * 1.5,
                color: `hsl(${Math.random() * 360}, 100%, 75%)`
            });
        }

        let speed = 1.5;
        function draw() {
            if (!document.getElementById('galaxy-lobby') || document.getElementById('galaxy-lobby').classList.contains('hidden')) {
                // If lobby is hidden, don't waste CPU/GPU
                requestAnimationFrame(draw);
                return;
            }
            ctx.fillStyle = '#020208';
            ctx.fillRect(0, 0, width, height);

            stars.forEach(star => {
                star.z -= speed;
                if (star.z <= 0) {
                    star.z = width;
                    star.x = Math.random() * width;
                    star.y = Math.random() * height;
                }

                // perspective projection
                const k = 128.0 / star.z;
                const px = (star.x - width / 2) * k + width / 2;
                const py = (star.y - height / 2) * k + height / 2;

                if (px >= 0 && px <= width && py >= 0 && py <= height) {
                    const size = star.size * k * 2;
                    ctx.beginPath();
                    ctx.arc(px, py, Math.min(size, 3), 0, Math.PI * 2);
                    ctx.fillStyle = star.color;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = star.color;
                    ctx.fill();
                    ctx.shadowBlur = 0; // reset
                }
            });

            requestAnimationFrame(draw);
        }
        draw();
    }

    let previewRenderer, previewScene, previewCamera;
    function initShipPreview() {
        const container = document.getElementById('galaxy-ship-preview');
        if (!container || !myShipSpecs) return;
        container.innerHTML = '';

        const w = container.clientWidth || 280;
        const h = container.clientHeight || 200;

        previewScene = new THREE.Scene();
        previewCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        previewCamera.position.set(0, 8, 18);
        previewCamera.lookAt(0, 0, 0);

        previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        previewRenderer.setSize(w, h);
        previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(previewRenderer.domElement);

        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        previewScene.add(ambient);

        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(5, 10, 5);
        previewScene.add(dir);

        // Spawn a clone of myShipMesh
        const ship = createProceduralShipMesh(myShipSpecs);
        ship.scale.set(1.2, 1.2, 1.2);
        previewScene.add(ship);

        function animatePreview() {
            if (document.getElementById('galaxy-lobby') && document.getElementById('galaxy-lobby').classList.contains('hidden')) {
                requestAnimationFrame(animatePreview);
                return;
            }
            ship.rotation.y += 0.01;
            ship.rotation.x = Math.sin(performance.now() * 0.001) * 0.15;
            previewRenderer.render(previewScene, previewCamera);
            requestAnimationFrame(animatePreview);
        }
        animatePreview();

        // Resize support
        const resizeObs = new ResizeObserver(() => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (width > 0 && height > 0) {
                previewCamera.aspect = width / height;
                previewCamera.updateProjectionMatrix();
                previewRenderer.setSize(width, height);
            }
        });
        resizeObs.observe(container);
    }

    // ─── Initialization ────────────────────────────────────────────────────────
    async function init(hierarchyData) {
        if (scene) {
            // Already initialized - just resume and fix size
            resume();
            // Defer resize so the container is visible and has correct layout
            requestAnimationFrame(() => handleResize());
            return;
        }

        canvasContainer = document.getElementById("galaxy-canvas-wrapper");

        // Wait for browser to paint the container at correct size
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        flatNodes = SpaceExplorer.flattenHierarchy ? SpaceExplorer.flattenHierarchy(hierarchyData) : [];
        if (flatNodes.length === 0) {
            // Helper local flattener if SpaceExplorer is not fully loaded
            function flatten(n, list = []) {
                if (!n) return list;
                list.push(n);
                if (n.children) n.children.forEach(c => flatten(c, list));
                return list;
            }
            flatNodes = flatten(hierarchyData);
        }

        // Fetch coords
        try {
            const response = await fetch('vector_coords.json');
            if (response.ok) {
                nodeCoordinates = await response.json();
            } else {
                throw new Error("vector_coords.json response not ok");
            }
        } catch (e) {
            console.warn("[GalaxyMap] Fallback coordinates generated.");
            flatNodes.forEach(n => {
                nodeCoordinates[n.id] = [
                    (Math.random() - 0.5) * 800,
                    (Math.random() - 0.5) * 800,
                    (Math.random() - 0.5) * 800
                ];
            });
        }

        // Setup THREE scene
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020208, 0.0004);

        // Measure container after browser has had time to lay it out
        const containerWidth = canvasContainer.clientWidth || window.innerWidth * 0.75;
        const containerHeight = canvasContainer.clientHeight || window.innerHeight - 70;

        camera = new THREE.PerspectiveCamera(50, containerWidth / containerHeight, 0.1, 4000);
        camera.position.set(0, 400, 1000);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(containerWidth, containerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        canvasContainer.innerHTML = "";
        canvasContainer.appendChild(renderer.domElement);

        // OrbitControls setup
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.zoomSpeed = 3.5;       // aggressive scroll zoom
        controls.maxDistance = Infinity; // no zoom-out limit
        controls.minDistance = 0.1;     // no zoom-in limit

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.32);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
        dirLight.position.set(500, 1000, 500);
        scene.add(dirLight);

        // Generate procedural ship specifications
        myShipSpecs = generateShipSpecs();
        renderShipSpecsUI();
        initLobbyStarfield();
        initShipPreview();

        // Spawn local player ship mesh in galaxy map
        myShipMesh = createProceduralShipMesh(myShipSpecs);
        myShipMesh.position.set(0, 50, 600);
        scene.add(myShipMesh);

        // Spawn local player tag element
        myTagEl = document.createElement("div");
        myTagEl.className = "galaxy-member-tag";
        myTagEl.style.borderColor = "#00fac6";
        myTagEl.innerHTML = `<i class="fa-solid fa-user-astronaut"></i> ${myPlayerName} (You)`;
        canvasContainer.appendChild(myTagEl);

        // Build nodes
        build3DWorld();

        // Setup HTML listeners
        setupUIListerners();
        updatePartyRosterUI();

        // ── Node Selection: double-click to select (dblclick is never consumed by OrbitControls)
        // Single-click is fully consumed by orbit rotate/pan, so we use dblclick which OrbitControls ignores.
        renderer.domElement.addEventListener('dblclick', (e) => {
            e.preventDefault();
            onMapClick(e);
        });

        // Show pointer cursor when hovering over a clickable node
        renderer.domElement.addEventListener('mousemove', (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouseCoordinates.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouseCoordinates.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouseCoordinates, camera);
            const hits = raycaster.intersectObjects(spaceNodes, true);
            renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
        });

        const closeBtn = document.getElementById("galaxy-hud-close-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const hud = document.getElementById("galaxy-hud");
                if (hud) hud.classList.add("hidden");
                lastSelectedNodeId = null;
            });
        }

        // Resize handler
        window.addEventListener('resize', () => {
            handleResize();
        });

        resume();

        // Final resize to ensure correct dimensions after full init
        setTimeout(() => handleResize(), 100);

        // If teacher mode was activated before init(), connect teacher WS now
        if (isTeacherMode) {
            connectTeacherWebSocket();
        }
    }

    const raycaster = new THREE.Raycaster();
    const mouseCoordinates = new THREE.Vector2();
    let lastSelectedNodeId = null;

    function onMapClick(event) {
        if (!camera || !renderer || !canvasContainer) return;
        
        // Calculate normalized device coordinates relative to the THREE.js canvas
        const rect = renderer.domElement.getBoundingClientRect();
        mouseCoordinates.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseCoordinates.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouseCoordinates, camera);
        // Use recursive=true so child geometry can be hit; we walk up to find nodeData
        const intersects = raycaster.intersectObjects(spaceNodes, true);
        
        if (intersects.length > 0) {
            // Walk up from the hit object to find the parent mesh that owns nodeData
            let hitObj = intersects[0].object;
            let nodeData = null;
            while (hitObj) {
                if (hitObj.userData && hitObj.userData.nodeData) {
                    nodeData = hitObj.userData.nodeData;
                    break;
                }
                hitObj = hitObj.parent;
            }
            if (nodeData) {
                selectNodeOnMap(nodeData, hitObj);
            }
        }
    }

    async function selectNodeOnMap(nodeData, mesh) {
        lastSelectedNodeId = nodeData.id;

        // Check if the node is part of an active charted course/mission
        if (typeof SpaceExplorer !== "undefined" && SpaceExplorer.getChartedCourse) {
            const course = SpaceExplorer.getChartedCourse();
            if (course && course.has(nodeData.id)) {
                reportMissionComplete(nodeData.id, nodeData.title);
            }
        }

        // Hide the first-use hint permanently once user has selected a node
        const hint = document.getElementById('galaxy-click-hint');
        if (hint) { hint.style.opacity = '0'; setTimeout(() => hint.style.display = 'none', 500); }

        const hud = document.getElementById("galaxy-hud");
        const hudType = document.getElementById("galaxy-hud-type");
        const hudTitle = document.getElementById("galaxy-hud-title");
        const hudPath = document.getElementById("galaxy-hud-path");
        const hudParent = document.getElementById("galaxy-hud-parent");
        const hudSummary = document.getElementById("galaxy-hud-summary");

        if (hud) hud.classList.remove("hidden");
        if (hudType) {
            hudType.textContent = nodeData.node_type || "System";
            const defTypes = ["case_study", "example", "activity"];
            const type = defTypes.includes(nodeData.node_type) ? "default" : nodeData.node_type;
            hudType.className = `badge ${type}`;
        }
        if (hudTitle) hudTitle.textContent = nodeData.title || "Unknown Core";
        
        // Path
        if (hudPath) {
            hudPath.innerHTML = "";
            if (nodeData.path) {
                nodeData.path.forEach(p => {
                    const span = document.createElement("span");
                    span.textContent = p;
                    hudPath.appendChild(span);
                });
            }
        }

        // Parent / Unit Status
        if (hudParent) {
            let unitName = "None";
            if (nodeData.path && nodeData.path.length > 0) {
                unitName = nodeData.path[0];
            } else {
                const unitNum = getUnitNumber(nodeData);
                if (unitNum) unitName = `UNIT ${unitNum}`;
            }
            let parentTitle = nodeData.parent ? nodeData.parent.title : "None";
            hudParent.textContent = `Unit: ${unitName} | Parent: ${parentTitle}`;
        }

        // Summary Analysis loader
        if (hudSummary) {
            hudSummary.innerHTML = `<span style="color: #00fac6;"><i class="fa-solid fa-satellite-dish fa-spin"></i> Directing telemetry link to neural core...</span>`;
        }

        // Fetch AI Summary from local Ollama gemma3:270m
        try {
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
            
            if (lastSelectedNodeId === nodeData.id && hudSummary) {
                if (typeof marked !== 'undefined') {
                    hudSummary.innerHTML = marked.parse(summaryText);
                } else {
                    hudSummary.textContent = summaryText;
                }
            }
        } catch (err) {
            if (lastSelectedNodeId === nodeData.id && hudSummary) {
                let text = "";
                if (nodeData.content && nodeData.content.length > 0) {
                    text = Array.isArray(nodeData.content) ? nodeData.content.join("<br><br>") : nodeData.content;
                } else {
                    text = `A node of type ${nodeData.node_type}. Study the full textbook page to learn more about this module.`;
                }
                hudSummary.innerHTML = `
                    <div style="color: var(--google-red); margin-bottom: 10px; font-size: 11px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Telemetry Offline (Ollama/Gemma unavailable)
                    </div>
                    <div>${text}</div>
                `;
            }
        }
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

    function resume() {
        if (isRunning) return;
        isRunning = true;
        lastTime = performance.now();
        
        // Align camera to mirror the SpaceExplorer ship position immediately
        if (controls && myShipMesh && typeof SpaceExplorer !== "undefined") {
            const transform = SpaceExplorer.getShipTransform();
            if (transform && transform.position) {
                myShipMesh.position.set(transform.position.x, transform.position.y, transform.position.z);
                myShipMesh.quaternion.set(transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w);
                
                controls.target.copy(myShipMesh.position);
                camera.position.set(myShipMesh.position.x, myShipMesh.position.y + 150, myShipMesh.position.z + 300);
                controls.update();
            }
        }
        
        animate();
    }

    function pause() {
        isRunning = false;
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // ─── Mission Toast (shown on students when teacher broadcasts) ─────────────
    let missionToastTimer = null;
    function showMissionToast(data) {
        const toast = document.getElementById('mission-toast');
        const title = document.getElementById('mission-toast-title');
        const sub = document.getElementById('mission-toast-sub');
        if (!toast) return;

        if (title) title.textContent = data.nodeTitle || 'Mission Assigned';
        if (sub) sub.textContent = `Type: ${data.nodeType || 'topic'} · Unit ${data.unitNum || '?'} · Navigate to it in Space Explorer!`;

        toast.classList.add('visible');

        // Also add to Space Explorer mission HUD and set charted course
        if (typeof SpaceExplorer !== 'undefined') {
            if (SpaceExplorer.addMission) {
                SpaceExplorer.addMission({ id: data.nodeId, title: data.nodeTitle, type: data.nodeType, fromTeacher: true });
            }
            if (SpaceExplorer.setChartedCourse) {
                SpaceExplorer.setChartedCourse(data.nodeIds || [data.nodeId]);
            }
        }

        // Auto-dismiss after 8 seconds
        if (missionToastTimer) clearTimeout(missionToastTimer);
        missionToastTimer = setTimeout(() => {
            toast.classList.remove('visible');
        }, 8000);
    }

    // ─── Teacher Mode Activation ────────────────────────────────────────────────
    function activateTeacherMode(serverHost) {
        isTeacherMode = true;
        if (serverHost) wsServerHost = serverHost;

        // Mark galaxy canvas as teacher-mode
        const mapView = document.getElementById('galaxy-map-view');
        if (mapView) mapView.classList.add('teacher-mode-active');

        // Connect teacher WebSocket (if scene is already loaded, connect immediately)
        if (scene) {
            connectTeacherWebSocket();
        }
        // Otherwise it will be connected when init() is called

        console.log('[Teacher] Teacher mode activated');
    }

    function reportMissionComplete(nodeId, nodeTitle) {
        wsSend({
            type: 'MISSION_COMPLETE',
            partyCode: currentPartyCode,
            memberId: myPlayerId,
            memberName: myPlayerName,
            nodeId: nodeId,
            nodeTitle: nodeTitle
        });
    }

    // Public API
    return {
        init,
        pause,
        resume,
        handleResize,
        broadcastPosition,
        broadcastChartedCourse,
        activateTeacherMode,
        teacherBroadcastMission: (data) => teacherWsSend({ type: 'BROADCAST_MISSION', ...data }),
        getPartyCode: () => currentPartyCode,
        getShipSpecs: () => myShipSpecs,
        getPartyMembers: () => partyMembers,
        getPlayerId: () => myPlayerId,
        isTeacher: () => isTeacherMode,
        getGlobalStudents: () => globalStudents,
        reportMissionComplete
    };
})();
