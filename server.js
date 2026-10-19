import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { MAX_PLAYERS, MAX_ROOMS, EYE_HEIGHT, REACH, REACH_LEEWAY } from './public/scripts/config.js';
import { AIR, BLOCK_BY_ID } from './public/scripts/blocks.js';
import { World, WORLD_SIZE } from './public/scripts/world.js';

const PORT = process.env.PORT || 3000;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const THREE = path.join(ROOT, 'node_modules', 'three', 'build');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

// ---------- HTTP: serves /public, and three.js from node_modules at /three/ ----------

const server = http.createServer((req, res) => {
    let url;
    try {
        url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
        res.writeHead(400);
        return res.end();
    }

    if (url === '/') url = '/index.html';

    const isThree = url.startsWith('/three/');
    const base = isThree ? THREE : PUBLIC;
    const file = path.join(base, url.slice(isThree ? 7 : 1));

    if (!file.startsWith(base + path.sep)) {
        res.writeHead(403);
        return res.end();
    }

    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end('not found');
        }
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
            'Cache-Control': 'no-cache',   // so edited textures show up on refresh
        });
        res.end(data);
    });
});

// ---------- State and helpers ----------

const rooms = new Map();   // roomId -> { id, name, players: Map(clientId -> ws), max, world }
const lobby = new Set();   // sockets that are not inside a room
let nextClientId = 1;
let nextRoomId = 1;

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));
const clean = (text, maxLength) => String(text || '').trim().slice(0, maxLength);
const num = v => (Number.isFinite(v) ? Math.max(-1e4, Math.min(1e4, v)) : 0);
const playerInfo = ws => ({ id: ws.id, name: ws.name, ...ws.pos });

const roomList = () =>
    [...rooms.values()].map(r => ({ id: r.id, name: r.name, count: r.players.size, max: r.max }));

// Every block change in a world as [x, y, z, id]. New players apply these on top of the
// flat terrain they generate themselves.
const editList = world =>
    [...world.edits].map(([key, id]) => [...key.split(',').map(Number), id]);

function broadcast(room, msg, except) {
    for (const ws of room.players.values()) {
        if (ws !== except) send(ws, msg);
    }
}

function pushRoomList() {
    const msg = { t: 'rooms', rooms: roomList() };
    lobby.forEach(ws => send(ws, msg));
}

// ---------- Joining and leaving rooms ----------

function joinRoom(ws, room) {
    lobby.delete(ws);
    ws.room = room;

    // pos.y is the player's feet. Spawn near the middle of the world, on top of whatever is there.
    const x = WORLD_SIZE / 2 + (Math.random() - 0.5) * 8;
    const z = WORLD_SIZE / 2 + (Math.random() - 0.5) * 8;
    ws.pos = { x, y: room.world.surfaceY(Math.floor(x), Math.floor(z)), z, yaw: 0, pitch: 0 };

    const others = [...room.players.values()].map(playerInfo);
    room.players.set(ws.id, ws);

    send(ws, {
        t: 'joined',
        room: { id: room.id, name: room.name },
        you: ws.id,
        name: ws.name,
        spawn: ws.pos,
        players: others,
        edits: editList(room.world),
    });
    broadcast(room, { t: 'pj', ...playerInfo(ws) }, ws);
    pushRoomList();
}

function leaveRoom(ws) {
    const room = ws.room;
    if (!room) return;

    room.players.delete(ws.id);
    ws.room = null;

    if (room.players.size === 0) {
        rooms.delete(room.id);
    } else {
        broadcast(room, { t: 'pl', id: ws.id });
    }

    if (ws.readyState === 1) {
        lobby.add(ws);
        send(ws, { t: 'rooms', rooms: roomList() });
    }
    pushRoomList();
}

// ---------- Message handlers: one function per message type the client can send ----------

const handlers = {
    create(ws, m) {
        if (ws.room) return;
        if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'error', msg: 'Too many servers' });

        ws.name = clean(m.player, 16) || ws.name;
        const room = {
            id: String(nextRoomId++),
            name: clean(m.name, 24) || ws.name + "'s server",
            players: new Map(),
            max: MAX_PLAYERS,
            world: new World(),
        };
        rooms.set(room.id, room);
        joinRoom(ws, room);
    },

    join(ws, m) {
        if (ws.room) return;

        const room = rooms.get(String(m.id));
        if (!room || room.players.size >= room.max) {
            return send(ws, { t: 'error', msg: 'Server is full or no longer exists' });
        }

        ws.name = clean(m.player, 16) || ws.name;
        joinRoom(ws, room);
    },

    leave(ws) {
        leaveRoom(ws);
    },

    move(ws, m) {
        if (!ws.room) return;

        ws.pos = { x: num(m.x), y: num(m.y), z: num(m.z), yaw: num(m.yaw), pitch: num(m.pitch) };
        broadcast(ws.room, { t: 'pm', id: ws.id, ...ws.pos }, ws);
    },

    // The server decides what is allowed: you can break a block or place into empty space,
    // within reach. Anything else is refused and the sender is told the real block.
    block(ws, m) {
        if (!ws.room) return;

        const { x, y, z, id } = m;
        if (![x, y, z, id].every(Number.isInteger)) return;

        const world = ws.room.world;
        if (!world.inBounds(x, y, z)) return;
        if (id !== AIR && !BLOCK_BY_ID.has(id)) return;

        const distance = Math.hypot(
            ws.pos.x - (x + 0.5),
            ws.pos.y + EYE_HEIGHT - (y + 0.5),
            ws.pos.z - (z + 0.5)
        );
        const current = world.getBlock(x, y, z);
        const allowed = distance <= REACH + REACH_LEEWAY && (id === AIR ? current !== AIR : current === AIR);

        if (!allowed) return send(ws, { t: 'block', x, y, z, id: current });

        world.setBlock(x, y, z, id);
        broadcast(ws.room, { t: 'block', x, y, z, id }, ws);
    },
};

// ---------- WebSocket connections ----------

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
    ws.id = nextClientId++;
    ws.name = 'Player' + ws.id;
    ws.room = null;

    lobby.add(ws);
    send(ws, { t: 'rooms', rooms: roomList() });

    ws.on('message', raw => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }
        if (!msg || typeof msg !== 'object' || !Object.hasOwn(handlers, msg.t)) return;

        try {
            handlers[msg.t](ws, msg);
        } catch (err) {
            console.error(`Error handling "${msg.t}":`, err);
        }
    });

    ws.on('close', () => {
        leaveRoom(ws);
        lobby.delete(ws);
    });
});

// Keeps idle connections alive through proxies and tunnels
setInterval(() => wss.clients.forEach(ws => ws.ping()), 25000);

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
