import*as THREE from 'three';
import {CARDS} from '../data/cards.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {toonMaterial,lineMaterial,unlitMaterial} from '../render/materials.js';

let nextUid=1;

export function createCard(id,upgraded=false) {
    const def=CARDS[id];
    return {uid:nextUid++,id,def,upgraded};
}

export function cardCost(card) {
    if (!card.upgraded) {
        return card.def.cost;
    }
    if (card.def.rarity==='rare') {
        return Math.max(0,card.def.cost-1);
    }
    return card.def.upgraded.cost!==undefined?card.def.upgraded.cost:card.def.cost;
}

export function cardParams(card) {
    return card.upgraded&&card.def.rarity!=='rare'?{...card.def.params,...card.def.upgraded.params}:card.def.params;
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
        this.timers=[];
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
        const mk=()=>{
            const m=new THREE.Mesh(lg,lineMaterial('ink'));
            m.visible=false;
            m.frustumCulled=false;
            this.g.fxScene.add(m);
            return m;
        };
        this.links=[];
        for (let i=0;i<10;i++) {
            this.links.push({mesh:mk(),t:0,life:0});
        }
        this.waveLine=mk();
        this.beamLine=mk();
        this.eraserLine=mk();
        this.bladeMesh=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.62,0.06,3),toonMaterial({light:'paper',mid:'farGray',dark:'midGray'}));
        this.bladeMesh.visible=false;
        this.g.scene.add(this.bladeMesh);
        this.lastUlt=null;
        this.mines=[];
        const mg=new THREE.SphereGeometry(0.42,10,6,0,Math.PI*2,0,Math.PI/2);
        const mm=unlitMaterial({color:'ink',jitter:0.02});
        const cg=new THREE.CylinderGeometry(0.12,0.12,0.3,6);
        for (let i=0;i<4;i++) {
            const m=new THREE.Mesh(mg,mm);
            const cap=new THREE.Mesh(cg,unlitMaterial({color:'nearGray'}));
            cap.position.y=0.45;
            m.add(cap);
            m.visible=false;
            this.g.scene.add(m);
            this.mines.push({mesh:m,active:false,x:0,z:0,r:3,dmg:50,t:0});
        }
    }

    clear() {
        this.timers.length=0;
        this.sweeps.length=0;
        this.bladeMesh.visible=false;
        this.eraserMesh.visible=false;
        this.eraserLine.visible=false;
        this.redrawLine.visible=false;
        this.waveLine.visible=false;
        this.beamLine.visible=false;
        for (const l of this.links) {
            l.mesh.visible=false;
            l.life=0;
        }
        for (const m of this.mines) {
            m.active=false;
            m.mesh.visible=false;
        }
    }

    setLine(mesh,x0,z0,x1,z1,width,y=0.08) {
        const dx=x1-x0;
        const dz=z1-z0;
        const L=Math.hypot(dx,dz)||0.01;
        mesh.visible=true;
        mesh.position.set(x0,y,z0);
        mesh.rotation.y=Math.atan2(-dz,dx);
        mesh.scale.set(L,1,width);
        mesh.material.uniforms.uLength.value=L;
    }

    link(x0,z0,x1,z1) {
        const l=this.links.find(q=>q.life<=0)||this.links[0];
        l.t=0;
        l.life=0.35;
        this.setLine(l.mesh,x0,z0,x1,z1,0.3,1.0);
    }

    updateExtras(dt) {
        const g=this.g;
        for (const l of this.links) {
            if (l.life>0) {
                l.t+=dt;
                if (l.t>=l.life) {
                    l.life=0;
                    l.mesh.visible=false;
                }
                else {
                    l.mesh.scale.z=0.3*(1-l.t/l.life)+0.02;
                }
            }
        }
        for (const m of this.mines) {
            if (!m.active) {
                continue;
            }
            m.t+=dt;
            const pulse=1+Math.sin(m.t*6)*0.08;
            m.mesh.scale.set(pulse,pulse,pulse);
            let trig=m.t>25;
            if (m.t>0.4) {
                if (g.enemies.nearest(m.x,m.z,1.6,true)) {
                    trig=true;
                }
            }
            if (trig) {
                m.active=false;
                m.mesh.visible=false;
                this.explode(m.x,m.z,m.r,m.dmg);
            }
        }
    }

    update(dt) {
        const g=this.g;
        this.updateExtras(dt);
        for (let i=this.timers.length-1;i>=0;i--) {
            this.timers[i].left-=dt;
            if (this.timers[i].left<=0) {
                this.timers.splice(i,1);
            }
        }
        for (let i=this.sweeps.length-1;i>=0;i--) {
            const s=this.sweeps[i];
            s.t+=dt;
            const k=Math.min(1,s.t/s.dur);
            if (this.updateSweep(s,k,dt)) {
                this.sweeps.splice(i,1);
                continue;
            }
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
                const r=R*this.E.eraserRide;
                const m=this.eraserMesh;
                m.visible=true;
                m.position.set(cx+Math.cos(a)*r,1.0+Math.sin(k*Math.PI)*0.3,cz+Math.sin(a)*r);
                m.rotation.set(0,-a+Math.PI/2,Math.sin(k*20)*0.1);
                m.scale.setScalar(this.E.eraserScale);
                this.setLine(this.eraserLine,cx,cz,cx+Math.cos(a)*R,cz+Math.sin(a)*R,this.E.eraserWidth*(1-k*0.5),0.07);
                for (let q=0;q<2;q++) {
                    const rr=R*(0.25+Math.random()*0.75);
                    g.particles.burst(cx+Math.cos(a)*rr,0.6,cz+Math.sin(a)*rr,1,{color:'farGray',speed:[1,3],up:[1,3],size:[0.06,0.12],life:[0.3,0.5]});
                }
                if (k>=1) {
                    m.visible=false;
                    this.eraserLine.visible=false;
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
        const params=cardParams(card);
        const p=g.player;
        const keep=target.ox!==undefined;
        const sx=p.pos.x;
        const sz=p.pos.z;
        if (keep) {
            p.pos.x=target.ox;
            p.pos.z=target.oz;
        }
        card.def.effect(this,target,params);
        if (keep) {
            p.pos.x=sx;
            p.pos.z=sz;
        }
        if (params.duration&&!TUNING.hud.timerSkip.includes(card.def.id)) {
            this.timers.push({id:card.def.id,left:params.duration,full:params.duration});
        }
        if (card.def.rarity==='rare'&&card.def.id!=='echo') {
            this.lastUlt=card;
        }
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

    pierceShot(dx,dz,damage,speed,ramp) {
        const g=this.g;
        const m=this.muzzle(dx,dz);
        g.pierceBullets.ramp=ramp||0;
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
        if (g.room) {
            g.room.damageProps(x,z,radius,damage);
        }
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
        g.enemyBullets.frozen=Math.max(g.enemyBullets.frozen,duration);
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

    updateSweep(s,k,dt) {
        const g=this.g;
        const p=g.player;
        if (s.type==='rain') {
            while (s.drops.length>0&&s.drops[0].t<=s.t) {
                const d=s.drops.shift();
                g.enemies.damageRadius(d.x,d.z,1.4,s.dmg);
                g.rings.spawn(d.x,d.z,1.5,'ink',0.25);
                g.decals.spawn(d.x,d.z,1.2,'ink','midGray');
                g.particles.burst(d.x,0.3,d.z,8,{speed:[2,5],up:[3,6],size:[0.08,0.16]});
                g.fx.cameraShake(0.08);
            }
            return s.drops.length===0;
        }
        if (s.type==='blade') {
            let bx;
            let bz;
            const out=k<0.5;
            if (out) {
                const f=1-Math.pow(1-k*2,2);
                bx=s.x+s.dx*s.range*f;
                bz=s.z+s.dz*s.range*f;
                s.ex=bx;
                s.ez=bz;
            }
            else {
                const f=Math.pow((k-0.5)*2,2);
                bx=s.ex+(p.pos.x-s.ex)*f;
                bz=s.ez+(p.pos.z-s.ez)*f;
            }
            const hit=out?s.hitOut:s.hitBack;
            for (const e of g.enemies.list.slice()) {
                if (e.state==='spawn'||hit.has(e.uid)) {
                    continue;
                }
                if (Math.hypot(e.pos.x-bx,e.pos.z-bz)<=this.E.bladeRadius+e.def.radius) {
                    hit.add(e.uid);
                    const dl=Math.hypot(bx-(s.px??bx),bz-(s.pz??bz))||1;
                    g.enemies.damage(e,s.dmg,(bx-(s.px??bx))/dl,(bz-(s.pz??bz))/dl);
                }
            }
            s.px=bx;
            s.pz=bz;
            const R=this.E.bladeRadius;
            g.enemyBullets.killWhere((x,z)=>(x-bx)*(x-bx)+(z-bz)*(z-bz)<R*R,(x,z)=>g.particles.burst(x,1,z,2,{color:'farGray',speed:[1,3],up:[1,2]}));
            const m=this.bladeMesh;
            m.visible=k<1;
            m.position.set(bx,1.0,bz);
            m.rotation.y+=dt*22;
            if (Math.random()<0.5) {
                g.particles.burst(bx,1,bz,1,{color:'farGray',speed:[0.5,1.5],up:[0.5,1.5],size:[0.06,0.1],life:[0.2,0.35]});
            }
            if (k>=1) {
                m.visible=false;
                return true;
            }
            return false;
        }
        if (s.type==='field') {
            s.tick-=dt;
            if (s.tick<=0) {
                s.tick=this.E.fieldTick;
                for (const e of g.enemies.list.slice()) {
                    if (e.state!=='spawn'&&!e.def.flying&&Math.hypot(e.pos.x-s.x,e.pos.z-s.z)<=s.r+e.def.radius) {
                        g.enemies.damage(e,s.dps*this.E.fieldTick,0,0,true);
                    }
                }
                const a=Math.random()*Math.PI*2;
                const rr=Math.sqrt(Math.random())*s.r;
                g.particles.burst(s.x+Math.cos(a)*rr,0.2,s.z+Math.sin(a)*rr,4,{color:'ink',speed:[0.3,1],up:[3,6],size:[0.06,0.12],life:[0.2,0.4]});
            }
            s.ring-=dt;
            if (s.ring<=0) {
                s.ring=0.5;
                g.rings.spawn(s.x,s.z,s.r,'ink',0.3);
            }
            return k>=1;
        }
        if (s.type==='cluster') {
            while (s.drops.length>0&&s.drops[0].t<=s.t) {
                const d=s.drops.shift();
                g.enemies.damageRadius(d.x,d.z,s.r,s.dmg);
                if (g.room) {
                    g.room.damageProps(d.x,d.z,s.r,s.dmg);
                }
                g.rings.spawn(d.x,d.z,s.r,'ink',0.25);
                g.decals.spawn(d.x,d.z,s.r*1.2,'ink','midGray');
                g.particles.burst(d.x,0.3,d.z,10,{speed:[2,6],up:[3,7],size:[0.08,0.16]});
                g.fx.cameraShake(0.1);
            }
            return s.drops.length===0;
        }
        if (s.type==='storm') {
            s.acc+=dt;
            while (s.acc>=s.every) {
                s.acc-=s.every;
                const pool=g.enemies.list.filter(e=>e.state!=='spawn');
                if (pool.length===0) {
                    continue;
                }
                const e=pool[Math.floor(Math.random()*pool.length)];
                const ex=e.pos.x;
                const ez=e.pos.z;
                this.link(ex+(Math.random()-0.5)*3,ez-3.5,ex,ez);
                g.enemies.damage(e,s.dmg,0,1,false);
                g.rings.spawn(ex,ez,1.3,'red',0.3);
                g.particles.burst(ex,1.5,ez,10,{color:'red',speed:[2,5],up:[2,6],size:[0.08,0.16]});
                g.fx.cameraShake(0.12);
            }
            return k>=1;
        }
        if (s.type==='reflect') {
            if (p.reflectT<=0) {
                return true;
            }
            s.ring-=dt;
            if (s.ring<=0) {
                s.ring=0.35;
                g.rings.spawn(p.pos.x,p.pos.z,1.9,'farGray',0.35);
            }
            const px=p.pos.x;
            const pz=p.pos.z;
            g.enemyBullets.killWhere((x,z)=>(x-px)*(x-px)+(z-pz)*(z-pz)<3.6,(x,z)=>{
                const e=g.enemies.nearest(x,z,20);
                let dx=x-px;
                let dz=z-pz;
                if (e) {
                    dx=e.pos.x-x;
                    dz=e.pos.z-z;
                }
                const l=Math.hypot(dx,dz)||1;
                g.playerBullets.spawn(x,z,dx/l,dz/l,this.T.weapon.bulletSpeed,this.T.weapon.damage*1.5,1.2);
                g.particles.burst(x,1.0,z,2,{color:'farGray',speed:[1,3],up:[1,2]});
            });
            return false;
        }
        if (s.type==='barrage') {
            s.acc+=dt;
            while (s.acc>=s.every&&s.left>0) {
                s.acc-=s.every;
                s.left--;
                const a=Math.random()*Math.PI*2;
                g.homingBullets.spawn(p.pos.x+Math.cos(a)*0.7,p.pos.z+Math.sin(a)*0.7,Math.cos(a),Math.sin(a),this.E.homingSpeed,s.dmg,this.E.homingLife);
                g.muzzle.show(p.pos.x+Math.cos(a)*0.7,this.T.weapon.height,p.pos.z+Math.sin(a)*0.7,'ink',0.6);
            }
            return s.left<=0;
        }
        if (s.type==='wave') {
            const front=s.len*Math.min(1,s.t/s.dur);
            const cx=s.x+s.dx*front;
            const cz=s.z+s.dz*front;
            const px=-s.dz;
            const pz=s.dx;
            this.setLine(this.waveLine,cx-px*s.w/2,cz-pz*s.w/2,cx+px*s.w/2,cz+pz*s.w/2,1.2,0.1);
            for (const e of g.enemies.list.slice()) {
                if (s.hit.has(e.uid)||e.state==='spawn') {
                    continue;
                }
                const rx=e.pos.x-s.x;
                const rz=e.pos.z-s.z;
                const along=rx*s.dx+rz*s.dz;
                const lat=Math.abs(rx*px+rz*pz);
                if (along<=front&&along>=-1&&lat<=s.w/2+e.def.radius) {
                    s.hit.add(e.uid);
                    g.enemies.damage(e,s.dmg,s.dx,s.dz);
                    if (e.alive&&!e.def.boss) {
                        e.vel.x+=s.dx*10;
                        e.vel.z+=s.dz*10;
                    }
                }
            }
            g.enemyBullets.killWhere((x,z)=>{
                const rx=x-s.x;
                const rz=z-s.z;
                const along=rx*s.dx+rz*s.dz;
                return along<=front&&along>=-1&&Math.abs(rx*px+rz*pz)<=s.w/2;
            },null);
            if (Math.random()<0.9) {
                const o=(Math.random()-0.5)*s.w;
                g.particles.burst(cx+px*o,0.4,cz+pz*o,2,{dirX:s.dx,dirZ:s.dz,cone:0.5,speed:[4,8],up:[3,6],size:[0.1,0.2]});
            }
            if (s.t>=s.dur) {
                this.waveLine.visible=false;
                return true;
            }
            return false;
        }
        if (s.type==='beam') {
            const f=1-k;
            this.beamLine.scale.z=s.w*(0.3+0.7*f)*1.3;
            if (k>=1) {
                this.beamLine.visible=false;
                return true;
            }
            return false;
        }
        if (s.type==='hole') {
            for (const e of g.enemies.list) {
                if (e.def.boss||e.state==='spawn') {
                    continue;
                }
                const dx=s.x-e.pos.x;
                const dz=s.z-e.pos.z;
                const d=Math.hypot(dx,dz);
                if (d<s.r&&d>0.3) {
                    const pull=Math.min(d,(6+(s.r-d))*dt);
                    e.pos.x+=dx/d*pull;
                    e.pos.z+=dz/d*pull;
                    e.vel.multiplyScalar(0.8);
                }
            }
            g.enemyBullets.killWhere((x,z)=>(x-s.x)*(x-s.x)+(z-s.z)*(z-s.z)<4,null);
            s.ring-=dt;
            if (s.ring<=0) {
                s.ring=0.2;
                g.rings.spawn(s.x,s.z,1.5+Math.random()*0.8,'ink',0.3);
            }
            for (let q=0;q<2;q++) {
                const a=Math.random()*Math.PI*2;
                const rr=s.r*(0.5+Math.random()*0.5);
                g.particles.burst(s.x+Math.cos(a)*rr,0.3,s.z+Math.sin(a)*rr,1,{dirX:-Math.cos(a),dirZ:-Math.sin(a),cone:0.3,speed:[rr*1.5,rr*2],up:[0.5,1.5],size:[0.08,0.14],life:[0.4,0.5]});
            }
            if (s.t>=s.dur) {
                g.enemies.damageRadius(s.x,s.z,3.5,s.dmg);
                g.fx.hitStop(120,true);
                g.fx.cameraShake(0.8);
                g.fx.fovPunch(2.5);
                g.fx.invertFrame(2);
                g.rings.spawn(s.x,s.z,4.5,'ink',0.45);
                g.decals.spawn(s.x,s.z,5,'ink','midGray');
                g.particles.burst(s.x,0.5,s.z,40,{speed:[4,12],up:[3,10],size:[0.12,0.3],life:[0.5,1]});
                return true;
            }
            return false;
        }
        return null;
    }

    paperBlade(dx,dz,damage,range) {
        const p=this.g.player;
        this.muzzle(dx,dz);
        this.sweeps.push({type:'blade',t:0,dur:this.E.bladeTime*(range/8),x:p.pos.x,z:p.pos.z,dx,dz,range,dmg:damage,ex:p.pos.x,ez:p.pos.z,hitOut:new Set(),hitBack:new Set()});
        this.g.fx.fovPunch(0.8);
    }

    blot(radius,per,max) {
        const g=this.g;
        const p=g.player;
        const px=p.pos.x;
        const pz=p.pos.z;
        let n=0;
        g.enemyBullets.killWhere((x,z)=>(x-px)*(x-px)+(z-pz)*(z-pz)<radius*radius,(x,z)=>{
            n++;
            const l=Math.hypot(px-x,pz-z)||1;
            g.particles.burst(x,1,z,2,{dirX:(px-x)/l,dirZ:(pz-z)/l,cone:0.3,speed:[4,8],up:[0,1],size:[0.06,0.1],life:[0.2,0.3]});
        });
        const gain=Math.min(max,Math.floor(n/per));
        if (gain>0) {
            g.ink.add(gain);
        }
        g.rings.spawn(px,pz,radius,'ink',0.35);
        g.fx.fovPunch(1.0);
        p.sqv+=2;
    }

    inkField(x,z,radius,duration,dps) {
        const g=this.g;
        this.sweeps.push({type:'field',t:0,dur:duration,x,z,r:radius,dps,tick:0,ring:0});
        g.decals.spawn(x,z,radius*2.1,'ink','midGray');
        g.particles.burst(x,0.3,z,16,{speed:[1,radius*1.6],up:[2,5],size:[0.08,0.14]});
        g.fx.cameraShake(0.12);
    }

    clusterBomb(x,z,radius,damage,count) {
        const g=this.g;
        const p=g.player;
        const dx=x-p.pos.x;
        const dz=z-p.pos.z;
        const l=Math.hypot(dx,dz)||1;
        const m=this.muzzle(dx/l,dz/l);
        const arc=Math.min(this.E.bombArc,l*0.4+0.8);
        g.lobs.launch(m.x,m.z,x,z,this.E.bombFlight,arc,(lx,lz)=>{
            this.explode(lx,lz,radius,damage);
            const drops=[];
            const a0=Math.random()*Math.PI*2;
            for (let i=0;i<count;i++) {
                const a=a0+i/count*Math.PI*2;
                drops.push({x:lx+Math.cos(a)*radius*1.1,z:lz+Math.sin(a)*radius*1.1,t:0.15+i*0.07});
            }
            this.sweeps.push({type:'cluster',t:0,dur:1,drops,r:radius*0.6,dmg:damage*0.6});
        });
    }

    haste(duration,mult) {
        const g=this.g;
        const p=g.player;
        p.hasteT=duration;
        p.hasteMult=mult;
        p.sqv+=2;
        g.rings.spawn(p.pos.x,p.pos.z,1.6,'ink',0.3);
        g.particles.burst(p.pos.x,0.4,p.pos.z,14,{speed:[3,6],up:[0.5,2],size:[0.06,0.12]});
        g.fx.fovPunch(1.2);
    }

    echo(target) {
        const g=this.g;
        const u=this.lastUlt;
        g.fx.flash('paper',0.2,0.35);
        if (!u) {
            g.ink.add(this.E.echoFallbackInk);
            return;
        }
        g.rings.spawn(g.player.pos.x,g.player.pos.z,2,'red',0.35);
        const params=cardParams(u);
        u.def.effect(this,target.echo||target,params);
        if (params.duration&&!this.T.hud.timerSkip.includes(u.def.id)) {
            this.timers.push({id:u.def.id,left:params.duration,full:params.duration});
        }
    }

    inkStorm(duration,damage,every) {
        const g=this.g;
        this.sweeps.push({type:'storm',t:0,dur:duration,acc:every*0.6,every,dmg:damage});
        g.fx.flash('ink',0.25,0.3);
        g.fx.cameraShake(0.3);
    }

    heal(n) {
        const g=this.g;
        const p=g.player;
        p.hp=Math.min(this.T.player.maxHp,p.hp+n);
        p.sqv+=2;
        g.fx.flash('paper',0.2,0.3);
        g.particles.burst(p.pos.x,1.2,p.pos.z,14,{color:'paper',speed:[1,3],up:[3,6],size:[0.1,0.18]});
        g.rings.spawn(p.pos.x,p.pos.z,1.6,'farGray',0.4);
    }

    gainInk(n) {
        const g=this.g;
        g.ink.add(n);
        g.particles.burst(g.player.pos.x,1.2,g.player.pos.z,12,{speed:[1,3],up:[3,6],size:[0.1,0.18]});
    }

    shockwave(radius,damage,push) {
        const g=this.g;
        const p=g.player;
        for (const e of g.enemies.list.slice()) {
            if (e.state==='spawn') {
                continue;
            }
            const dx=e.pos.x-p.pos.x;
            const dz=e.pos.z-p.pos.z;
            const d=Math.hypot(dx,dz)||1;
            if (d<=radius+e.def.radius) {
                g.enemies.damage(e,damage,dx/d,dz/d);
                if (e.alive&&!e.def.boss) {
                    e.vel.x+=dx/d*push;
                    e.vel.z+=dz/d*push;
                }
            }
        }
        g.enemyBullets.killWhere((x,z)=>Math.hypot(x-p.pos.x,z-p.pos.z)<radius*0.9,(x,z)=>g.particles.burst(x,1,z,1,{color:'farGray',speed:[1,2],up:[1,2]}));
        g.rings.spawn(p.pos.x,p.pos.z,radius,'ink',0.3);
        g.fx.cameraShake(0.35);
        g.fx.fovPunch(1.5);
        p.sqv+=3;
    }

    mark(x,z,radius,duration,mult) {
        const g=this.g;
        const e=g.enemies.nearest(x,z,radius);
        if (!e) {
            g.particles.burst(x,0.5,z,6,{speed:[1,3],up:[1,3]});
            return;
        }
        e.vulnT=duration;
        e.vulnMult=mult;
        g.rings.spawn(e.pos.x,e.pos.z,e.def.radius+0.8,'ink',0.3);
        g.particles.burst(e.pos.x,e.def.height,e.pos.z,8,{speed:[1,3],up:[2,4]});
    }

    placeMine(x,z,radius,damage) {
        const g=this.g;
        let m=this.mines.find(q=>!q.active);
        if (!m) {
            m=this.mines[0];
            for (const q of this.mines) {
                if (q.t>m.t) {
                    m=q;
                }
            }
        }
        m.active=true;
        m.x=x;
        m.z=z;
        m.r=radius;
        m.dmg=damage;
        m.t=0;
        m.mesh.visible=true;
        m.mesh.position.set(x,0,z);
        g.particles.burst(x,0.3,z,6,{speed:[1,3],up:[1,3]});
    }

    dualWield(duration) {
        const g=this.g;
        g.player.dualT=duration;
        g.player.sqv+=2;
        g.fx.fovPunch(1.0);
        g.rings.spawn(g.player.pos.x,g.player.pos.z,1.6,'ink',0.3);
    }

    pin(x,z,radius,duration) {
        const g=this.g;
        for (const e of g.enemies.list) {
            if (e.state!=='spawn'&&Math.hypot(e.pos.x-x,e.pos.z-z)<=radius+e.def.radius) {
                e.stun(duration);
                g.particles.burst(e.pos.x,0.2,e.pos.z,6,{color:'nearGray',speed:[1,3],up:[1,3]});
            }
        }
        g.rings.spawn(x,z,radius,'ink',0.3);
        g.fx.cameraShake(0.15);
    }

    chain(jumps,damage,range) {
        const g=this.g;
        const p=g.player;
        let fx=p.pos.x;
        let fz=p.pos.z;
        let e=g.enemies.nearest(fx,fz,range*1.6);
        const hit=new Set();
        for (let i=0;i<jumps&&e;i++) {
            hit.add(e.uid);
            this.link(fx,fz,e.pos.x,e.pos.z);
            const ex=e.pos.x;
            const ez=e.pos.z;
            const dl=Math.hypot(ex-fx,ez-fz)||1;
            g.enemies.damage(e,damage,(ex-fx)/dl,(ez-fz)/dl);
            g.particles.burst(ex,1,ez,5,{speed:[2,4],up:[1,3]});
            fx=ex;
            fz=ez;
            let best=null;
            let bd=range;
            for (const o of g.enemies.list) {
                if (hit.has(o.uid)||o.state==='spawn') {
                    continue;
                }
                const d=Math.hypot(o.pos.x-fx,o.pos.z-fz);
                if (d<bd) {
                    bd=d;
                    best=o;
                }
            }
            e=best;
        }
        g.fx.cameraShake(0.2);
    }

    inkRain(x,z,radius,count,damage) {
        const drops=[];
        for (let i=0;i<count;i++) {
            const a=Math.random()*Math.PI*2;
            const r=Math.sqrt(Math.random())*radius;
            drops.push({t:0.15+i*0.12,x:x+Math.cos(a)*r,z:z+Math.sin(a)*r});
        }
        this.sweeps.push({type:'rain',t:0,dur:10,drops,dmg:damage});
        this.g.rings.spawn(x,z,radius,'ink',0.4);
    }

    reflect(duration) {
        const g=this.g;
        g.player.reflectT=duration;
        this.sweeps.push({type:'reflect',t:0,dur:99,ring:0});
    }

    tsunami(dx,dz,damage,width,length) {
        const g=this.g;
        const p=g.player;
        p.faceDir(dx,dz);
        this.sweeps.push({type:'wave',t:0,dur:0.7,x:p.pos.x-dx,z:p.pos.z-dz,dx,dz,w:width,len:length,dmg:damage,hit:new Set()});
        g.fx.cameraShake(0.5);
        g.fx.fovPunch(2.0);
    }

    blackHole(x,z,radius,duration,damage) {
        this.sweeps.push({type:'hole',t:0,dur:duration,x,z,r:radius,dmg:damage,ring:0});
        this.g.fx.cameraShake(0.2);
    }

    barrage(duration,damage,count) {
        this.sweeps.push({type:'barrage',t:0,dur:duration,acc:0,every:duration/count,left:count,dmg:damage});
        this.g.fx.fovPunch(1.5);
    }

    giantPen(dx,dz,damage,width) {
        const g=this.g;
        const p=g.player;
        p.faceDir(dx,dz);
        p.recoil();
        const L=30;
        const x0=p.pos.x+dx*0.8;
        const z0=p.pos.z+dz*0.8;
        this.setLine(this.beamLine,x0,z0,x0+dx*L,z0+dz*L,width*1.3,0.09);
        this.sweeps.push({type:'beam',t:0,dur:0.6,w:width});
        const px=-dz;
        const pz=dx;
        for (const e of g.enemies.list.slice()) {
            if (e.state==='spawn') {
                continue;
            }
            const rx=e.pos.x-x0;
            const rz=e.pos.z-z0;
            const along=rx*dx+rz*dz;
            if (along>=-0.5&&along<=L&&Math.abs(rx*px+rz*pz)<=width/2+e.def.radius) {
                g.enemies.damage(e,damage,dx,dz);
            }
        }
        g.enemyBullets.killWhere((x,z)=>{
            const rx=x-x0;
            const rz=z-z0;
            const along=rx*dx+rz*dz;
            return along>=0&&along<=L&&Math.abs(rx*px+rz*pz)<=width;
        },null);
        g.fx.hitStop(110,true);
        g.fx.cameraShake(0.7);
        g.fx.fovPunch(2.4);
        g.muzzle.show(x0,this.T.weapon.height,z0,'ink',2.4);
        for (let i=0;i<10;i++) {
            g.particles.burst(x0+dx*i*2.5,0.4,z0+dz*i*2.5,3,{speed:[2,5],up:[2,5],size:[0.1,0.2]});
        }
    }

    freezeAll(duration) {
        const g=this.g;
        for (const e of g.enemies.list) {
            e.stun(duration,true);
        }
        g.enemyBullets.frozen=Math.max(g.enemyBullets.frozen,duration);
        g.fx.hitStop(80,true);
        g.fx.fovPunch(2.2);
        g.fx.cameraShake(0.3);
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
