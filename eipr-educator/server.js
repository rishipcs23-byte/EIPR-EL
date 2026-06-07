/**
 * EIPR Galaxy Map — LAN WebSocket Relay Server (server.js)
 * ─────────────────────────────────────────────────────────
 * Lightweight WebSocket message relay for classroom LAN multiplayer.
 *
 * Party Model:
 *   - Regular students: connect with ws://HOST:3001?party=GALAXY-123
 *   - Teacher client:   connect with ws://HOST:3001?party=__TEACHER__
 *
 * Teacher Features:
 *   - Receives GLOBAL_ROSTER whenever any student connects/disconnects
 *   - Receives GLOBAL_POS_UPDATE for every student's position tick
 *   - Can send BROADCAST_MISSION → relayed to ALL students globally
 *
 * Setup (teacher machine):
 *   npm install && node server.js
 */

const { WebSocketServer } = require('ws');
const http = require('http');
const url = require('url');

const PORT = 3001;
const TEACHER_PARTY = '__TEACHER__';

// ── Party registry: partyCode → Set<ws>
const parties = new Map();

// ── Global client registry: wsId → ClientRecord
let wsIdCounter = 0;
const globalClients = new Map();

/**
 * @typedef {Object} ClientRecord
 * @property {WebSocket} ws
 * @property {number}    wsId
 * @property {string}    partyCode
 * @property {boolean}   isTeacher
 * @property {string|null} playerId
 * @property {string|null} playerName
 * @property {Object|null} shipSpecs
 * @property {Object|null} position
 * @property {Object|null} quaternion
 */

// ── HTTP health-check
const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    const status = {};
    parties.forEach((clients, code) => {
        if (code !== TEACHER_PARTY) status[code] = clients.size;
    });
    const students = [...globalClients.values()].filter(c => !c.isTeacher);
    res.end(JSON.stringify({
        status: 'EIPR Galaxy Server Online',
        parties: status,
        totalStudents: students.length,
        totalConnections: [...globalClients.values()].length
    }));
});

const wss = new WebSocketServer({ server });

// ── Helpers ──────────────────────────────────────────────────────────────────

function relayToParty(partyCode, senderWs, msgStr) {
    const party = parties.get(partyCode);
    if (!party) return;
    party.forEach(client => {
        if (client !== senderWs && client.readyState === 1) {
            client.send(msgStr);
        }
    });
}

function sendToTeachers(data) {
    const msgStr = JSON.stringify(data);
    globalClients.forEach(client => {
        if (client.isTeacher && client.ws.readyState === 1) {
            client.ws.send(msgStr);
        }
    });
}

function broadcastGlobalRosterToTeachers() {
    const roster = [];
    globalClients.forEach(client => {
        if (!client.isTeacher && client.playerId) {
            roster.push({
                playerId:   client.playerId,
                playerName: client.playerName,
                partyCode:  client.partyCode,
                shipSpecs:  client.shipSpecs,
                position:   client.position,
                quaternion: client.quaternion
            });
        }
    });
    sendToTeachers({ type: 'GLOBAL_ROSTER', roster, serverTime: Date.now() });
}

function broadcastMissionToAllStudents(missionData) {
    const msgStr = JSON.stringify({ type: 'MISSION_BROADCAST', ...missionData });
    let count = 0;
    globalClients.forEach(client => {
        if (!client.isTeacher && client.ws.readyState === 1) {
            client.ws.send(msgStr);
            count++;
        }
    });
    console.log(`[📡] Mission broadcast sent to ${count} student(s): "${missionData.nodeTitle}"`);
}

// ── Connection handler ────────────────────────────────────────────────────────

