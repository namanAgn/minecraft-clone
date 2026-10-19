import { makeAvatar, setLook, animateWalk, disposeAvatar } from './avatar.js';

const angleDiff = (a, b) => ((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

// The other players in the current server. The server tells us where each one is about
// 20 times a second; update() eases their bodies toward that spot so they move smoothly.
export class Remotes {
    constructor(scene, onChange) {
        this.scene = scene;
        this.onChange = onChange;   // called whenever someone joins or leaves
        this.players = new Map();   // id -> { avatar, name, tx, ty, tz, yaw, pitch }
    }

    add(p) {
        const avatar = makeAvatar(p.name);
        avatar.position.set(p.x, p.y, p.z);
        setLook(avatar, p.yaw, p.pitch);
        this.scene.add(avatar);

        this.players.set(p.id, { avatar, name: p.name, tx: p.x, ty: p.y, tz: p.z, yaw: p.yaw, pitch: p.pitch });
        this.onChange();
    }

    drop(id) {
        const player = this.players.get(id);
        if (!player) return;

        disposeAvatar(player.avatar);
        this.players.delete(id);
        this.onChange();
    }

    clear() {
        for (const id of [...this.players.keys()]) this.drop(id);
    }

    moved(m) {
        const player = this.players.get(m.id);
        if (player) Object.assign(player, { tx: m.x, ty: m.y, tz: m.z, yaw: m.yaw, pitch: m.pitch });
    }

    names() {
        return [...this.players.values()].map(p => p.name);
    }

    update(dt) {
        const ease = 1 - Math.exp(-dt * 15);

        for (const p of this.players.values()) {
            const avatar = p.avatar;
            const startX = avatar.position.x;
            const startZ = avatar.position.z;

            avatar.position.x += (p.tx - avatar.position.x) * ease;
            avatar.position.y += (p.ty - avatar.position.y) * ease;
            avatar.position.z += (p.tz - avatar.position.z) * ease;
            avatar.rotation.y += angleDiff(p.yaw, avatar.rotation.y) * ease;
            avatar.rig.head.rotation.x += (p.pitch - avatar.rig.head.rotation.x) * ease;

            animateWalk(avatar, Math.hypot(avatar.position.x - startX, avatar.position.z - startZ), dt);
        }
    }
}
