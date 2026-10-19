import { PLAYER_WIDTH, PLAYER_HEIGHT } from './config.js';
import { WORLD_SIZE } from './world.js';

const HALF = PLAYER_WIDTH / 2;
const EPS = 1e-5;   // forgives floating point error when standing flush against a block

// True if the player's box, with its feet at (x, y, z), overlaps a solid block.
// The edges of the world count as solid walls.
export function collides(world, x, y, z) {
    const x0 = Math.floor(x - HALF + EPS);
    const x1 = Math.floor(x + HALF - EPS);
    const y0 = Math.floor(y + EPS);
    const y1 = Math.floor(y + PLAYER_HEIGHT - EPS);
    const z0 = Math.floor(z - HALF + EPS);
    const z1 = Math.floor(z + HALF - EPS);

    for (let by = y0; by <= y1; by++) {
        for (let bz = z0; bz <= z1; bz++) {
            for (let bx = x0; bx <= x1; bx++) {
                if (bx < 0 || bz < 0 || bx >= WORLD_SIZE || bz >= WORLD_SIZE) return true;
                if (world.isSolid(bx, by, bz)) return true;
            }
        }
    }
    return false;
}

// Moves pos by (dx, dy, dz) one axis at a time, stopping flush against solid blocks so the
// player slides along walls. Returns -1 if the player hit the floor, 1 if they hit a
// ceiling, 0 otherwise.
export function moveBody(world, pos, dx, dy, dz) {
    if (dx !== 0) {
        const x = pos.x + dx;
        if (!collides(world, x, pos.y, pos.z)) pos.x = x;
        else pos.x = dx > 0 ? Math.floor(x + HALF) - HALF : Math.floor(x - HALF) + 1 + HALF;
    }

    if (dz !== 0) {
        const z = pos.z + dz;
        if (!collides(world, pos.x, pos.y, z)) pos.z = z;
        else pos.z = dz > 0 ? Math.floor(z + HALF) - HALF : Math.floor(z - HALF) + 1 + HALF;
    }

    let blocked = 0;
    if (dy !== 0) {
        const y = pos.y + dy;
        if (!collides(world, pos.x, y, pos.z)) {
            pos.y = y;
        } else if (dy > 0) {
            pos.y = Math.floor(y + PLAYER_HEIGHT) - PLAYER_HEIGHT;
            blocked = 1;
        } else {
            pos.y = Math.floor(y) + 1;
            blocked = -1;
        }
    }
    return blocked;
}

// True if the block at (bx, by, bz) overlaps the player's box (used to stop you building inside yourself)
export function overlapsPlayer(pos, bx, by, bz) {
    return pos.x + HALF > bx && pos.x - HALF < bx + 1
        && pos.y + PLAYER_HEIGHT > by && pos.y < by + 1
        && pos.z + HALF > bz && pos.z - HALF < bz + 1;
}

// Finds the first solid block along a ray (dir must have length 1).
// Returns { x, y, z, nx, ny, nz } or null. (x, y, z) is the block that was hit, and
// (nx, ny, nz) points out of the face that was hit, so the empty cell in front of that
// face is (x + nx, y + ny, z + nz).
export function raycast(world, origin, dir, maxDistance) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = Math.sign(dir.x);
    const stepY = Math.sign(dir.y);
    const stepZ = Math.sign(dir.z);

    // How far along the ray we travel to cross one whole cell on each axis
    const deltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const deltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const deltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

    // How far along the ray the next cell boundary on each axis is
    let nextX = stepX > 0 ? (x + 1 - origin.x) / dir.x : stepX < 0 ? (x - origin.x) / dir.x : Infinity;
    let nextY = stepY > 0 ? (y + 1 - origin.y) / dir.y : stepY < 0 ? (y - origin.y) / dir.y : Infinity;
    let nextZ = stepZ > 0 ? (z + 1 - origin.z) / dir.z : stepZ < 0 ? (z - origin.z) / dir.z : Infinity;

    let nx = 0;
    let ny = 0;
    let nz = 0;

    while (true) {
        let t;
        if (nextX < nextY && nextX < nextZ) {
            t = nextX;
            x += stepX;
            nextX += deltaX;
            nx = -stepX; ny = 0; nz = 0;
        } else if (nextY < nextZ) {
            t = nextY;
            y += stepY;
            nextY += deltaY;
            nx = 0; ny = -stepY; nz = 0;
        } else {
            t = nextZ;
            z += stepZ;
            nextZ += deltaZ;
            nx = 0; ny = 0; nz = -stepZ;
        }

        if (t > maxDistance) return null;
        if (world.isSolid(x, y, z)) return { x, y, z, nx, ny, nz };
    }
}
