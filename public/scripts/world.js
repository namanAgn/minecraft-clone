import { CHUNK_SIZE, WORLD_CHUNKS, WORLD_HEIGHT, GROUND_HEIGHT } from './config.js';
import { AIR, blockId } from './blocks.js';

export const WORLD_SIZE = CHUNK_SIZE * WORLD_CHUNKS;   // blocks along x and z
const LAYER = CHUNK_SIZE * CHUNK_SIZE;

// Position of a block inside its chunk's array. Chunks are full-height columns.
export const blockIndex = (x, y, z) => x + z * CHUNK_SIZE + y * LAYER;

// The terrain generator. The world is flat for now: dirt with a grass layer on top.
// Replace this function to get hills, caves or anything else.
function generateChunk() {
    const chunk = new Uint8Array(LAYER * WORLD_HEIGHT);
    const grass = blockId('grass');
    const dirt = blockId('dirt');

    for (let y = 0; y < Math.min(GROUND_HEIGHT, WORLD_HEIGHT); y++) {
        chunk.fill(y === GROUND_HEIGHT - 1 ? grass : dirt, y * LAYER, (y + 1) * LAYER);
    }
    return chunk;
}

// Block data only, no graphics, so the server uses this class as well.
// The server and every client generate the same terrain, so only changes (edits) are ever sent.
export class World {
    constructor() {
        this.chunks = [];
        for (let i = 0; i < WORLD_CHUNKS * WORLD_CHUNKS; i++) this.chunks.push(generateChunk());
        this.edits = new Map();   // "x,y,z" -> block id, every change made since generation
    }

    chunkAt(cx, cz) {
        if (cx < 0 || cz < 0 || cx >= WORLD_CHUNKS || cz >= WORLD_CHUNKS) return null;
        return this.chunks[cx + cz * WORLD_CHUNKS];
    }

    inBounds(x, y, z) {
        return x >= 0 && y >= 0 && z >= 0 && x < WORLD_SIZE && y < WORLD_HEIGHT && z < WORLD_SIZE;
    }

    // x, y and z must be whole numbers. Anything outside the world is air.
    getBlock(x, y, z) {
        if (!this.inBounds(x, y, z)) return AIR;
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks[cx + cz * WORLD_CHUNKS];
        return chunk[blockIndex(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
    }

    // Returns false if the position is outside the world
    setBlock(x, y, z, id) {
        if (!this.inBounds(x, y, z)) return false;
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks[cx + cz * WORLD_CHUNKS];
        chunk[blockIndex(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)] = id;
        this.edits.set(`${x},${y},${z}`, id);
        return true;
    }

    isSolid(x, y, z) {
        return this.getBlock(x, y, z) !== AIR;
    }

    // The y of the free space just above the highest block at (x, z)
    surfaceY(x, z) {
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            if (this.isSolid(x, y, z)) return y + 1;
        }
        return 0;
    }
}
