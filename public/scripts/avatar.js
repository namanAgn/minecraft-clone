import * as THREE from 'three';
import { PLAYER_HEIGHT } from './config.js';
import { NAME_TAG_FONT, NAME_TAG_TEXT, NAME_TAG_BACKGROUND } from './visuals.js';
import { loadSkin } from './textures.js';

// The model is measured in "model pixels": 32 tall in total, like Minecraft's.
// U converts one model pixel to world units, so the player is PLAYER_HEIGHT tall.
const U = PLAYER_HEIGHT / 32;

// skin.png is laid out on a 64 x 64 grid. A higher resolution file works too, as long as
// it keeps the same layout (see textures/README.txt).
const SKIN_GRID = 64;

let material = null;

export async function loadAvatarAssets() {
    material = new THREE.MeshLambertMaterial({ map: await loadSkin('/textures/player/skin.png') });
}

// ---------- Mapping the skin onto a box ----------

// The six rectangles a part uses on the skin. Its origin is (u, v) and its size is
// w (width) x h (height) x d (depth). "right" and "left" are the character's own sides.
function skinRects(u, v, w, h, d) {
    return {
        right: [u, v + d, d, h],
        front: [u + d, v + d, w, h],
        left: [u + d + w, v + d, d, h],
        back: [u + 2 * d + w, v + d, w, h],
        top: [u + d, v, w, d],
        bottom: [u + d + w, v, w, d],
    };
}

// BoxGeometry orders its faces +x, -x, +y, -y, +z, -z. The player faces -z, and
// their right side is +x.
const FACE_ORDER = ['right', 'left', 'top', 'bottom', 'back', 'front'];

function applySkinUV(geometry, u, v, w, h, d) {
    const rects = skinRects(u, v, w, h, d);
    const uv = geometry.attributes.uv;

    FACE_ORDER.forEach((name, face) => {
        const [x, y, rw, rh] = rects[name];
        const left = x / SKIN_GRID;
        const right = (x + rw) / SKIN_GRID;
        const top = 1 - y / SKIN_GRID;
        const bottom = 1 - (y + rh) / SKIN_GRID;

        const topLeft = [left, top];
        const topRight = [right, top];
        const bottomLeft = [left, bottom];
        const bottomRight = [right, bottom];

        // Each face has 4 vertices, ordered top-left, top-right, bottom-left, bottom-right.
        // The top and bottom faces of a skin are drawn rotated half a turn relative to that.
        const corners = (name === 'top' || name === 'bottom')
            ? [bottomRight, bottomLeft, topRight, topLeft]
            : [topLeft, topRight, bottomLeft, bottomRight];

        corners.forEach(([cu, cv], i) => uv.setXY(face * 4 + i, cu, cv));
    });
    uv.needsUpdate = true;
}

// ---------- Building the avatar ----------

// A box of w x h x d model pixels using the skin rectangle at (u, v).
// anchor sets the pivot: 'top' for arms and legs, 'bottom' for the head.
function makePart(w, h, d, u, v, anchor = 'center') {
    const geometry = new THREE.BoxGeometry(w * U, h * U, d * U);
    applySkinUV(geometry, u, v, w, h, d);
    if (anchor === 'top') geometry.translate(0, -h * U / 2, 0);
    if (anchor === 'bottom') geometry.translate(0, h * U / 2, 0);
    return new THREE.Mesh(geometry, material);
}

function makeNameTag(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 32;

    const g = canvas.getContext('2d');
    g.font = NAME_TAG_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    const width = Math.min(g.measureText(text).width + 12, 256);
    g.fillStyle = NAME_TAG_BACKGROUND;
    g.fillRect(128 - width / 2, 2, width, 28);
    g.fillStyle = NAME_TAG_TEXT;
    g.fillText(text, 128, 17, 244);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    tag.scale.set(2, 0.25, 1);
    tag.position.y = PLAYER_HEIGHT + 0.3;
    return tag;
}

// The returned group's origin is at the player's FEET. Rotating it on y turns the whole
// body; avatar.rig holds the moving parts so other code can pose them.
export function makeAvatar(name) {
    const avatar = new THREE.Group();

    const body = makePart(8, 12, 4, 16, 16);
    body.position.y = 18 * U;

    const head = makePart(8, 8, 8, 0, 0, 'bottom');
    head.position.y = 24 * U;

    const armRight = makePart(4, 12, 4, 40, 16, 'top');
    armRight.position.set(6 * U, 24 * U, 0);

    const armLeft = makePart(4, 12, 4, 32, 48, 'top');
    armLeft.position.set(-6 * U, 24 * U, 0);

    const legRight = makePart(4, 12, 4, 0, 16, 'top');
    legRight.position.set(2 * U, 12 * U, 0);

    const legLeft = makePart(4, 12, 4, 16, 48, 'top');
    legLeft.position.set(-2 * U, 12 * U, 0);

    const tag = makeNameTag(name);

    avatar.add(body, head, armLeft, armRight, legLeft, legRight, tag);
    avatar.rig = { head, armLeft, armRight, legLeft, legRight, tag, phase: 0, swing: 0 };
    return avatar;
}

// ---------- Posing ----------

export function setLook(avatar, yaw, pitch) {
    avatar.rotation.y = yaw;
    avatar.rig.head.rotation.x = pitch;
}

// Swings arms and legs. distance is how far the avatar moved horizontally this frame,
// so the swing speed matches the walking speed and stops when standing still.
export function animateWalk(avatar, distance, dt) {
    const rig = avatar.rig;
    const speed = distance / Math.max(dt, 0.001);

    rig.phase += distance * 1.4;
    rig.swing += (Math.min(speed / 4, 1) * 0.8 - rig.swing) * Math.min(dt * 12, 1);

    const s = Math.sin(rig.phase) * rig.swing;
    rig.legLeft.rotation.x = s;
    rig.legRight.rotation.x = -s;
    rig.armLeft.rotation.x = -s;
    rig.armRight.rotation.x = s;
}

export function disposeAvatar(avatar) {
    avatar.parent?.remove(avatar);
    avatar.traverse(obj => obj.isMesh && obj.geometry.dispose());
    avatar.rig.tag.material.map.dispose();
    avatar.rig.tag.material.dispose();
}
