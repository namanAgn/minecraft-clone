import * as THREE from 'three';
import {
    WALK_SPEED, FLY_SPEED, GRAVITY, JUMP_SPEED, MAX_FALL_SPEED, DOUBLE_TAP_MS, EYE_HEIGHT, REACH,
    VOID_Y, HOTBAR_SLOTS, ACTION_REPEAT_MS, SEND_INTERVAL_MS,
} from './scripts/config.js';
import {
    SKY_COLOR, FOG_COLOR, FOG_NEAR, FOG_FAR, VIEW_DISTANCE, AMBIENT_COLOR, AMBIENT_INTENSITY,
    SUN_COLOR, SUN_INTENSITY, SUN_DIRECTION, FOV, THIRD_PERSON_DISTANCE, MAX_PIXEL_RATIO, ANTIALIAS,
    SELECTION_COLOR, SELECTION_OPACITY,
} from './scripts/visuals.js';
import { AIR, BLOCK_BY_NAME, textureNames } from './scripts/blocks.js';
import { ITEMS } from './scripts/items.js';
import { World } from './scripts/world.js';
import { WorldView } from './scripts/mesher.js';
import { moveBody, raycast, overlapsPlayer } from './scripts/physics.js';
import { buildBlockAtlas } from './scripts/textures.js';
import { loadAvatarAssets, makeAvatar, setLook, animateWalk, disposeAvatar } from './scripts/avatar.js';
import { Remotes } from './scripts/remotes.js';
import { keys, mouse, bindInput } from './scripts/input.js';
import * as ui from './scripts/ui.js';

const PHYSICS_STEP = 1 / 60;   // movement is simulated in slices this long so fast falls cannot skip through floors

// ---------- Rendering setup ----------

const renderer = new THREE.WebGLRenderer({ antialias: ANTIALIAS });
renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, VIEW_DISTANCE);
camera.rotation.order = 'YXZ';

// three.js expects light intensities multiplied by PI to match the usual "1 = full brightness"
const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY * Math.PI);
sun.position.set(...SUN_DIRECTION);
scene.add(new THREE.AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY * Math.PI), sun);

const selection = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: SELECTION_COLOR, transparent: true, opacity: SELECTION_OPACITY })
);
selection.visible = false;
scene.add(selection);

function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- Assets ----------

const atlas = await buildBlockAtlas(textureNames());
await loadAvatarAssets();

for (const item of ITEMS) {
    if (item.block && !BLOCK_BY_NAME.has(item.block)) {
        console.warn(`Item "${item.name}" places "${item.block}", which is not in blocks.js`);
    }
}

// ---------- Game state ----------

// The local player. pos is the position of the FEET; the camera sits EYE_HEIGHT above it.
const me = {
    pos: new THREE.Vector3(),
    vy: 0,
    yaw: 0,
    pitch: 0,
    flying: false,
    onGround: false,
};

const remotes = new Remotes(scene, () => ui.renderPlayerList([myName + ' (you)', ...remotes.names()]));

let world = null;        // block data for the current server
let view = null;         // the chunk meshes drawn from that data
let selfAvatar = null;   // your own body, visible in the third-person views
let myName = '';
let spawn = { x: 0, z: 0 };
let target = null;       // the block you are looking at, or null
let selectedSlot = 0;
let cameraMode = 0;      // 0 first person, 1 behind you, 2 in front of you
let inGame = false;
let lastAction = 0;
let lastSpaceTap = 0;

// ---------- Lobby, joining and leaving ----------

ui.buildHotbar();
ui.selectSlot(selectedSlot);

function enterGame(m) {
    remotes.clear();
    leaveWorld();

    myName = m.name;
    spawn = m.spawn;

    world = new World();
    for (const [x, y, z, id] of m.edits) world.setBlock(x, y, z, id);
    view = new WorldView(scene, world, atlas);

    me.pos.set(m.spawn.x, m.spawn.y, m.spawn.z);
    me.vy = me.yaw = me.pitch = 0;
    me.onGround = false;
    setFlying(false);
    cameraMode = 0;

    selfAvatar = makeAvatar(myName);
    scene.add(selfAvatar);

    m.players.forEach(p => remotes.add(p));
    ui.renderPlayerList([myName + ' (you)', ...remotes.names()]);
    ui.setRoomName(m.room.name);

    inGame = true;
    ui.showGame(true);
    updateHint();
}

