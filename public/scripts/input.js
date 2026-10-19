import { MOUSE_SENSITIVITY } from './config.js';

// Keys currently held, by KeyboardEvent.code (for example keys.KeyW)
export const keys = {};

// Mouse buttons currently held. Only tracked while the pointer is locked to the game.
export const mouse = { left: false, right: false };

// Hooks up the keyboard and mouse. handlers is an object of callbacks:
//   isPlaying()        true while the player is inside a server
//   onLook(dx, dy)     mouse movement, already scaled by MOUSE_SENSITIVITY
//   onSpace()          Space was pressed (not held)
//   onCamera()         V was pressed
//   onSlot(index)      a number key 1-9 was pressed
//   onScroll(dir)      the wheel moved: 1 down, -1 up
//   onMouseDown()      a mouse button went down
//   onLockChange()     the pointer was locked or released
// Returns a function that says whether the pointer is currently locked.
export function bindInput(canvas, handlers) {
    const locked = () => document.pointerLockElement === canvas;

    addEventListener('keydown', e => {
        keys[e.code] = true;

        const typing = document.activeElement !== document.body;
        if (!handlers.isPlaying() || e.repeat || typing) return;

        if (e.code === 'Space') handlers.onSpace();
        if (e.code === 'KeyV') handlers.onCamera();

        const digit = /^Digit([1-9])$/.exec(e.code);
        if (digit) handlers.onSlot(Number(digit[1]) - 1);
    });

    addEventListener('keyup', e => {
        keys[e.code] = false;
    });

    addEventListener('blur', () => {
        for (const code in keys) keys[code] = false;
        mouse.left = mouse.right = false;
    });

    canvas.addEventListener('click', () => {
        if (handlers.isPlaying() && !locked()) canvas.requestPointerLock();
    });

    addEventListener('mousemove', e => {
        if (locked()) handlers.onLook(e.movementX * MOUSE_SENSITIVITY, e.movementY * MOUSE_SENSITIVITY);
    });

    addEventListener('mousedown', e => {
        if (!handlers.isPlaying() || !locked()) return;
        if (e.button === 0) mouse.left = true;
        if (e.button === 2) mouse.right = true;
        handlers.onMouseDown();
    });

    addEventListener('mouseup', e => {
        if (e.button === 0) mouse.left = false;
        if (e.button === 2) mouse.right = false;
    });

    addEventListener('contextmenu', e => {
        if (handlers.isPlaying()) e.preventDefault();
    });

    addEventListener('wheel', e => {
        if (handlers.isPlaying() && locked()) handlers.onScroll(Math.sign(e.deltaY));
    });

    document.addEventListener('pointerlockchange', () => {
        if (!locked()) mouse.left = mouse.right = false;
        handlers.onLockChange();
    });

    return locked;
}
