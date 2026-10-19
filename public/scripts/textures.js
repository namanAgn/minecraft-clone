import * as THREE from 'three';
import { BLOCK_TEXTURE_SIZE } from './config.js';

// A magenta and black checkerboard, shown when a texture file is missing or misspelled
function missingImage(size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;

    const g = canvas.getContext('2d');
    g.fillStyle = '#000000';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#ff00ff';
    g.fillRect(0, 0, size / 2, size / 2);
    g.fillRect(size / 2, size / 2, size / 2, size / 2);
    return canvas;
}

export function loadImage(url, fallbackSize) {
    return new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => {
            console.warn(`Missing texture: ${url}`);
            resolve(missingImage(fallbackSize));
        };
        image.src = url;
    });
}

// Sharp pixels: no smoothing and no mipmaps
function pixelated(texture) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

export async function loadSkin(url) {
    return pixelated(new THREE.Texture(await loadImage(url, 64)));
}

// Packs every block texture into one image so each chunk can be drawn in a single call.
// Returns { texture, rects }, where rects maps a texture name to { u0, v0, u1, v1 },
// the rectangle that texture occupies inside the atlas (v0 is the bottom edge).
export async function buildBlockAtlas(names) {
    const size = BLOCK_TEXTURE_SIZE;
    const cols = Math.ceil(Math.sqrt(names.length));
    const rows = Math.ceil(names.length / cols);

    const canvas = document.createElement('canvas');
    canvas.width = cols * size;
    canvas.height = rows * size;

    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;

    const images = await Promise.all(names.map(name => loadImage(`/textures/blocks/${name}.png`, size)));
    images.forEach((image, i) => {
        g.drawImage(image, (i % cols) * size, Math.floor(i / cols) * size, size, size);
    });

    // Pulls each rectangle in by a sliver of a pixel so neighbouring tiles never bleed in
    const insetU = 0.05 / canvas.width;
    const insetV = 0.05 / canvas.height;

    const rects = new Map();
    names.forEach((name, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        rects.set(name, {
            u0: col / cols + insetU,
            u1: (col + 1) / cols - insetU,
            v0: 1 - (row + 1) / rows + insetV,
            v1: 1 - row / rows - insetV,
        });
    });

    return { texture: pixelated(new THREE.CanvasTexture(canvas)), rects };
}