function leaveWorld() {
    if (selfAvatar) disposeAvatar(selfAvatar);
    if (view) view.dispose();
    selfAvatar = null;
    view = null;
    world = null;
    target = null;
    selection.visible = false;
}

function exitGame() {
    inGame = false;
    document.exitPointerLock();
    remotes.clear();
    leaveWorld();
    ui.showGame(false);
}

ui.bindLobby({
    onCreate: serverName => send({ t: 'create', name: serverName, player: ui.playerName() }),
    onLeave: () => {
        send({ t: 'leave' });
        exitGame();
    },
});

// ---------- Networking ----------
// Server -> client: rooms, joined, error, pj (player joined), pl (player left),
//                   pm (player moved), block (a block changed)
// Client -> server: create, join, leave, move, block

const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);

function send(msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

ws.onmessage = e => {
    const m = JSON.parse(e.data);

    if (m.t === 'rooms') {
        ui.renderServerList(m.rooms, id => send({ t: 'join', id, player: ui.playerName() }));
    } else if (m.t === 'joined') {
        ui.setStatus('');
        enterGame(m);
    } else if (m.t === 'error') {
        ui.setStatus(m.msg);
    } else if (!inGame) {
        return;
    } else if (m.t === 'pj') {
        remotes.add(m);
    } else if (m.t === 'pl') {
        remotes.drop(m.id);
    } else if (m.t === 'pm') {
        remotes.moved(m);
    } else if (m.t === 'block') {
        applyBlock(m.x, m.y, m.z, m.id);
    }
};

ws.onclose = () => {
    if (inGame) exitGame();
    ui.setStatus('Disconnected. Refresh the page to reconnect.');
};

let lastSendTime = 0;
let lastPayload = '';

function sendPosition(now) {
    if (now - lastSendTime < SEND_INTERVAL_MS) return;

    const round = v => +v.toFixed(3);
    const move = {
        t: 'move',
        x: round(me.pos.x),
        y: round(me.pos.y),
        z: round(me.pos.z),
        yaw: round(me.yaw),
        pitch: round(me.pitch),
    };

    const payload = JSON.stringify(move);
    if (payload === lastPayload) return;   // nothing changed, stay quiet
    lastPayload = payload;
    lastSendTime = now;
    send(move);
}

// ---------- Input ----------

function setFlying(flying) {
    me.flying = flying;
    me.vy = 0;
    ui.setMode(flying ? 'Flying' : '');
}

function updateHint() {
    ui.setHint(isLocked()
        ? 'WASD move | Space jump, double-tap to fly | Shift down | Left click break | Right click place | 1-9 or wheel: item | V camera | Esc free mouse'
        : 'Click to play');
}

const isLocked = bindInput(renderer.domElement, {
    isPlaying: () => inGame,

    onLook(dx, dy) {
        me.yaw -= dx;
        me.pitch = Math.max(-1.55, Math.min(1.55, me.pitch - dy));
    },

    // Two quick Space presses toggle flying, like Minecraft's creative mode
    onSpace() {
        const now = performance.now();
        if (now - lastSpaceTap < DOUBLE_TAP_MS) {
            setFlying(!me.flying);
            lastSpaceTap = 0;
        } else {
            lastSpaceTap = now;
        }
    },

    onCamera: () => { cameraMode = (cameraMode + 1) % 3; },

    onSlot(index) {
        if (index >= HOTBAR_SLOTS) return;
        selectedSlot = index;
        ui.selectSlot(selectedSlot);
    },

    onScroll(direction) {
        selectedSlot = (selectedSlot + direction + HOTBAR_SLOTS) % HOTBAR_SLOTS;
        ui.selectSlot(selectedSlot);
    },

    onMouseDown: () => { lastAction = 0; },
    onLockChange: updateHint,
});

// ---------- Movement and physics ----------

const axis = (positive, negative) => (positive ? 1 : 0) - (negative ? 1 : 0);

function respawn() {
    me.pos.set(spawn.x, world.surfaceY(Math.floor(spawn.x), Math.floor(spawn.z)), spawn.z);
    me.vy = 0;
}

// Simulates one slice of movement. Returns how far the player moved horizontally.
function stepPlayer(dt) {
    const forward = axis(keys.KeyW, keys.KeyS);
    const strafe = axis(keys.KeyD, keys.KeyA);
    const speed = me.flying ? FLY_SPEED : WALK_SPEED;
    const length = Math.hypot(forward, strafe) || 1;   // stops diagonal movement being faster

    const dx = ((-Math.sin(me.yaw) * forward + Math.cos(me.yaw) * strafe) / length) * speed * dt;
    const dz = ((-Math.cos(me.yaw) * forward - Math.sin(me.yaw) * strafe) / length) * speed * dt;

    let dy;
    if (me.flying) {
        dy = axis(keys.Space, keys.ShiftLeft || keys.ShiftRight) * speed * dt;
    } else {
        if (me.onGround && keys.Space) me.vy = JUMP_SPEED;
        me.vy = Math.max(me.vy - GRAVITY * dt, -MAX_FALL_SPEED);
        dy = me.vy * dt;
    }

    const startX = me.pos.x;
    const startZ = me.pos.z;
    const blocked = moveBody(world, me.pos, dx, dy, dz);

    me.onGround = blocked === -1;
    if (blocked !== 0) me.vy = 0;
    if (blocked === -1 && me.flying) setFlying(false);   // touching the ground ends flight

    if (me.pos.y < VOID_Y) respawn();

    return Math.hypot(me.pos.x - startX, me.pos.z - startZ);
}

function updatePlayer(dt) {
    let remaining = dt;
    let moved = 0;

    while (remaining > 0) {
        const step = Math.min(remaining, PHYSICS_STEP);
        moved += stepPlayer(step);
        remaining -= step;
    }
    return moved;
}

// ---------- Breaking and placing blocks ----------

const eye = new THREE.Vector3();
const look = new THREE.Vector3();

function updateTarget() {
    eye.set(me.pos.x, me.pos.y + EYE_HEIGHT, me.pos.z);
    look.set(
        -Math.sin(me.yaw) * Math.cos(me.pitch),
        Math.sin(me.pitch),
        -Math.cos(me.yaw) * Math.cos(me.pitch)
    );

    target = raycast(world, eye, look, REACH);
    selection.visible = target !== null;
    if (target) selection.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
}

// Changes a block on this screen only. Used for changes that came from the server.
function applyBlock(x, y, z, id) {
    if (world.setBlock(x, y, z, id)) view.blockChanged(x, z);
}

// Changes a block here and tells the server. If the server disagrees it sends the real
// value back, and applyBlock puts things right.
function changeBlock(x, y, z, id) {
    applyBlock(x, y, z, id);
    send({ t: 'block', x, y, z, id });
}

function placeHeldBlock() {
    const block = BLOCK_BY_NAME.get(ITEMS[selectedSlot]?.block);
    if (!block) return;

    const x = target.x + target.nx;
    const y = target.y + target.ny;
    const z = target.z + target.nz;

    if (!world.inBounds(x, y, z) || world.isSolid(x, y, z) || overlapsPlayer(me.pos, x, y, z)) return;
    changeBlock(x, y, z, block.id);
}

function handleActions(now) {
    if (!target || now - lastAction < ACTION_REPEAT_MS) return;

    if (mouse.left) {
        lastAction = now;
        changeBlock(target.x, target.y, target.z, AIR);
    } else if (mouse.right) {
        lastAction = now;
        placeHeldBlock();
    }
}

// ---------- Camera and avatar ----------

function updateSelfAvatar(dt, moved) {
    selfAvatar.visible = cameraMode !== 0;
    selfAvatar.position.copy(me.pos);
    setLook(selfAvatar, me.yaw, me.pitch);
    animateWalk(selfAvatar, moved, dt);
}

function updateCamera() {
    camera.position.set(me.pos.x, me.pos.y + EYE_HEIGHT, me.pos.z);
    camera.rotation.set(me.pitch, me.yaw, 0);

    if (cameraMode === 1) {
        camera.translateZ(THIRD_PERSON_DISTANCE);
    } else if (cameraMode === 2) {
        camera.rotation.set(-me.pitch, me.yaw + Math.PI, 0);
        camera.translateZ(THIRD_PERSON_DISTANCE);
    }
}

// ---------- Main loop ----------

let lastFrame = performance.now();

renderer.setAnimationLoop(now => {
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    if (!inGame) return;

    const moved = updatePlayer(dt);
    updateTarget();
    handleActions(now);
    sendPosition(now);
    remotes.update(dt);
    updateSelfAvatar(dt, moved);
    updateCamera();
    view.update();

    renderer.render(scene, camera);
});
