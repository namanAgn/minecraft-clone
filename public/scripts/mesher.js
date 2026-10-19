import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_CHUNKS, WORLD_HEIGHT } from './config.js';
import { AIR, BLOCK_BY_ID, faceTexture } from './blocks.js';
import { blockIndex } from './world.js';

// The six faces of a cube. normal points out of the face. corners go bottom-left,
// bottom-right, top-right, top-left as seen from outside, which keeps the texture upright
// and the triangles facing outward.
const FACES = [
    { face: 'side', normal: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { face: 'side', normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { face: 'top', normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { face: 'bottom', normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { face: 'side', normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { face: 'side', normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

// Builds one mesh for a whole chunk. Faces touching another solid block are skipped,
// since nobody can ever see them. Returns null for a chunk with nothing to draw.
export function buildChunkGeometry(world, chunkX, chunkZ, rects) {
    const chunk = world.chunkAt(chunkX, chunkZ);
    const baseX = chunkX * CHUNK_SIZE;
    const baseZ = chunkZ * CHUNK_SIZE;

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const id = chunk[blockIndex(x, y, z)];
                if (id === AIR) continue;

                const block = BLOCK_BY_ID.get(id);
                if (!block) continue;

                const wx = baseX + x;
                const wz = baseZ + z;

                for (const { face, normal, corners } of FACES) {
                    const hidden = y + normal[1] < 0
                        || world.isSolid(wx + normal[0], y + normal[1], wz + normal[2]);
                    if (hidden) continue;

                    const rect = rects.get(faceTexture(block, face));
                    const uvCorners = [
                        [rect.u0, rect.v0], [rect.u1, rect.v0], [rect.u1, rect.v1], [rect.u0, rect.v1],
                    ];
                    const first = positions.length / 3;

                    corners.forEach(([px, py, pz], i) => {
                        positions.push(wx + px, y + py, wz + pz);
                        normals.push(normal[0], normal[1], normal[2]);
                        uvs.push(uvCorners[i][0], uvCorners[i][1]);
                    });
                    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
                }
            }
        }
    }

    if (indices.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
}

// Keeps one mesh per chunk in the scene and rebuilds a chunk when one of its blocks changes
export class WorldView {
    constructor(scene, world, atlas) {
        this.scene = scene;
        this.world = world;
        this.rects = atlas.rects;
        this.material = new THREE.MeshLambertMaterial({ map: atlas.texture });
        this.meshes = new Array(WORLD_CHUNKS * WORLD_CHUNKS).fill(null);
        this.dirty = new Set(this.meshes.keys());
        this.update();
    }

    markDirty(cx, cz) {
        if (this.world.chunkAt(cx, cz)) this.dirty.add(cx + cz * WORLD_CHUNKS);
    }

    // Call after changing the block at column (x, z). A block on a chunk edge also changes
    // which faces its neighbouring chunk needs, so that chunk is rebuilt too.
    blockChanged(x, z) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const lx = x - cx * CHUNK_SIZE;
        const lz = z - cz * CHUNK_SIZE;

        this.markDirty(cx, cz);
        if (lx === 0) this.markDirty(cx - 1, cz);
        if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
        if (lz === 0) this.markDirty(cx, cz - 1);
        if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
    }

    // Rebuilds every chunk marked dirty. Call once per frame.
    update() {
        for (const i of this.dirty) {
            const old = this.meshes[i];
            if (old) {
                this.scene.remove(old);
                old.geometry.dispose();
            }

            const geometry = buildChunkGeometry(this.world, i % WORLD_CHUNKS, Math.floor(i / WORLD_CHUNKS), this.rects);
            if (geometry) {
                this.meshes[i] = new THREE.Mesh(geometry, this.material);
                this.scene.add(this.meshes[i]);
            } else {
                this.meshes[i] = null;
            }
        }
        this.dirty.clear();
    }

    dispose() {
        for (const mesh of this.meshes) {
            if (!mesh) continue;
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this.material.dispose();
    }
}
