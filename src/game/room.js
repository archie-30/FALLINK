import {rng} from '../core/rng.js';

export class Sandbox {
    constructor(room,enemies) {
        this.room=room;
        this.enemies=enemies;
        this.timer=0.6;
    }

    pickPoint(player) {
        const pts=this.room.def.spawnPoints;
        let best=pts[0];
        let bestScore=-1;
        for (let k=0;k<4;k++) {
            const p=rng.pick(pts);
            const d=Math.hypot(p[0]-player.pos.x,p[1]-player.pos.z);
            if (d>bestScore) {
                bestScore=d;
                best=p;
            }
        }
        return best;
    }

    update(dt,player) {
        const def=this.room.def;
        if (this.enemies.aliveCount()>=def.enemyCount) {
            this.timer=def.respawnDelay;
            return null;
        }
        this.timer-=dt;
        if (this.timer>0) {
            return null;
        }
        this.timer=def.respawnDelay*0.5;
        const p=this.pickPoint(player);
        return this.enemies.spawn(rng.pick(def.enemyTypes),p[0],p[1]);
    }
}