wss.on('connection', (ws, req) => {
    const parsed = url.parse(req.url, true);
    const partyCode = (parsed.query.party || 'SOLO').trim().toUpperCase();
    const isTeacher = partyCode === TEACHER_PARTY;
    const wsId = ++wsIdCounter;

    // Register in global registry
    /** @type {ClientRecord} */
    const record = {
        ws, wsId, partyCode, isTeacher,
        playerId: null, playerName: null,
        shipSpecs: null, position: null, quaternion: null
    };
    globalClients.set(wsId, record);
    ws._eiprId = wsId;

    // Register in party set
    if (!parties.has(partyCode)) parties.set(partyCode, new Set());
    parties.get(partyCode).add(ws);

    const role = isTeacher ? 'TEACHER' : 'student';
    console.log(`[+] ${role} joined party "${partyCode}" (wsId=${wsId})`);

    // Send welcome
    ws.send(JSON.stringify({
        type: 'SERVER_WELCOME',
        partyCode,
        isTeacher,
        memberCount: parties.get(partyCode).size,
        serverTime: Date.now()
    }));

    // If teacher just connected, immediately send current global roster
    if (isTeacher) {
        broadcastGlobalRosterToTeachers();
    }

    // ── Message handler ───────────────────────────────────────────────────────

    ws.on('message', (rawData) => {
        let data;
        try { data = JSON.parse(rawData.toString()); } catch (e) { return; }
        if (!data || !data.type) return;

        const client = globalClients.get(wsId);
        if (!client) return;

        switch (data.type) {

            case 'MEMBER_STATE': {
                // Update global registry
                client.playerId   = data.memberId   || client.playerId;
                client.playerName = data.memberName || client.playerName;
                client.shipSpecs  = data.shipSpecs  || client.shipSpecs;
                // Relay within party
                relayToParty(partyCode, ws, rawData.toString());
                // Notify teachers of new roster
                broadcastGlobalRosterToTeachers();
                break;
            }

            case 'MEMBER_POS': {
                // Update position record
                client.position   = data.position   || client.position;
                client.quaternion = data.quaternion || client.quaternion;
                // Relay within party
                relayToParty(partyCode, ws, rawData.toString());
                // Send position tick to teachers
                if (client.playerId) {
                    sendToTeachers({
                        type:       'GLOBAL_POS_UPDATE',
                        playerId:   client.playerId,
                        playerName: client.playerName,
                        partyCode:  client.partyCode,
                        shipSpecs:  client.shipSpecs,
                        position:   data.position,
                        quaternion: data.quaternion
                    });
                }
                break;
            }

            case 'BROADCAST_MISSION': {
                // Only accept from teacher connections
                if (client.isTeacher) {
                    broadcastMissionToAllStudents(data);
                    // Echo back a confirmation to the teacher
                    ws.send(JSON.stringify({ type: 'MISSION_BROADCAST_ACK', nodeTitle: data.nodeTitle, recipientCount: [...globalClients.values()].filter(c => !c.isTeacher).length }));
                }
                break;
            }

            default: {
                // Default: relay within party only
                relayToParty(partyCode, ws, rawData.toString());
                break;
            }
        }
    });

    // ── Close handler ─────────────────────────────────────────────────────────

    ws.on('close', () => {
        const client = globalClients.get(wsId);
        const name = client?.playerName || `wsId=${wsId}`;
        globalClients.delete(wsId);

        const party = parties.get(partyCode);
        if (party) {
            party.delete(ws);
            if (party.size === 0) {
                parties.delete(partyCode);
                console.log(`[x] Party "${partyCode}" disbanded`);
            }
        }

        console.log(`[-] ${isTeacher ? 'TEACHER' : name} left party "${partyCode}"`);

        // Relay MEMBER_LEAVE to party
        if (!isTeacher && client?.playerId) {
            relayToParty(partyCode, ws, JSON.stringify({
                type: 'MEMBER_LEAVE',
                partyCode,
                memberId: client.playerId
            }));
        }

        // Update teacher roster
        broadcastGlobalRosterToTeachers();
    });

    ws.on('error', (err) => {
        console.error(`[!] WebSocket error wsId=${wsId}:`, err.message);
        globalClients.delete(wsId);
        parties.get(partyCode)?.delete(ws);
        broadcastGlobalRosterToTeachers();
    });
});

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
    const nets = require('os').networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
        }
    }

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   EIPR Galaxy Map — Multiplayer Server v2         ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`\n  WebSocket relay on port ${PORT}`);
    console.log(`\n  ✅ Local:     ws://localhost:${PORT}`);
    ips.forEach(ip => {
        console.log(`  ✅ Network:   ws://${ip}:${PORT}   ← Share with students!`);
    });
    console.log('\n  Teacher password: EIPR_TEACHER');
    console.log('  Teacher party:    __TEACHER__ (auto-used by teacher mode)');
    console.log('\n  HTTP status:  http://localhost:3001\n');
});

process.on('SIGINT', () => {
    console.log('\n\nShutting down server gracefully...');
    wss.clients.forEach(ws => ws.close());
    server.close(() => process.exit(0));
});
