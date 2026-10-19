import { HOTBAR_SLOTS } from './config.js';
import { BLOCK_BY_NAME, faceTexture } from './blocks.js';
import { ITEMS } from './items.js';

const $ = id => document.getElementById(id);

// ---------- Lobby ----------

const nameInput = $('name');

try {
    nameInput.value = localStorage.getItem('name') || '';
} catch {
    nameInput.value = '';
}

export function playerName() {
    const name = nameInput.value.trim();
    try {
        localStorage.setItem('name', name);
    } catch {
        // storage can be blocked; the name just will not be remembered
    }
    return name;
}

export function bindLobby({ onCreate, onLeave }) {
    $('create').onclick = () => onCreate($('rname').value);
    $('rname').addEventListener('keydown', e => {
        if (e.key === 'Enter') onCreate($('rname').value);
    });
    $('leave').onclick = onLeave;
}

export function renderServerList(rooms, onJoin) {
    const ul = $('list');
    ul.replaceChildren();

    if (!rooms.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'No servers yet. Create one!';
        ul.append(li);
        return;
    }

    for (const room of rooms) {
        const li = document.createElement('li');

        const label = document.createElement('span');
        label.textContent = `${room.name}  (${room.count}/${room.max})`;

        const button = document.createElement('button');
        button.textContent = 'Join';
        button.disabled = room.count >= room.max;
        button.onclick = () => onJoin(room.id);

        li.append(label, button);
        ul.append(li);
    }
}

export function setStatus(text) {
    $('status').textContent = text;
}

// ---------- In-game HUD ----------

export function showGame(visible) {
    $('lobby').hidden = visible;
    for (const id of ['hud', 'cross', 'hint', 'hotbar', 'held']) $(id).hidden = !visible;
}

export function setRoomName(name) {
    $('room').textContent = name;
}

export function setMode(text) {
    $('mode').textContent = text;
}

export function setHint(text) {
    $('hint').textContent = text;
}

export function renderPlayerList(names) {
    const ul = $('players');
    ul.replaceChildren();

    for (const name of names) {
        const li = document.createElement('li');
        li.textContent = name;
        ul.append(li);
    }
}

// ---------- Hotbar ----------

let slots = [];

// An item's icon: its own icon file, or the side texture of the block it places
function iconUrl(item) {
    if (item.icon) return `/textures/items/${item.icon}.png`;

    const block = BLOCK_BY_NAME.get(item.block);
    return block ? `/textures/blocks/${faceTexture(block, 'side')}.png` : null;
}

export function buildHotbar() {
    const bar = $('hotbar');
    bar.replaceChildren();
    slots = [];

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';

        const number = document.createElement('span');
        number.textContent = i + 1;
        slot.append(number);

        const url = ITEMS[i] ? iconUrl(ITEMS[i]) : null;
        if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.onerror = () => img.remove();
            slot.append(img);
        }

        bar.append(slot);
        slots.push(slot);
    }
}

export function selectSlot(index) {
    slots.forEach((slot, i) => slot.classList.toggle('selected', i === index));
    $('held').textContent = ITEMS[index]?.name ?? '';
}
