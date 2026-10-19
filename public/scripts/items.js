// Every item in the game. Add an entry to add an item. The hotbar shows the first
// HOTBAR_SLOTS entries in order; keys 1-9 and the mouse wheel select them.
//
//   name   shown in the HUD
//   block  (optional) name of a block from blocks.js; right-click places it
//   icon   (optional) file name from textures/items/ without .png.
//          Items that place a block show that block's texture when no icon is set.
//
// Add any other fields you like (damage, stack size, ...). The hotbar ignores them.
export const ITEMS = [
    { name: 'Grass', block: 'grass' },
    { name: 'Dirt', block: 'dirt' },
];
