/**
 * EIPR Galaxy Map — LAN WebSocket Relay Server (server.js)
 * ─────────────────────────────────────────────────────────
 * Lightweight WebSocket message relay for classroom LAN multiplayer.
 *
 * How it works:
 *   - Each client connects with a party code: ws://HOST:3001?party=GALAXY-123
 *   - Server groups clients by party code
 *   - Any message from a client is relayed to all OTHER clients in the same party
 *   - No database, no auth — pure relay
 *
 * Setup (teacher machine):
 *   npm install
 *   node server.js
 *
 * Students open: http://TEACHER_IP:8000 in their browser
 */

const { WebSocketServer } = require('ws');
const http = require('http');
const url = require('url');

const PORT = 3001;

// Map of partyCode -> Set of WebSocket connections
const parties = new Map();

const server = http.createServer((req, res) => {
    // Simple health-check endpoint
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    const status = {};
    parties.forEach((clients, code) => {
        status[code] = clients.size;
    });
    res.end(JSON.stringify({
        status: 'EIPR Galaxy Server Online',
        parties: status,
        totalConnections: [...parties.values()].reduce((sum, s) => sum + s.size, 0)
    }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    const parsed = url.parse(req.url, true);
    const partyCode = (parsed.query.party || '').trim().toUpperCase();

    if (!partyCode) {
        ws.close(1008, 'Party code required');
        return;
    }

    // Register in party
    if (!parties.has(partyCode)) {
        parties.set(partyCode, new Set());
    }
    const partySet = parties.get(partyCode);
    partySet.add(ws);

    console.log(`[+] Client joined party "${partyCode}" (${partySet.size} members)`);

    ws.on('message', (rawData) => {
        // Relay to all other clients in same party
        let msgStr;
        try {
            msgStr = rawData.toString();
        } catch (e) {
            return;
        }

        partySet.forEach(client => {
            if (client !== ws && client.readyState === 1 /* OPEN */) {
                client.send(msgStr);
            }
        });
    });

    ws.on('close', () => {
        partySet.delete(ws);
        console.log(`[-] Client left party "${partyCode}" (${partySet.size} members remaining)`);
        if (partySet.size === 0) {
            parties.delete(partyCode);
            console.log(`[x] Party "${partyCode}" disbanded (empty)`);
        }
    });

    ws.on('error', (err) => {
        console.error(`[!] WebSocket error in party "${partyCode}":`, err.message);
        partySet.delete(ws);
    });

    // Send a welcome acknowledgement
    ws.send(JSON.stringify({
        type: 'SERVER_WELCOME',
        partyCode,
        memberCount: partySet.size,
        serverTime: Date.now()
    }));
});

server.listen(PORT, '0.0.0.0', () => {
    const nets = require('os').networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                ips.push(net.address);
            }
        }
    }

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║    EIPR Galaxy Map — Multiplayer Server       ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`\n  WebSocket relay running on port ${PORT}`);
    console.log(`\n  ✅ Local:     ws://localhost:${PORT}`);
    ips.forEach(ip => {
        console.log(`  ✅ Network:   ws://${ip}:${PORT}   ← Share this with students!`);
    });
    console.log('\n  Students should enter the Network IP in the Galaxy Map lobby.');
    console.log('  HTTP status:  http://localhost:3001\n');
});

process.on('SIGINT', () => {
    console.log('\n\nShutting down server gracefully...');
    wss.clients.forEach(ws => ws.close());
    server.close(() => process.exit(0));
});
