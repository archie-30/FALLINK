import*as THREE from 'three';
import {CARDS} from '../data/cards.js';
import {t} from '../data/strings.js';
import {toonMaterial,lineMaterial} from '../render/materials.js';

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
        this.sweeps=[];
        this.buildProps();
    }

    buildProps() {
        const eraser=new THREE.Group();
        const a=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.45,0.55),toonMaterial({light:'paper',mid:'farGray',dark:'midGray'}));
        a.position.x=-0.2;
        const b=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.48,0.58),toonMaterial({light:'farGray',mid:'midGray',dark:'nearGray'}));
        b.position.x=0.45;
        eraser.add(a,b);
        eraser.visible=false;
        this.g.scene.add(eraser);
        this.eraserMesh=eraser;
        const lg=new THREE.PlaneGeometry(1,1);
        lg.rotateX(-Math.PI/2);
        lg.translate(0.5,0,0);
        this.redrawLine=new THREE.Mesh(lg,lineMaterial('ink'));
        this.redrawLine.visible=false;
        this.redrawLine.frustumCulled=false;
        this.g.fxScene.add(this.redrawLine);
    }

    update(dt) {
        const g=this.g;
        for (let i=this.sweeps.length-1;i>=0;i--) {
            const s=this.sweeps[i];
            s.t+=dt;
            const k=Math.min(1,s.t/s.dur);
            if (s.type==='eraser') {
                const e=1-Math.pow(1-k,2);
                const a=s.a0+(s.a1-s.a0)*e;
                const lo=Math.min(s.a0,a);
                const hi=Math.max(s.a0,a);
                const cx=s.x;
                const cz=s.z;
                const R=s.range;
                g.enemyBullets.killWhere((x,z)=>{
                    const dx=x-cx;
                    const dz=z-cz;
                    if (dx*dx+dz*dz>R*R) {
                        return false;
                    }
                    let ang=Math.atan2(dz,dx);
                    while (ang<lo-Math.PI) {
                        ang+=Math.PI*2;
                    }
                    while (ang>hi+Math.PI) {
                        ang-=Math.PI*2;
                    }
                    return ang>=lo-0.05&&ang<=hi+0.05;
                },(x,z)=>g.particles.burst(x,1.0,z,2,{color:'farGray',speed:[0.5,2],up:[1,2],size:[0.06,0.1],life:[0.2,0.35]}));
                const r=R*0.55;
                const m=this.eraserMesh;
                m.visible=true;
                m.position.set(cx+Math.cos(a)*r,1.0+Math.sin(k*Math.PI)*0.3,cz+Math.sin(a)*r);
                m.rotation.set(0,-a+Math.PI/2,Math.sin(k*20)*0.1);
                if (Math.random()<0.7) {
                    g.particles.burst(m.position.x,0.8,m.position.z,1,{color:'farGray',speed:[1,3],up:[1,3],size:[0.06,0.12],life:[0.3,0.5]});
                }
                if (k>=1) {
                    m.visible=false;
                    this.sweeps.splice(i,1);
                }
            }
            else if (s.type==='redraw') {
                const b=g.room.bounds;
                const x=b.minX-2+(b.maxX-b.minX+4)*k;
                g.enemyBullets.killWhere(bx=>bx<x,(bx,bz)=>g.particles.burst(bx,1.0,bz,2,{color:'nearGray',speed:[0.5,2],up:[1,3],size:[0.06,0.12],life:[0.2,0.4]}));
                const L=b.maxZ-b.minZ+4;
                const ln=this.redrawLine;
                ln.visible=true;
                ln.position.set(x,0.07,b.maxZ+2);
                ln.rotation.y=Math.PI/2;
                ln.scale.set(L,1,0.5);
                ln.material.uniforms.uLength.value=L;
                if (Math.random()<0.8) {
                    g.particles.burst(x,0.3,b.minZ+Math.random()*(b.maxZ-b.minZ),2,{color:'ink',speed:[1,3],up:[2,5],size:[0.08,0.14],life:[0.3,0.5]});
                }
                if (k>=1) {
                    ln.visible=false;
                    this.sweeps.splice(i,1);
                }
            }
        }
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

    pencilWall(points,params) {
        const g=this.g;
        const piece=g.room.addPencilWall(points,params);
        if (!piece) {
            return;
        }
        g.fx.cameraShake(0.12);
        for (let i=0;i<piece.pts.length;i+=3) {
            const q=piece.pts[i];
            g.particles.burst(q.x,0.2,q.z,2,{color:'midGray',speed:[0.5,2],up:[1,3],size:[0.06,0.12],life:[0.3,0.6]});
        }
    }

    eraseCone(dx,dz,range,angle) {
        const g=this.g;
        const p=g.player;
        p.faceDir(dx,dz);
        const base=Math.atan2(dz,dx);
        this.sweeps.push({type:'eraser',t:0,dur:this.E.eraserSweep,x:p.pos.x,z:p.pos.z,a0:base-angle/2,a1:base+angle/2,range});
        g.fx.cameraShake(0.15);
        g.fx.fovPunch(0.8);
    }

    eraseCover(x,z,radius) {
        const g=this.g;
        const room=g.room;
        const piece=room.nearestErasable(x,z,radius);
        if (!piece) {
            g.particles.burst(x,0.4,z,10,{color:'farGray',speed:[1,3],up:[2,4],size:[0.08,0.14]});
            return;
        }
        room.erasePiece(piece,g.player.pos.x,g.player.pos.z,this.T.terrain.eraseTime);
        g.fx.cameraShake(0.2);
        g.particles.burst(piece.x,0.8,piece.z,16,{color:'farGray',speed:[1,4],up:[2,5],size:[0.08,0.16],life:[0.5,0.9]});
        g.particles.burst(piece.x,0.8,piece.z,8,{color:'paper',speed:[1,3],up:[2,5],size:[0.08,0.14],life:[0.5,0.9]});
    }

    trapCircle(x,z,radius,duration,slow) {
        const g=this.g;
        g.room.zones.addSlow(x,z,radius,duration,slow);
        g.particles.burst(x,0.3,z,10,{color:'ink',speed:[1,radius*1.5],up:[1,3],size:[0.06,0.12]});
    }

    paperShield(hits) {
        const g=this.g;
        const p=g.player;
        p.setShield(hits);
        p.sqv+=2;
        g.fx.fovPunch(0.8);
        g.particles.burst(p.pos.x,1.0,p.pos.z,12,{color:'farGray',speed:[2,4],up:[2,4],size:[0.08,0.14]});
    }

    inkDash(dx,dz,dps,duration) {
        const g=this.g;
        const p=g.player;
        p.faceDir(dx,dz);
        p.forceDash(dx,dz,this.E.dashSpeed,this.E.dashTime);
        p.invuln=Math.max(p.invuln,this.E.dashTime+0.1);
        g.room.zones.addTrail(p,dps,duration);
    }

    timeStop(duration) {
        const g=this.g;
        g.enemyBullets.frozen=duration;
        g.fx.hitStop(80,true);
        g.fx.fovPunch(2.0);
        g.fx.cameraShake(0.25);
    }

    spawnClone(x,z,duration,damage) {
        const g=this.g;
        let c=g.clones.find(o=>!o.active);
        if (!c) {
            c=g.clones[0];
            for (const o of g.clones) {
                if (o.t>c.t) {
                    c=o;
                }
            }
        }
        c.start(x,z,duration,damage);
        g.particles.burst(x,0.6,z,14,{color:'nearGray',speed:[1,4],up:[2,5],size:[0.08,0.16]});
    }

    redraw(inkGain) {
        const g=this.g;
        g.ink.add(inkGain);
        this.sweeps.push({type:'redraw',t:0,dur:this.E.redrawTime});
        g.fx.flash('paper',0.25,0.5);
        g.fx.cameraShake(0.3);
        g.fx.fovPunch(1.5);
    }
}
