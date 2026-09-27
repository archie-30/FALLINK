import {CARDS} from '../data/cards.js';
import {t} from '../data/strings.js';

let nextUid=1;

export function createCard(id,upgraded=false) {
    const def=CARDS[id];
    return {uid:nextUid++,id,def,upgraded};
}

export function cardCost(card) {
    return card.upgraded&&card.def.upgraded.cost!==undefined?card.def.upgraded.cost:card.def.cost;
}

export function cardParams(card) {
    return card.upgraded?{...card.def.params,...card.def.upgraded.params}:card.def.params;
}

export function cardName(card) {
    return t(card.def.nameKey)+(card.upgraded?'+':'');
}

export function cardDesc(card) {
    return t(card.def.descKey,cardParams(card));
}

export function cardRange(card) {
    return card.def.range||8;
}

export function cardRadius(card) {
    const p=cardParams(card);
    return p.radius||0;
}

export function cardKey(card) {
    return card.id+(card.upgraded?'+':'');
}

export class CardEffects {
    constructor(g,tuning) {
        this.g=g;
        this.E=tuning.effects;
        this.T=tuning;
        this.mp={x:0,z:0};
    }

    run(card,target) {
        const g=this.g;
        g.particles.burst(target.x,1.0,target.z,8,{color:card.def.rarity==='rare'?'red':'ink',speed:[1,4],up:[1,4],size:[0.08,0.16],life:[0.25,0.5]});
        card.def.effect(this,target,cardParams(card));
    }

    muzzle(dx,dz) {
        const p=this.g.player;
        p.faceDir(dx,dz);
        p.recoil();
        return p.muzzlePoint(this.mp);
    }

    spread(dx,dz,count,spread,damage,speed) {
        const g=this.g;
        const m=this.muzzle(dx,dz);
        const base=Math.atan2(dz,dx);
        for (let i=0;i<count;i++) {
            const a=count>1?base+(i/(count-1)-0.5)*spread:base;
            g.playerBullets.spawn(m.x,m.z,Math.cos(a),Math.sin(a),speed,damage,this.T.weapon.bulletLife);
        }
        g.muzzle.show(m.x,this.T.weapon.height,m.z,'ink',1.6);
        g.fx.cameraShake(this.E.spreadShake);
        g.fx.fovPunch(1.0);
        g.particles.burst(m.x,this.T.weapon.height,m.z,8,{dirX:dx,dirZ:dz,cone:0.6,speed:[3,7]});
    }

    pierceShot(dx,dz,damage,speed) {
        const g=this.g;
        const m=this.muzzle(dx,dz);
        g.pierceBullets.spawn(m.x,m.z,dx,dz,speed,damage,1.2);
        g.muzzle.show(m.x,this.T.weapon.height,m.z,'ink',2.0);
        g.fx.cameraShake(this.E.pierceShake);
        g.fx.fovPunch(this.E.pierceFov);
        g.player.vel.x-=dx*6;
        g.player.vel.z-=dz*6;
    }

    homingShots(count,damage) {
        const g=this.g;
        const p=g.player;
        const base=Math.atan2(p.aimDirZ,p.aimDirX);
        for (let i=0;i<count;i++) {
            const a=base+(count>1?(i/(count-1)-0.5)*2.2:0);
            g.homingBullets.spawn(p.pos.x+Math.cos(a)*0.6,p.pos.z+Math.sin(a)*0.6,Math.cos(a),Math.sin(a),this.E.homingSpeed,damage,this.E.homingLife);
        }
        g.fx.fovPunch(0.8);
        g.particles.burst(p.pos.x,1.0,p.pos.z,10,{speed:[2,5],up:[2,5]});
    }

    lobBomb(x,z,radius,damage) {
        const g=this.g;
        const p=g.player;
        const dx=x-p.pos.x;
        const dz=z-p.pos.z;
        const l=Math.hypot(dx,dz)||1;
        const m=this.muzzle(dx/l,dz/l);
        const arc=Math.min(this.E.bombArc,l*0.4+0.8);
        g.lobs.launch(m.x,m.z,x,z,this.E.bombFlight,arc,(lx,lz)=>this.explode(lx,lz,radius,damage));
    }

    explode(x,z,radius,damage) {
        const g=this.g;
        g.enemies.damageRadius(x,z,radius,damage);
        g.fx.hitStop(90,true);
        g.fx.cameraShake(this.E.bombShake);
        g.fx.fovPunch(this.E.bombFov);
        g.rings.spawn(x,z,radius*1.1,'ink',0.35);
        g.decals.spawn(x,z,radius*1.5,'ink','midGray');
        g.particles.burst(x,0.4,z,30,{speed:[3,radius*3.2],up:[3,9],size:[0.12,0.3],life:[0.4,0.9]});
        g.particles.burst(x,0.2,z,14,{speed:[1,3],up:[6,11],size:[0.1,0.2],life:[0.5,0.9]});
    }

    buffRapid(duration,mult) {
        const g=this.g;
        const p=g.player;
        p.rapidT=duration;
        p.rapidMult=mult;
        p.sqv+=2;
        g.fx.fovPunch(1.2);
        g.rings.spawn(p.pos.x,p.pos.z,1.8,'ink',0.3);
        g.particles.burst(p.pos.x,0.8,p.pos.z,14,{speed:[2,5],up:[3,6]});
    }

    execute(x,z,damage,radius) {
        const g=this.g;
        const E=this.E;
        const p=g.player;
        const e=g.enemies.nearest(x,z,radius);
        if (e) {
            const dx=e.pos.x-p.pos.x;
            const dz=e.pos.z-p.pos.z;
            const l=Math.hypot(dx,dz)||1;
            const ex=e.pos.x;
            const ez=e.pos.z;
            g.fx.slowMo(E.executeSlow,E.executeSlowTime);
            g.fx.hitStop(E.executeStop,true);
            g.fx.invertFrame(2);
            g.fx.cameraShake(E.executeShake);
            g.fx.fovPunch(2.4);
            g.enemies.damage(e,damage,dx/l,dz/l);
            g.decals.spawn(ex,ez,3.0);
            g.rings.spawn(ex,ez,2.6,'red',0.3);
            g.particles.burst(ex,1.0,ez,26,{color:'red',dirX:dx/l,dirZ:dz/l,cone:1.1,speed:[4,12],up:[2,7],size:[0.1,0.22]});
            return;
        }
        g.enemies.damageRadius(x,z,E.missRadius,E.missDamage);
        g.decals.spawn(x,z,1.6);
        g.rings.spawn(x,z,E.missRadius,'red',0.3);
        g.fx.cameraShake(0.3);
        g.particles.burst(x,0.6,z,12,{color:'red',speed:[2,6],up:[2,5]});
    }
}
