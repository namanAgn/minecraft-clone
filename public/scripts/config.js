// Gameplay tweaks. Plain numbers only: nothing here touches the page or three.js,
// so the server imports this file too. Restart the server after editing it.

// ---- Movement (blocks per second unless noted) ----
export const WALK_SPEED = 5;
export const FLY_SPEED = 10;
export const GRAVITY = 32;               // blocks per second squared
export const JUMP_SPEED = 9;             // jump height = JUMP_SPEED^2 / (2 * GRAVITY), about 1.25 blocks
export const MAX_FALL_SPEED = 40;
export const DOUBLE_TAP_MS = 300;        // two Space presses this close together toggle flying
export const MOUSE_SENSITIVITY = 0.0025;

// ---- Player ----
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.6;         // collision box only; the model's size comes from PLAYER_HEIGHT
export const EYE_HEIGHT = 1.62;
export const REACH = 5;                  // how far you can break and place blocks
export const VOID_Y = -30;               // fall below this and you respawn

// ---- World ----
export const CHUNK_SIZE = 16;
export const WORLD_CHUNKS = 8;           // the world is WORLD_CHUNKS x WORLD_CHUNKS chunks wide
export const WORLD_HEIGHT = 32;
export const GROUND_HEIGHT = 4;          // flat terrain: dirt layers with one grass layer on top

// ---- Blocks and items ----
export const BLOCK_TEXTURE_SIZE = 16;    // pixels per block texture in the atlas
export const HOTBAR_SLOTS = 9;
export const ACTION_REPEAT_MS = 200;     // delay between actions while a mouse button is held

// ---- Networking ----
export const MAX_PLAYERS = 16;
export const MAX_ROOMS = 50;
export const SEND_INTERVAL_MS = 50;      // position updates, 20 per second
export const REACH_LEEWAY = 2;           // extra reach the server forgives to cover lag
