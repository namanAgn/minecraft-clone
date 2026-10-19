// Every block type. Add an entry to add a block.
//   id        unique number from 1 to 255 (0 is air). Keep ids stable once worlds are saved.
//   name      unique name, referenced by items.js
//   textures  a file name from textures/blocks/ (without .png) used on every face,
//             or { top, side, bottom } to use different files per face
export const AIR = 0;

export const BLOCKS = [
    { id: 1, name: 'grass', textures: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' } },
    { id: 2, name: 'dirt', textures: 'dirt' },
];

export const BLOCK_BY_ID = new Map(BLOCKS.map(block => [block.id, block]));
export const BLOCK_BY_NAME = new Map(BLOCKS.map(block => [block.name, block]));

export function blockId(name) {
    const block = BLOCK_BY_NAME.get(name);
    if (!block) throw new Error(`Unknown block "${name}"`);
    return block.id;
}

// face is 'top', 'side' or 'bottom'
export function faceTexture(block, face) {
    const t = block.textures;
    return typeof t === 'string' ? t : (t[face] ?? t.side ?? t.top);
}

export function textureNames() {
    const names = new Set();
    for (const block of BLOCKS) {
        for (const face of ['top', 'side', 'bottom']) names.add(faceTexture(block, face));
    }
    return [...names];
}
