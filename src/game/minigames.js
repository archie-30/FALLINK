import*as THREE from 'three';
import {toonMaterial,stampMaterial,iconMaterial} from '../render/materials.js';
import {makeBox} from '../core/collision.js';
import {MINIGAMES} from '../data/minigames.js';
import {TUNING} from '../data/tuning.js';
import {EASE} from '../core/easing.js';
import {RNG} from '../core/rng.js';
import {t} from '../data/strings.js';
import {PALETTE} from '../data/palette.js';

const TONES={
    cover:{light:'farGray',mid:'midGray',dark:'nearGray'},
    light:{light:'paper',mid:'farGray',dark:'midGray'},
    dark:{light:'midGray',mid:'nearGray',dark:'ink'},
    ink:{light:'nearGray',mid:'ink',dark:'ink'},
    accent:{light:'red',mid:'red',dark:'darkRed'},
    marker:{light:'marker',mid:'marker',dark:'midGray'}
};

const SHAPES=['ball','box','cone','cyl'];
const SHAPE_TONES=['ink','accent','light'];

const geoCache=new Map();
const stampCache=new Map();

function geo(key,make) {
    if (!geoCache.has(key)) {
        geoCache.set(key,make());
    }
    return geoCache.get(key);
}

function mat(tone) {
    return toonMaterial({...TONES[tone],calm:true});
}

function stampTex(text) {
    if (!stampCache.has(text)) {
        const c=document.createElement('canvas');
        c.width=128;
        c.height=128;
        const x=c.getContext('2d');
        x.fillStyle='#000';
        x.fillRect(0,0,128,128);
        x.fillStyle='#fff';
        const font=sz=>'bold '+sz+'px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
        x.font=font(96);
        const tw=x.measureText(text).width;
        const sz=tw>112?Math.floor(96*112/tw):96;
        x.font=font(sz);
        x.textAlign='center';
        x.textBaseline='middle';
        x.fillText(text,64,68);
        const tex=new THREE.CanvasTexture(c);
        tex.colorSpace=THREE.NoColorSpace;
        stampCache.set(text,tex);
    }
    return stampCache.get(text);
}

class Kit {
    constructor(mg,id,room,act,flip) {
        this.mg=mg;
        this.id=id;
        this.room=room;
        this.act=act;
        this.flip=flip;
        this.P=MINIGAMES.games[id];
        this.rng=new RNG(Math.floor(Math.random()*1e9));
        this.group=new THREE.Group();
        room.group.add(this.group);
        this.t=0;
        this.limit=0;
        this.left=0;
        this.ended=false;
        this.endT=0;
        this.pieces=[];
    }

    a(v) {
        return Array.isArray(v)?v[Math.min(this.act,v.length-1)]:v;
    }

    r() {
        return this.rng.next();
    }

    range(a,b) {
        return a+this.r()*(b-a);
    }

    int(n) {
        return Math.floor(this.r()*n);
    }

    shuffle(list) {
        for (let i=list.length-1;i>0;i--) {
            const j=this.int(i+1);
            [list[i],list[j]]=[list[j],list[i]];
        }
        return list;
    }

    add(o,parent=this.group) {
        parent.add(o);
        return o;
    }

    box(w,h,d,tone,x=0,y=0,z=0,parent) {
        const m=new THREE.Mesh(geo('b|'+w+'|'+h+'|'+d,()=>new THREE.BoxGeometry(w,h,d)),mat(tone));
        m.position.set(x,y,z);
        return this.add(m,parent);
    }

    cyl(rt,rb,h,tone,x=0,y=0,z=0,parent,seg=16) {
        const m=new THREE.Mesh(geo('c|'+rt+'|'+rb+'|'+h+'|'+seg,()=>new THREE.CylinderGeometry(rt,rb,h,seg)),mat(tone));
        m.position.set(x,y,z);
        return this.add(m,parent);
    }

    ball(r,tone,x=0,y=0,z=0,parent) {
        const m=new THREE.Mesh(geo('s|'+r,()=>new THREE.SphereGeometry(r,14,10)),mat(tone));
        m.position.set(x,y,z);
        return this.add(m,parent);
    }

    cone(r,h,tone,x=0,y=0,z=0,parent,seg=12) {
        const m=new THREE.Mesh(geo('k|'+r+'|'+h+'|'+seg,()=>new THREE.ConeGeometry(r,h,seg)),mat(tone));
        m.position.set(x,y,z);
        return this.add(m,parent);
    }

    flat(w,d,tone,x,z,y=0.03,parent) {
        return this.box(w,0.06,d,tone,x,y,z,parent);
    }

    disc(r,tone,x,z,y=0.04,parent) {
        return this.cyl(r,r,0.05,tone,x,y,z,parent,24);
    }

    ring(r,tone,x,z,parent) {
        const m=new THREE.Mesh(geo('t|'+r,()=>new THREE.TorusGeometry(r,0.07,4,40)),mat(tone));
        m.rotation.x=-Math.PI/2;
        m.position.set(x,0.06,z);
        return this.add(m,parent);
    }

    stamp(text,size,color,x,z,y=0.07,parent) {
        const m=new THREE.Mesh(geo('p|'+size,()=>new THREE.PlaneGeometry(size,size).rotateX(-Math.PI/2)),stampMaterial(stampTex(text),color));
        m.position.set(x,y,z);
        return this.add(m,parent);
    }

    shape(kind,tone,x,z,s=1,parent) {
        const g=new THREE.Group();
        g.position.set(x,0,z);
        if (kind==='ball') {
            this.ball(0.42*s,tone,0,0.45*s,0,g);
        }
        else if (kind==='box') {
            this.box(0.7*s,0.7*s,0.7*s,tone,0,0.36*s,0,g);
        }
        else if (kind==='cone') {
            this.cone(0.45*s,0.95*s,tone,0,0.48*s,0,g);
        }
        else {
            this.cyl(0.36*s,0.36*s,0.8*s,tone,0,0.4*s,0,g);
        }
        return this.add(g,parent);
    }

    pad(x,z,r,tone='dark',y=0.06) {
        const ring=this.ring(r,tone,x,z);
        ring.position.y=y;
        const fill=this.disc(r*0.92,'marker',x,z,y-0.02);
        fill.scale.set(0.001,1,0.001);
        return {x,z,r,k:0,lock:false,ring,fill,tone};
    }

    dwell(p,pl,dt,need) {
        const inside=this.inside(pl,p.x,p.z,p.r);
        if (!inside) {
            p.lock=false;
        }
        if (inside&&!p.lock) {
            p.k+=dt/need;
        }
        else {
            p.k=Math.max(0,p.k-dt*3);
        }
        const s=Math.max(0.001,Math.min(1,p.k));
        p.fill.scale.set(s,1,s);
        if (p.k>=1) {
            p.k=0;
            p.lock=true;
            p.fill.scale.set(0.001,1,0.001);
            return true;
        }
        return false;
    }

    inside(pl,x,z,r) {
        return Math.hypot(pl.pos.x-x,pl.pos.z-z)<r;
    }

    solid(cols) {
        const piece=this.room.addPiece('minigame',new THREE.Group(),cols,{x:0,z:0,radius:0,erasable:false});
        this.pieces.push(piece);
        return piece;
    }

    spot(minGap,avoid=[],margin=1.2) {
        const A=MINIGAMES.area;
        for (let k=0;k<60;k++) {
            const x=this.range(A.minX+margin,A.maxX-margin);
            const z=this.range(A.minZ+margin,A.maxZ-margin);
            if (avoid.every(q=>Math.hypot(q[0]-x,q[1]-z)>=(q[2]??minGap))) {
                return [x,z];
            }
        }
        return [this.range(-6,6),this.range(-4,4)];
    }

    clampArea(p,m) {
        const A=MINIGAMES.area;
        p.x=Math.max(A.minX+m,Math.min(A.maxX-m,p.x));
        p.z=Math.max(A.minZ+m,Math.min(A.maxZ-m,p.z));
    }

    timer(s) {
        this.limit=s;
        this.left=s;
    }

    burst(x,z,color='ink',n=12,y=0.6) {
        this.mg.api.burst(x,y,z,n,color);
    }

    sound(name,pitch=1) {
        this.mg.api.sound(name,pitch);
    }

    say(x,z,key,params={}) {
        this.mg.api.say(x,z,key,params);
    }

    place(x,z) {
        this.mg.api.place(x,z);
    }

    talk(text,dur) {
        this.mg.api.talk(text,dur);
    }

    shake(a) {
        this.mg.api.shake(a);
    }

    win() {
        this.end(true);
    }

    lose() {
        this.end(false);
    }

    end(ok) {
        if (this.ended) {
            return;
        }
        this.ended=true;
        this.ok=ok;
        this.endT=TUNING.minigame.endDelay;
        this.sound(ok?'clear':'hurt',ok?1.2:0.8);
    }
}

const GAMES={
    bells:{
        setup(g) {
            const P=g.P;
            g.bells=P.xs.map((x,i)=>{
                const root=new THREE.Group();
                root.position.set(x,0,P.z);
                g.add(root);
                g.cyl(0.55,0.62,0.16,'dark',0,0.08,0,root);
                const swing=new THREE.Group();
                swing.position.y=1.5;
                root.add(swing);
                const dome=new THREE.Mesh(geo('bell',()=>new THREE.CylinderGeometry(0.22,0.6,0.9,16,1,true)),mat('light'));
                dome.position.y=-0.55;
                swing.add(dome);
                g.ball(0.24,'light',0,-0.12,0,swing);
                const clap=new THREE.Group();
                clap.position.y=1.5;
                root.add(clap);
                g.ball(0.13,'accent',0,-1.0,0,clap);
                g.cyl(0.05,0.05,1.5,'dark',0,0.75,-0.45,root,6);
                g.box(0.9,0.08,0.08,'dark',0,1.52,-0.45,root);
                const wave=g.ring(0.9,'accent',x,P.z);
                wave.visible=false;
                const ring=g.ring(P.reach,'cover',x,P.z);
                return {x,z:P.z,root,swing,clap,dome,ring,wave,lit:0,i,ang:0,av:0,cang:0,cav:0,side:1};
            });
            g.solid(g.bells.map(b=>makeBox(b.x,b.z,0.55,0.55,0)));
        },
        begin(g) {
            const P=g.P;
            g.place(0,MINIGAMES.start[1]);
            const len=P.len[0]+g.int(P.len[1]-P.len[0]+1);
            g.seq=[];
            for (let k=0;k<len;k++) {
                g.seq.push(g.int(P.xs.length));
            }
            g.phase='show';
            g.st=-P.lead;
            g.shown=0;
            g.step=0;
        },
        flash(g,i,input) {
            const b=g.bells[i];
            b.lit=1;
            b.side=-b.side;
            b.av+=TUNING.minigame.bell.impulse*b.side;
            b.wave.visible=true;
            g.sound('bell',TUNING.npc.bellPitch[i%TUNING.npc.bellPitch.length]);
            g.burst(b.x,b.z,input?'red':'ink',18,1.4);
            g.burst(b.x,b.z,'marker',8,0.3);
            g.mg.api.shake(TUNING.minigame.bellShake);
        },
        idle(g,dt) {
            const B=TUNING.minigame.bell;
            for (const b of g.bells) {
                b.lit=Math.max(0,b.lit-dt*B.decay);
                const k=1-b.lit;
                b.av+=(-B.k*b.ang-B.damp*b.av)*dt;
                b.ang+=b.av*dt;
                b.cav+=(B.clapK*(b.ang-b.cang)-B.clapDamp*b.cav)*dt;
                b.cang+=b.cav*dt;
                b.swing.rotation.z=b.ang;
                b.clap.rotation.z=b.cang;
                const sq=1+Math.sin(k*Math.PI*6)*b.lit*B.squash;
                b.dome.scale.set(1/sq,sq,1/sq);
                const hot=b.lit>1-B.flash;
                if (hot!==b.hot) {
                    b.hot=hot;
                    b.dome.material=mat(hot?'marker':'light');
                }
                b.wave.scale.setScalar(1+(1-Math.pow(b.lit,2))*B.wave);
                b.wave.visible=b.lit>0.05;
            }
        },
        near(g,pl) {
            let best=null;
            let bd=g.P.reach;
            for (const b of g.bells) {
                const d=Math.hypot(pl.pos.x-b.x,pl.pos.z-b.z);
                if (d<bd) {
                    bd=d;
                    best=b;
                }
            }
            return best;
        },
        canInteract(g,pl) {
            return g.phase==='input'&&!!this.near(g,pl);
        },
        prompt(g,pl) {
            const b=this.canInteract(g,pl)?this.near(g,pl):null;
            return b?{x:b.x,y:2.6,z:b.z,key:'mg.bells.ring'}:null;
        },
        interact(g,pl) {
            const b=this.near(g,pl);
            this.flash(g,b.i,true);
            if (g.seq[g.step]!==b.i) {
                g.lose();
                return;
            }
            g.step++;
            if (g.step>=g.seq.length) {
                g.win();
            }
        },
        tick(g,dt) {
            const P=g.P;
            if (g.phase!=='show') {
                return;
            }
            g.st+=dt;
            while (g.st>=0&&g.shown<=g.st/P.step&&g.shown<g.seq.length) {
                this.flash(g,g.seq[g.shown],false);
                g.shown++;
            }
            if (g.st>=g.seq.length*P.step) {
                g.phase='input';
            }
        },
        info(g) {
            return g.phase==='show'?{key:'mg.bells.watch'}:{key:'mg.bells.info',params:{n:g.step,total:g.seq.length}};
        }
    },
    range:{
        setup(g) {
            g.stand=g.flat(1.4,0.5,'dark',0,MINIGAMES.start[1]+1.2);
        },
        begin(g) {
            const P=g.P;
            g.place(0,MINIGAMES.start[1]);
            const used=[[0,MINIGAMES.start[1],3.5]];
            g.total=0;
            for (let i=0;i<P.count;i++) {
                const p=g.spot(P.minGap,used,1.6);
                used.push(p);
                g.room.addTarget(p[0],p[1]);
                g.burst(p[0],p[1],'farGray',8,1.2);
                g.total++;
            }
            g.hits=0;
            g.sound('page',1.2);
            g.mg.api.arm(true);
            g.timer(g.a(P.time));
        },
        hit(g) {
            g.hits++;
            if (g.hits>=g.total) {
                g.win();
            }
        },
        teardown(g) {
            g.mg.api.arm(false);
            for (const pc of g.room.pieces.slice()) {
                if (pc.kind==='target') {
                    g.burst(pc.x,pc.z,'farGray',8,1.2);
                    g.room.removePiece(pc);
                }
            }
        },
        info(g) {
            return {key:'mg.range.info',params:{n:g.total-g.hits,total:g.total}};
        }
    },
    trace:{
        setup(g) {
            const P=g.P;
            const n=g.a(P.points);
            const dir=g.r()<0.5?-1:1;
            g.pts=[];
            for (let i=0;i<n;i++) {
                const x=dir*(-P.xRange+2*P.xRange*i/(n-1));
                const z=(i%2===0?1:-1)*g.range(1.2,P.zRange);
                g.pts.push([x,z]);
            }
            g.segs=[];
            g.marks=[];
            let s0=0;
            for (let i=0;i<n-1;i++) {
                const [ax,az]=g.pts[i];
                const [bx,bz]=g.pts[i+1];
                const len=Math.hypot(bx-ax,bz-az);
                g.segs.push({ax,az,bx,bz,len,s0});
                const cnt=Math.floor(len/P.mark);
                for (let k=0;k<cnt;k++) {
                    const f=(k+0.5)/cnt;
                    const m=g.flat(0.34,0.12,'dark',ax+(bx-ax)*f,az+(bz-az)*f);
                    m.rotation.y=-Math.atan2(bz-az,bx-ax);
                    g.marks.push({m,s:s0+len*f});
                }
                s0+=len;
            }
            g.total=s0;
            g.disc(0.8,'marker',g.pts[0][0],g.pts[0][1]);
            const e=g.pts[n-1];
            g.disc(0.8,'accent',e[0],e[1]);
            g.stamp('★',1.2,'paper',e[0],e[1]);
        },
        begin(g) {
            g.place(g.pts[0][0],g.pts[0][1]);
            g.prog=0;
            g.off=0;
            g.timer(g.a(g.P.time));
        },
        near(g,x,z) {
            let best=1e9;
            let bs=0;
            for (const q of g.segs) {
                const dx=q.bx-q.ax;
                const dz=q.bz-q.az;
                const f=Math.max(0,Math.min(1,((x-q.ax)*dx+(z-q.az)*dz)/(q.len*q.len)));
                const d=Math.hypot(q.ax+dx*f-x,q.az+dz*f-z);
                if (d<best) {
                    best=d;
                    bs=q.s0+q.len*f;
                }
            }
            return [best,bs];
        },
        tick(g,dt,pl) {
            const P=g.P;
            const [d,s]=this.near(g,pl.pos.x,pl.pos.z);
            if (d>P.tol) {
                g.off+=dt;
                if (g.off>P.grace) {
                    g.lose();
                    return;
                }
            }
            else {
                g.off=0;
                if (s>g.prog&&s<g.prog+2.5) {
                    g.prog=s;
                }
            }
            for (const q of g.marks) {
                if (q.s<=g.prog&&!q.done) {
                    q.done=true;
                    q.m.material=mat('accent');
                }
            }
            const e=g.pts[g.pts.length-1];
            if (g.prog>g.total-1.5&&g.inside(pl,e[0],e[1],0.9)) {
                g.win();
            }
        },
        info(g) {
            return {key:g.off>0?'mg.trace.off':'mg.trace.info',params:{n:Math.round(g.prog/g.total*100)}};
        }
    },
    push:{
        setup(g) {
            const P=g.P;
            const st=MINIGAMES.start;
            const b=g.spot(0,[[st[0],st[1],3.5]],P.margin+1);
            const goal=g.spot(0,[[b[0],b[1],P.minDist],[st[0],st[1],2.5]],P.margin+0.6);
            g.goal={x:goal[0],z:goal[1]};
            g.ring(P.goalR,'accent',goal[0],goal[1]);
            g.disc(P.goalR*0.9,'marker',goal[0],goal[1],0.03);
            g.stamp('★',1,'red',goal[0],goal[1],0.08);
            const root=new THREE.Group();
            root.position.set(b[0],0,b[1]);
            g.add(root);
            g.box(P.size,P.size*0.75,P.size*0.75,'light',0,P.size*0.38,0,root);
            g.box(P.size*1.02,P.size*0.28,P.size*0.77,'accent',0,P.size*0.62,0,root);
            g.blk={root,x:b[0],z:b[1]};
        },
        begin(g) {
            g.place(MINIGAMES.start[0],MINIGAMES.start[1]);
            g.timer(g.a(g.P.time));
        },
        tick(g,dt,pl) {
            const P=g.P;
            const b=g.blk;
            const R=TUNING.player.radius+P.size*0.55;
            const dx=b.x-pl.pos.x;
            const dz=b.z-pl.pos.z;
            const d=Math.hypot(dx,dz);
            if (d<R&&d>0.001) {
                b.x=pl.pos.x+dx/d*R;
                b.z=pl.pos.z+dz/d*R;
                g.clampArea(b,P.size*0.5);
                b.root.rotation.y+=(dx*pl.vel.z-dz*pl.vel.x)*dt*0.02;
            }
            b.root.position.set(b.x,0,b.z);
            if (Math.hypot(b.x-g.goal.x,b.z-g.goal.z)<P.goalR*0.6) {
                g.burst(b.x,b.z,'red',16,0.8);
                g.win();
            }
        },
        info(g) {
            return {key:'mg.push.info'};
        }
    },
    pour:{
        setup(g) {
            const P=g.P;
            const z=P.z;
            g.box(P.w+0.3,P.h+0.3,0.14,'dark',0,P.h/2+0.15,z-0.05);
            g.box(P.w,P.h,0.16,'light',0,P.h/2+0.2,z);
            g.target=g.range(P.target[0],P.target[1]);
            g.tol=g.a(P.tol);
            g.box(P.w*0.9,g.tol*2*P.h,0.18,'cover',0,0.2+g.target*P.h,z+0.02);
            g.box(P.w*1.15,0.08,0.22,'accent',0,0.2+g.target*P.h,z+0.04);
            for (let k=1;k<10;k++) {
                g.box(k%5===0?0.4:0.2,0.04,0.2,'dark',-P.w/2+0.2,0.2+k/10*P.h,z+0.04);
            }
            g.col=g.box(P.w*0.6,1,0.2,'ink',0,0.2,z+0.06);
            g.col.scale.y=0.001;
            g.level=0;
            g.padP=g.pad(0,P.padZ,P.pad,'dark');
            g.stamp(t('mg.stamp.pour'),1.1,'ink',0,P.padZ,0.09);
        },
        begin(g) {
            g.place(0,MINIGAMES.start[1]);
            g.level=0;
            g.started=false;
            g.timer(20);
        },
        tick(g,dt,pl) {
            const P=g.P;
            const inside=g.inside(pl,0,P.padZ,P.pad);
            if (inside) {
                g.started=true;
                g.level+=g.a(P.rate)*dt;
                if (Math.random()<dt*20) {
                    g.burst(0,P.z+0.2,'ink',1,0.2+g.level*P.h);
                }
            }
            const h=Math.max(0.001,Math.min(1,g.level)*P.h);
            g.col.scale.y=h;
            g.col.position.y=0.2+h/2;
            if (g.level>=1) {
                g.burst(0,P.z+0.2,'ink',30,P.h);
                g.say(0,P.z,'mg.pour.over');
                g.lose();
                return;
            }
            if (g.started&&!inside) {
                if (Math.abs(g.level-g.target)<=g.tol) {
                    g.win();
                }
                else {
                    g.say(0,P.z,g.level<g.target?'mg.pour.low':'mg.pour.high');
                    g.lose();
                }
            }
        },
        info(g) {
            return {key:'mg.pour.info',params:{n:Math.round(g.level*100),target:Math.round(g.target*100)}};
        }
    },
    tiles:{
        solvable(C,R,blocked,rng) {
            const free=[];
            for (let k=0;k<C*R;k++) {
                if (!blocked.has(k)) {
                    free.push(k);
                }
            }
            const nb=k=>{
                const r=Math.floor(k/C);
                const c=k%C;
                return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([rr,cc])=>rr>=0&&cc>=0&&rr<R&&cc<C&&!blocked.has(rr*C+cc)).map(([rr,cc])=>rr*C+cc);
            };
            const edge=free.filter(k=>{
                const r=Math.floor(k/C);
                const c=k%C;
                return r===0||c===0||r===R-1||c===C-1;
            });
            let steps=0;
            const seen=new Set();
            const dfs=k=>{
                if (++steps>TUNING.minigame.tilesSearch) {
                    return false;
                }
                seen.add(k);
                if (seen.size===free.length) {
                    return true;
                }
                const opts=nb(k).filter(n=>!seen.has(n)).map(n=>[n,nb(n).filter(m=>!seen.has(m)).length+rng()*0.5]).sort((x,y)=>x[1]-y[1]);
                for (const [n] of opts) {
                    if (dfs(n)) {
                        return true;
                    }
                }
                seen.delete(k);
                return false;
            };
            for (const st of edge) {
                steps=0;
                seen.clear();
                if (dfs(st)) {
                    return true;
                }
            }
            return false;
        },
        setup(g) {
            const P=g.P;
            g.cols=g.a(P.cols);
            g.rows=g.a(P.rows);
            const s=P.size;
            g.x0=-g.cols*s/2;
            g.z0=-0.6-g.rows*s/2;
            let blocked=new Set();
            for (let n=g.a(P.blocks);n>=0;n--) {
                let ok=false;
                for (let tries=0;tries<30&&!ok;tries++) {
                    const cand=new Set(g.shuffle([...Array(g.cols*g.rows).keys()]).slice(0,n));
                    if (this.solvable(g.cols,g.rows,cand,()=>g.r())) {
                        blocked=cand;
                        ok=true;
                    }
                }
                if (ok) {
                    break;
                }
            }
            g.tiles=[];
            for (let r=0;r<g.rows;r++) {
                for (let c=0;c<g.cols;c++) {
                    const k=r*g.cols+c;
                    const x=g.x0+(c+0.5)*s;
                    const z=g.z0+(r+0.5)*s;
                    const hole=blocked.has(k);
                    const m=g.flat(s-0.14,s-0.14,hole?'dark':'light',x,z,0.05);
                    if (hole) {
                        g.disc(s*0.36,'ink',x,z,0.09);
                        g.stamp('✕',1.4,'red',x,z,0.13);
                    }
                    g.tiles.push({m,painted:false,hole});
                }
            }
            g.need=g.tiles.filter(q=>!q.hole).length;
            g.flat(g.cols*s+0.2,g.rows*s+0.2,'dark',0,g.z0+g.rows*s/2,0.02);
        },
        begin(g) {
            g.place(0,g.z0+g.rows*g.P.size+1.3);
            g.cur=-1;
            g.count=0;
            g.timer(g.a(g.P.time));
        },
        tick(g,dt,pl) {
            const s=g.P.size;
            const c=Math.floor((pl.pos.x-g.x0)/s);
            const r=Math.floor((pl.pos.z-g.z0)/s);
            if (c<0||r<0||c>=g.cols||r>=g.rows) {
                g.cur=-1;
                return;
            }
            const k=r*g.cols+c;
            if (k===g.cur) {
                return;
            }
            g.cur=k;
            const q=g.tiles[k];
            if (q.painted||q.hole) {
                q.m.material=mat('accent');
                g.burst(q.m.position.x,q.m.position.z,'red',14,0.3);
                g.lose();
                return;
            }
            q.painted=true;
            q.m.material=mat('ink');
            g.burst(q.m.position.x,q.m.position.z,'ink',6,0.3);
            g.sound('draw',1+g.count*0.04);
            g.count++;
            if (g.count>=g.need) {
                g.win();
            }
        },
        info(g) {
            return {key:'mg.tiles.info',params:{n:g.count,total:g.need}};
        }
    },
    diff:{
        setup(g) {
            const P=g.P;
            const cell=P.cell;
            const items=[];
            for (let i=0;i<9;i++) {
                items.push({shape:SHAPES[g.int(SHAPES.length)],tone:SHAPE_TONES[g.int(SHAPE_TONES.length)]});
            }
            const n=g.a(P.diffs);
            const which=g.shuffle([0,1,2,3,4,5,6,7,8]).slice(0,n);
            const right=items.map((q,i)=>{
                if (!which.includes(i)) {
                    return q;
                }
                const mode=g.int(3);
                if (mode===0) {
                    return {shape:SHAPES[(SHAPES.indexOf(q.shape)+1+g.int(SHAPES.length-1))%SHAPES.length],tone:q.tone};
                }
                if (mode===1) {
                    return {shape:q.shape,tone:SHAPE_TONES[(SHAPE_TONES.indexOf(q.tone)+1+g.int(SHAPE_TONES.length-1))%SHAPE_TONES.length]};
                }
                return null;
            });
            g.cells=[];
            g.pops=[];
            const zc=-0.8;
            for (const side of [-1,1]) {
                const cx=side*P.gapX;
                g.flat(cell*3+0.4,cell*3+0.4,'dark',cx,zc,0.02);
                const list=side<0?items:right;
                for (let i=0;i<9;i++) {
                    const x=cx+(i%3-1)*cell;
                    const z=zc+(Math.floor(i/3)-1)*cell;
                    const tile=g.flat(cell-0.16,cell-0.16,'light',x,z,0.04);
                    if (list[i]) {
                        const obj=g.shape(list[i].shape,list[i].tone,x,z,0.9);
                        obj.scale.setScalar(0.001);
                        obj.visible=false;
                        g.pops.push({obj,delay:(i+(side>0?9:0))*TUNING.minigame.popGap});
                    }
                    if (side>0) {
                        const p=g.pad(x,z,0.85,'cover',0.11);
                        p.diff=which.includes(i);
                        p.done=false;
                        p.tile=tile;
                        g.cells.push(p);
                    }
                }
            }
            g.stamp('A',1.2,'ink',-P.gapX,zc-cell*1.5-0.9);
            g.stamp('B',1.2,'red',P.gapX,zc-cell*1.5-0.9);
            g.total=n;
        },
        begin(g) {
            g.place(0,MINIGAMES.start[1]);
            g.found=0;
            g.miss=0;
            g.popT=0;
            g.sound('page',1.3);
            g.timer(g.a(g.P.time));
        },
        idle(g,dt) {
            if (g.popT===undefined) {
                return;
            }
            g.popT+=dt;
            const M=TUNING.minigame;
            for (const q of g.pops) {
                const k=Math.max(0,Math.min(1,(g.popT-q.delay)/M.popTime));
                q.obj.visible=k>0;
                q.obj.scale.setScalar(Math.max(0.001,EASE.easeOutBack(k)));
                q.obj.rotation.y=(1-k)*3;
                if (k>0&&!q.puffed) {
                    q.puffed=true;
                    g.burst(q.obj.position.x,q.obj.position.z,'farGray',4,0.5);
                }
            }
        },
        tick(g,dt,pl) {
            const P=g.P;
            if (g.popT<g.pops.length*TUNING.minigame.popGap+TUNING.minigame.popTime) {
                return;
            }
            for (const p of g.cells) {
                if (p.done) {
                    continue;
                }
                if (!g.dwell(p,pl,dt,P.dwell)) {
                    continue;
                }
                p.done=true;
                if (p.diff) {
                    p.ring.material=mat('accent');
                    p.ring.scale.set(1.15,1.15,1.15);
                    p.tile.material=mat('accent');
                    g.stamp('○',1.6,'paper',p.x,p.z,0.14);
                    g.burst(p.x,p.z,'red',12,0.6);
                    g.sound('draw',1.3);
                    g.found++;
                    if (g.found>=g.total) {
                        g.win();
                        return;
                    }
                }
                else {
                    p.tile.material=mat('dark');
                    g.stamp('✕',1.6,'red',p.x,p.z,0.14);
                    g.say(p.x,p.z,'mg.diff.wrong');
                    g.miss++;
                    if (g.miss>P.miss) {
                        g.lose();
                        return;
                    }
                }
            }
        },
        info(g) {
            return {key:'mg.diff.info',params:{n:g.found,total:g.total,m:Math.max(0,g.P.miss-g.miss+1)}};
        }
    },
    pairs:{
        setup(g) {
            const P=g.P;
            const n=P.cols*P.rows;
            const kinds=[];
            const used=new Set();
            while (kinds.length<n/2) {
                const q={shape:SHAPES[g.int(SHAPES.length)],tone:SHAPE_TONES[g.int(SHAPE_TONES.length)]};
                const key=q.shape+q.tone;
                if (!used.has(key)) {
                    used.add(key);
                    kinds.push(q);
                }
            }
            const order=g.shuffle(kinds.concat(kinds).map((q,i)=>({...q,pair:i%(n/2)})));
            g.cards=order.map((q,i)=>{
                const x=(i%P.cols-(P.cols-1)/2)*P.gap;
                const z=-0.8+(Math.floor(i/P.cols)-(P.rows-1)/2)*P.gap;
                const card=g.box(1.8,0.14,2.1,'dark',x,0.07,z);
                const back=g.stamp('?',1.2,'paper',x,z,0.16);
                const sym=g.shape(q.shape,q.tone,x,z,0.8);
                sym.position.y=0.14;
                sym.scale.set(0.001,0.001,0.001);
                const p=g.pad(x,z,0.85,'cover',0.18);
                return {...q,card,back,sym,p,state:'down',k:0};
            });
        },
        begin(g) {
            g.place(0,MINIGAMES.start[1]);
            g.open=[];
            g.wait=0;
            g.miss=0;
            g.done=0;
        },
        idle(g,dt) {
            for (const c of g.cards) {
                const want=c.state==='down'?0:1;
                c.k+=(want-c.k)*Math.min(1,dt*10);
                const s=Math.max(0.001,c.k);
                c.sym.scale.set(s,s,s);
                c.back.visible=c.k<0.5;
                c.card.material=mat(c.k>0.5?(c.state==='done'?'cover':'light'):'dark');
                c.card.rotation.z=Math.sin(c.k*Math.PI)*0.6;
            }
        },
        tick(g,dt,pl) {
            const P=g.P;
            if (g.wait>0) {
                g.wait-=dt;
                if (g.wait<=0) {
                    for (const c of g.open) {
                        c.state='down';
                    }
                    g.open=[];
                    if (g.miss>g.a(P.miss)) {
                        g.lose();
                    }
                }
                return;
            }
            for (const c of g.cards) {
                if (c.state!=='down'||!g.dwell(c.p,pl,dt,P.dwell)) {
                    continue;
                }
                c.state='up';
                g.sound('page',1.3);
                g.open.push(c);
                if (g.open.length<2) {
                    continue;
                }
                const [a,b]=g.open;
                if (a.pair===b.pair) {
                    a.state='done';
                    b.state='done';
                    g.open=[];
                    g.done++;
                    g.burst(a.p.x,a.p.z,'red',8,0.6);
                    g.burst(b.p.x,b.p.z,'red',8,0.6);
                    g.sound('draw',1.4);
                    if (g.done>=g.cards.length/2) {
                        g.win();
                    }
                }
                else {
                    g.miss++;
                    g.wait=P.show;
                }
                return;
            }
        },
        info(g) {
            return {key:'mg.pairs.info',params:{n:g.done,total:g.cards.length/2,m:Math.max(0,g.a(g.P.miss)-g.miss)}};
        }
    },
    rain:{
        setup(g) {
            const P=g.P;
            g.drops=[];
            for (let i=0;i<P.pool;i++) {
                const sh=g.disc(1,'dark',0,0,0.05);
                const rg=g.ring(1,'accent',0,0);
                const b=g.ball(0.42,'ink',0,0,0);
                sh.visible=false;
                rg.visible=false;
                b.visible=false;
                g.drops.push({sh,rg,b,x:0,z:0,t:0,on:false});
            }
        },
        begin(g) {
            const P=g.P;
            g.place(0,0);
            g.next=P.firstDelay;
            g.hits=0;
            g.dur=g.a(P.time);
        },
        idle(g,dt) {
            for (const q of g.drops) {
                if (!q.on&&q.fade>0) {
                    q.fade=Math.max(0,q.fade-dt*g.P.splatFade);
                    q.sh.scale.setScalar(Math.max(0.01,q.r*q.fade));
                    q.sh.visible=q.fade>0;
                }
            }
        },
        clearDrops(g) {
            for (const q of g.drops) {
                if (q.on||q.fade>0) {
                    g.burst(q.x,q.z,'farGray',4,0.3);
                }
                q.on=false;
                q.fade=0;
                q.sh.visible=false;
                q.rg.visible=false;
                q.b.visible=false;
            }
        },
        tick(g,dt,pl) {
            const P=g.P;
            if (g.t>=g.dur) {
                this.clearDrops(g);
                g.win();
                return;
            }
            const R=g.a(P.radius);
            const pr=Math.min(1,g.t/g.dur);
            const warn=g.a(P.warn)*(1-P.warnUp*pr);
            g.next-=dt;
            if (g.next<=0) {
                g.next=g.a(P.every)*(1-P.speedUp*pr);
                const n=g.r()<g.a(P.double)+P.doubleUp*pr?2:1;
                for (let k=0;k<n;k++) {
                    const q=g.drops.find(o=>!o.on&&!(o.fade>0));
                    if (!q) {
                        break;
                    }
                    const aim=k===0&&g.r()<P.aim;
                    const A=P.area;
                    q.x=aim?Math.max(-A[0],Math.min(A[0],pl.pos.x+g.range(-P.near,P.near))):g.range(-A[0],A[0]);
                    q.z=aim?Math.max(-A[1],Math.min(A[1],pl.pos.z+g.range(-P.near,P.near))):g.range(-A[1],A[1]);
                    q.t=0;
                    q.w=warn;
                    q.on=true;
                    q.r=R;
                    q.sh.material=mat('dark');
                    q.sh.visible=true;
                    q.rg.visible=true;
                    q.b.visible=true;
                    q.rg.position.set(q.x,0.06,q.z);
                    q.rg.scale.setScalar(R);
                }
            }
            for (const q of g.drops) {
                if (!q.on) {
                    continue;
                }
                q.t+=dt;
                const k=Math.min(1,q.t/q.w);
                q.sh.position.set(q.x,0.05,q.z);
                q.sh.scale.setScalar(Math.max(0.01,R*k));
                q.b.position.set(q.x,P.height*(1-k*k)+0.4,q.z);
                if (k<1) {
                    continue;
                }
                q.on=false;
                q.fade=1;
                q.b.visible=false;
                q.rg.visible=false;
                q.sh.material=mat('ink');
                g.burst(q.x,q.z,'ink',14,0.4);
                g.sound('drop',0.9+g.r()*0.3);
                if (g.inside(pl,q.x,q.z,R)) {
                    g.hits++;
                    g.burst(pl.pos.x,pl.pos.z,'red',12,1.0);
                    g.say(pl.pos.x,pl.pos.z,'mg.rain.hit');
                    if (g.hits>g.a(P.hits)) {
                        this.clearDrops(g);
                        g.lose();
                        return;
                    }
                }
            }
        },
        info(g) {
            return {key:'mg.rain.info',params:{s:Math.max(0,Math.ceil((g.dur||0)-g.t)),n:Math.max(0,g.a(g.P.hits)-g.hits)}};
        }
    },
    dice:{
        setup(g) {
            const P=g.P;
            g.cyl(0.9,1.0,0.5,'dark',0,0.25,P.dieZ);
            const die=new THREE.Group();
            die.position.set(0,0.5+P.size/2,P.dieZ);
            g.add(die);
            const s=P.size;
            g.box(s,s,s,'light',0,0,0,die);
            const pip=(x,y,z,rx,rz)=>{
                const m=g.cyl(s*0.09,s*0.09,0.04,'ink',x,y,z,die,10);
                m.rotation.set(rx,0,rz);
            };
            const h=s/2+0.01;
            const o=s*0.25;
            const faces={1:[[0,0]],2:[[-o,-o],[o,o]],3:[[-o,-o],[0,0],[o,o]],4:[[-o,-o],[o,o],[-o,o],[o,-o]],5:[[-o,-o],[o,o],[-o,o],[o,-o],[0,0]],6:[[-o,-o],[-o,0],[-o,o],[o,-o],[o,0],[o,o]]};
            for (const [a,b] of faces[1]) {
                pip(a,h,b,0,0);
            }
            for (const [a,b] of faces[6]) {
                pip(a,-h,b,0,0);
            }
            for (const [a,b] of faces[2]) {
                pip(a,b,h,Math.PI/2,0);
            }
            for (const [a,b] of faces[5]) {
                pip(a,b,-h,Math.PI/2,0);
            }
            for (const [a,b] of faces[3]) {
                pip(h,a,b,0,Math.PI/2);
            }
            for (const [a,b] of faces[4]) {
                pip(-h,a,b,0,Math.PI/2);
            }
            g.die=die;
            g.pads=P.pads.map((x,i)=>{
                const p=g.pad(x,P.padZ,P.pad,'dark');
                g.stamp(i===0?t('mg.stamp.big'):t('mg.stamp.small'),1.6,i===0?'red':'ink',x,P.padZ,0.09);
                g.stamp(i===0?'456':'123',0.9,'ink',x,P.padZ+P.pad+0.5,0.09);
                p.big=i===0;
                return p;
            });
        },
        begin(g) {
            g.place(0,MINIGAMES.start[1]);
            g.phase='bet';
        },
        tick(g,dt,pl) {
            const P=g.P;
            if (g.phase==='bet') {
                for (const p of g.pads) {
                    if (g.dwell(p,pl,dt,P.dwell)) {
                        g.big=p.big;
                        p.ring.material=mat('accent');
                        g.phase='roll';
                        g.rt=0;
                        g.value=1+g.int(6);
                        g.sound('page',0.8);
                        return;
                    }
                }
                return;
            }
            if (g.phase==='roll') {
                g.rt+=dt;
                const k=g.rt/P.roll;
                g.die.position.y=0.5+P.size/2+Math.abs(Math.sin(k*Math.PI*3))*(1-k)*1.6;
                if (k<1) {
                    g.die.rotation.x+=dt*(14-k*10);
                    g.die.rotation.z+=dt*(11-k*8);
                    g.die.rotation.y+=dt*6;
                    return;
                }
                const R={1:[0,0],2:[-Math.PI/2,0],3:[0,Math.PI/2],4:[0,-Math.PI/2],5:[Math.PI/2,0],6:[Math.PI,0]}[g.value];
                g.die.rotation.set(R[0],0,R[1]);
                g.die.position.y=0.5+P.size/2;
                g.burst(0,P.dieZ,'ink',14,1.2);
                g.say(0,P.dieZ,'mg.dice.value',{n:g.value});
                g.phase='done';
                if ((g.value>=4)===g.big) {
                    g.win();
                }
                else {
                    g.lose();
                }
            }
        },
        info(g) {
            return {key:g.phase==='bet'?'mg.dice.bet':'mg.dice.roll',params:{n:g.value||0}};
        }
    },
    plane:{
        setup(g) {
            const P=g.P;
            const [px,pz]=P.pad;
            g.padP=g.pad(px,pz,P.padR,'dark');
            g.stamp(t('mg.stamp.throw'),1.1,'ink',px,pz,0.09);
            g.meter=new THREE.Group();
            g.meter.position.set(px+2.1,0,pz);
            g.add(g.meter);
            g.box(0.5,2.6,0.12,'dark',0,1.3,0,g.meter);
            g.box(0.36,2.4,0.14,'light',0,1.3,0.02,g.meter);
            g.slider=g.box(0.62,0.16,0.2,'accent',0,0.2,0.05,g.meter);
            g.mt=0;
            // two bins, one on each side of the field so both stay readable from the launch pad
            g.bins=[];
            const flip=g.r()<0.5?-1:1;
            for (let i=0;i<P.bins;i++) {
                const bx=(i%2===0?flip:-flip)*g.range(P.binMinX,P.binX);
                const bz=g.range(P.binZ[0],P.binZ[1]);
                g.cyl(P.binR*0.85,P.binR*0.7,1.0,'dark',bx,0.5,bz);
                const rim=g.ring(P.binR*0.85,'light',bx,bz);
                rim.position.y=1.02;
                g.disc(P.binR,'cover',bx,bz,0.02);
                const done=g.ring(P.binR*0.85,'accent',bx,bz);
                done.position.y=1.03;
                const fill=g.disc(P.binR*0.8,'accent',bx,bz,1.0);
                done.visible=false;
                fill.visible=false;
                g.bins.push({x:bx,z:bz,hit:false,done,fill});
            }
            g.aim=g.flat(0.12,3,'midGray',px,pz,0.05);
            g.plane=new THREE.Group();
            g.add(g.plane);
            const wing=g.cone(0.45,1.1,'light',0,0,0,g.plane,3);
            wing.rotation.x=Math.PI/2;
            wing.scale.set(1,1,0.25);
            g.plane.visible=false;
        },
        begin(g) {
            g.place(g.P.pad[0],g.P.pad[1]);
            g.misses=g.P.misses;
            g.hits=0;
            g.mt=0;
            g.fly=null;
        },
        // camera framing: while the player stands on the launch pad, keep the pad and every bin still in play on screen
        view(g,pl) {
            if (g.ended) {
                return null;
            }
            const P=g.P;
            const near=g.fly||g.inside(pl,P.pad[0],P.pad[1],P.padR*1.8);
            if (!near) {
                return null;
            }
            const pts=[[P.pad[0],P.pad[1]]];
            for (const b of g.bins) {
                if (!b.hit) {
                    pts.push([b.x,b.z]);
                }
            }
            return {
                minX:Math.min(...pts.map(q=>q[0])),
                maxX:Math.max(...pts.map(q=>q[0])),
                minZ:Math.min(...pts.map(q=>q[1])),
                maxZ:Math.max(...pts.map(q=>q[1]))
            };
        },
        power(g) {
            const x=(g.mt*g.a(g.P.meterRate))%2;
            return 1-Math.abs(x-1);
        },
        idle(g,dt,pl) {
            const P=g.P;
            g.mt+=dt;
            const m=this.power(g);
            g.slider.position.y=0.2+m*2.2;
            const yaw=pl.aimYaw;
            g.aim.rotation.y=yaw;
            g.aim.position.set(P.pad[0]+Math.sin(yaw)*2,0.05,P.pad[1]+Math.cos(yaw)*2);
        },
        canInteract(g,pl) {
            return !g.fly&&g.inside(pl,g.P.pad[0],g.P.pad[1],g.P.padR);
        },
        prompt(g,pl) {
            return this.canInteract(g,pl)?{x:g.P.pad[0],y:2.4,z:g.P.pad[1],key:'mg.plane.throw'}:null;
        },
        interact(g,pl) {
            const P=g.P;
            const m=this.power(g);
            const dist=P.min+(P.max-P.min)*m;
            const yaw=pl.aimYaw;
            g.fly={t:0,x0:P.pad[0],z0:P.pad[1],x1:P.pad[0]+Math.sin(yaw)*dist,z1:P.pad[1]+Math.cos(yaw)*dist,yaw};
            g.plane.visible=true;
            g.sound('dash',1.3);
        },
        tick(g,dt) {
            const P=g.P;
            const f=g.fly;
            if (!f) {
                return;
            }
            f.t+=dt/P.fly;
            const k=Math.min(1,f.t);
            g.plane.position.set(f.x0+(f.x1-f.x0)*k,1.4+Math.sin(k*Math.PI)*2.4-k*1.3,f.z0+(f.z1-f.z0)*k);
            g.plane.rotation.set(0,f.yaw,0);
            g.plane.rotateX(-0.4+k*0.9);
            if (k<1) {
                return;
            }
            g.fly=null;
            g.burst(f.x1,f.z1,'farGray',8,0.3);
            const hit=g.bins.find(q=>!q.hit&&Math.hypot(f.x1-q.x,f.z1-q.z)<P.binR);
            if (hit) {
                hit.hit=true;
                hit.done.visible=true;
                hit.fill.visible=true;
                g.hits++;
                g.plane.visible=false;
                g.burst(hit.x,hit.z,'red',14,1.1);
                if (g.hits>=g.bins.length) {
                    g.win();
                }
                else {
                    g.sound('equip',1.1);
                    g.say(hit.x,hit.z,'mg.plane.hit',{n:g.hits,total:g.bins.length});
                }
                return;
            }
            g.misses--;
            let near=null;
            for (const q of g.bins) {
                if (!q.hit&&(!near||Math.hypot(f.x1-q.x,f.z1-q.z)<Math.hypot(f.x1-near.x,f.z1-near.z))) {
                    near=q;
                }
            }
            if (near) {
                g.say(f.x1,f.z1,Math.hypot(f.x0-near.x,f.z0-near.z)>Math.hypot(f.x0-f.x1,f.z0-f.z1)?'mg.plane.short':'mg.plane.long');
            }
            if (g.misses<=0) {
                g.lose();
            }
        },
        info(g) {
            return {key:'mg.plane.info',params:{n:g.misses,hit:g.hits,total:g.bins.length}};
        }
    },
    maze:{
        setup(g) {
            const P=g.P;
            const C=P.cols;
            const R=P.rows;
            const W=C*P.cell;
            g.x0=g.flip>0?P.x0:-(P.x0+W);
            g.z0=P.z0;
            const open=new Set();
            const seen=new Set([0]);
            const stack=[0];
            while (stack.length) {
                const k=stack[stack.length-1];
                const r=Math.floor(k/C);
                const c=k%C;
                const nb=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([rr,cc])=>rr>=0&&cc>=0&&rr<R&&cc<C&&!seen.has(rr*C+cc));
                if (nb.length===0) {
                    stack.pop();
                    continue;
                }
                const [rr,cc]=nb[g.int(nb.length)];
                const n=rr*C+cc;
                open.add(Math.min(k,n)+'|'+Math.max(k,n));
                seen.add(n);
                stack.push(n);
            }
            const walls=[];
            const t=P.wall;
            const cx=c=>g.x0+c*P.cell;
            const cz=r=>g.z0+r*P.cell;
            walls.push([g.x0+W/2,cz(0),W+t,t],[g.x0+W/2,cz(R),W+t,t],[cx(0),g.z0+R*P.cell/2,t,R*P.cell+t],[cx(C),g.z0+R*P.cell/2,t,R*P.cell+t]);
            for (let r=0;r<R;r++) {
                for (let c=0;c<C;c++) {
                    const k=r*C+c;
                    if (c<C-1&&!open.has(k+'|'+(k+1))) {
                        walls.push([cx(c+1),cz(r)+P.cell/2,t,P.cell+t]);
                    }
                    if (r<R-1&&!open.has(k+'|'+(k+C))) {
                        walls.push([cx(c)+P.cell/2,cz(r+1),P.cell+t,t]);
                    }
                }
            }
            g.walls=walls;
            g.wallGroup=new THREE.Group();
            g.add(g.wallGroup);
            g.floorGroup=new THREE.Group();
            g.add(g.floorGroup);
            g.floorGroup.visible=false;
            g.wallMeshes=walls.map(([x,z,w,d])=>{
                g.flat(w,d,'dark',x,z,0.03,g.floorGroup);
                return {m:g.box(w,P.wallH,d,'cover',x,P.wallH/2,z,g.wallGroup),x,z};
            });
            g.wallGroup.visible=false;
            const startC=g.flip>0?0:C-1;
            g.start=startC;
            const dist=new Map([[startC,0]]);
            const q=[startC];
            while (q.length) {
                const k=q.shift();
                const r=Math.floor(k/C);
                const c=k%C;
                for (const [rr,cc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
                    const n=rr*C+cc;
                    if (rr>=0&&cc>=0&&rr<R&&cc<C&&!dist.has(n)&&open.has(Math.min(k,n)+'|'+Math.max(k,n))) {
                        dist.set(n,dist.get(k)+1);
                        q.push(n);
                    }
                }
            }
            let goal=startC;
            for (const [k,d] of dist) {
                if (d>dist.get(goal)) {
                    goal=k;
                }
            }
            const center=k=>[cx(k%C)+P.cell/2,cz(Math.floor(k/C))+P.cell/2];
            g.sp=center(startC);
            for (const q of g.wallMeshes) {
                q.d=Math.hypot(q.x-g.sp[0],q.z-g.sp[1])/P.cell;
                q.m.scale.y=0.001;
            }
            g.gp=center(goal);
            g.disc(0.9,'accent',g.gp[0],g.gp[1]);
            g.stamp('★',1.2,'paper',g.gp[0],g.gp[1],0.09);
            g.disc(0.8,'marker',g.sp[0],g.sp[1]);
        },
        begin(g) {
            g.place(g.sp[0],g.sp[1]);
            g.wallGroup.visible=true;
            g.floorGroup.visible=true;
            g.grow=0;
            g.sink=-1;
            g.solid(g.walls.map(([x,z,w,d])=>makeBox(x,z,w/2,d/2,0)));
            g.timer(g.a(g.P.time));
            g.sound('wall',1);
        },
        idle(g,dt) {
            if (g.grow===undefined) {
                return;
            }
            const M=TUNING.minigame;
            const H=g.P.wallH;
            g.grow+=dt;
            if (g.sink>=0) {
                g.sink+=dt;
            }
            let any=false;
            for (const q of g.wallMeshes) {
                let k=Math.max(0,Math.min(1,(g.grow-q.d*M.wallGap)/M.wallRise));
                k=EASE.easeOutBack(k);
                if (g.sink>=0) {
                    k*=1-EASE.easeInCubic(Math.max(0,Math.min(1,(g.sink-q.d*M.wallGap*0.6)/M.wallSink)));
                }
                q.m.scale.y=Math.max(0.001,k);
                q.m.position.y=H/2*Math.max(0.001,k);
                any=any||k>0.002;
            }
            if (g.sink>=0&&!any) {
                g.wallGroup.visible=false;
                g.floorGroup.visible=false;
            }
        },
        tick(g,dt,pl) {
            if (g.inside(pl,g.gp[0],g.gp[1],1.0)) {
                g.burst(g.gp[0],g.gp[1],'red',16,0.8);
                g.win();
            }
        },
        teardown(g) {
            g.sink=0;
            g.sound('wall',0.8);
            for (const [x,z] of g.walls) {
                if (Math.random()<0.3) {
                    g.burst(x,z,'farGray',3,0.6);
                }
            }
        },
        info(g) {
            return {key:'mg.maze.info'};
        }
    },
    rhythm:{
        setup(g) {
            const P=g.P;
            g.lanes=P.lanes.map((x,i)=>{
                const ring=g.ring(P.pad,'dark',x,P.z);
                const disc=g.disc(P.pad*0.9,i===1?'cover':'light',x,P.z,0.03);
                return {x,z:P.z,ring,disc,lit:0};
            });
            const n=g.a(P.count);
            g.notes=[];
            for (let i=0;i<n;i++) {
                const b=g.ball(0.38,'ink',0,0,0);
                b.visible=false;
                const sh=g.disc(0.5,'dark',0,0,0.05);
                sh.visible=false;
                g.notes.push({b,sh,lane:0,at:0,state:'wait'});
            }
        },
        begin(g) {
            const P=g.P;
            g.place(P.lanes[1],P.z);
            const gap=g.a(P.gap);
            let last=-1;
            g.notes.forEach((q,i)=>{
                let lane=g.int(3);
                if (lane===last&&g.r()<0.6) {
                    lane=(lane+1+g.int(2))%3;
                }
                last=lane;
                q.lane=lane;
                q.at=P.lead+P.fall+i*gap;
                q.state='wait';
            });
            g.hits=0;
            g.miss=0;
        },
        idle(g,dt) {
            for (const l of g.lanes) {
                l.lit=Math.max(0,l.lit-dt*3);
                l.ring.material=mat(l.lit>0.3?'accent':'dark');
            }
        },
        tick(g,dt,pl) {
            const P=g.P;
            for (const q of g.notes) {
                if (q.state==='gone') {
                    continue;
                }
                const L=g.lanes[q.lane];
                const k=(g.t-(q.at-P.fall))/P.fall;
                if (k<0) {
                    continue;
                }
                q.b.visible=true;
                q.sh.visible=true;
                q.b.position.set(L.x,0.4+7.5*(1-Math.min(1,k)),L.z);
                const s=0.3+0.7*Math.min(1,k);
                q.sh.position.set(L.x,0.05,L.z);
                q.sh.scale.set(s,1,s);
                if (k<1) {
                    continue;
                }
                q.state='gone';
                q.b.visible=false;
                q.sh.visible=false;
                if (g.inside(pl,L.x,L.z,P.pad)) {
                    g.hits++;
                    L.lit=1;
                    g.burst(L.x,L.z,'red',10,0.5);
                    g.sound('bell',TUNING.npc.bellPitch[q.lane]);
                }
                else {
                    g.miss++;
                    g.burst(L.x,L.z,'ink',14,0.3);
                    g.say(L.x,L.z,'mg.rhythm.miss');
                    if (g.miss>g.a(P.miss)) {
                        g.lose();
                        return;
                    }
                }
            }
            if (g.notes.every(q=>q.state==='gone')) {
                g.win();
            }
        },
        info(g) {
            return {key:'mg.rhythm.info',params:{n:g.hits,total:g.notes.length,m:Math.max(0,g.a(g.P.miss)-g.miss)}};
        }
    },
    shadow:{
        setup(g) {
            const P=g.P;
            const st=MINIGAMES.start;
            const used=[[st[0],st[1],2.8]];
            g.marks=[];
            for (let i=0;i<P.marks;i++) {
                const p=g.spot(P.minGap,used,1.4);
                used.push(p);
                const a=g.flat(1.3,0.22,'dark',p[0],p[1],0.04);
                a.rotation.y=Math.PI/4;
                const b=g.flat(1.3,0.22,'dark',p[0],p[1],0.04);
                b.rotation.y=-Math.PI/4;
                const ring=g.ring(P.markR,'cover',p[0],p[1]);
                g.marks.push({x:p[0],z:p[1],a,b,ring,lit:0,in:false});
            }
            g.ghost=new THREE.Group();
            g.add(g.ghost);
            g.ball(0.5,'ink',0,1.3,0,g.ghost);
            g.cyl(0.5,0.08,1.0,'ink',0,0.65,0,g.ghost,12);
            g.ball(0.09,'light',-0.16,1.4,0.42,g.ghost);
            g.ball(0.09,'light',0.16,1.4,0.42,g.ghost);
            g.ghost.visible=false;
            g.trail=[];
            for (let i=0;i<P.trail;i++) {
                const m=g.disc(P.trailR,'accent',0,0,0.05);
                m.visible=false;
                g.trail.push({m,t:9});
            }
            g.ti=0;
            g.tdist=0;
        },
        begin(g) {
            const P=g.P;
            g.place(MINIGAMES.start[0],MINIGAMES.start[1]);
            const len=g.a(P.len);
            g.seq=g.shuffle(g.marks.map((m,i)=>i)).slice(0,len);
            g.phase='show';
            g.gi=0;
            g.wait=0.4;
            const s=g.marks[g.seq[0]];
            g.gx=s.x>0?MINIGAMES.area.maxX-1:MINIGAMES.area.minX+1;
            g.gz=-5;
            g.ghost.position.set(g.gx,0,g.gz);
            g.ghost.visible=true;
            g.ghost.scale.set(1,1,1);
            g.step=0;
        },
        flash(g,i,red) {
            const m=g.marks[i];
            m.lit=1;
            m.a.material=mat(red?'accent':'ink');
            m.b.material=mat(red?'accent':'ink');
            g.sound('bell',TUNING.npc.bellPitch[i%TUNING.npc.bellPitch.length]);
        },
        idle(g,dt) {
            for (const q of g.trail) {
                if (q.t<g.P.trailLife) {
                    q.t+=dt;
                    const k=1-q.t/g.P.trailLife;
                    q.m.visible=k>0;
                    q.m.scale.set(Math.max(0.01,k),1,Math.max(0.01,k));
                }
            }
            for (const m of g.marks) {
                if (m.lit>0) {
                    m.lit=Math.max(0,m.lit-dt*2);
                    if (m.lit<=0) {
                        m.a.material=mat('dark');
                        m.b.material=mat('dark');
                    }
                }
            }
        },
        tick(g,dt,pl) {
            const P=g.P;
            if (g.phase==='show') {
                if (g.wait>0) {
                    g.wait-=dt;
                    return;
                }
                if (g.gi>=g.seq.length) {
                    g.ghost.scale.multiplyScalar(Math.max(0,1-dt*4));
                    if (g.ghost.scale.x<0.05) {
                        g.ghost.visible=false;
                        g.phase='input';
                        for (const m of g.marks) {
                            m.in=g.inside(pl,m.x,m.z,P.markR);
                        }
                    }
                    return;
                }
                const m=g.marks[g.seq[g.gi]];
                const dx=m.x-g.gx;
                const dz=m.z-g.gz;
                const d=Math.hypot(dx,dz);
                const st=P.speed*dt;
                g.ghost.rotation.y=Math.atan2(dx,dz);
                if (d<=st) {
                    g.gx=m.x;
                    g.gz=m.z;
                    this.flash(g,g.seq[g.gi],false);
                    g.burst(m.x,m.z,'ink',8,0.4);
                    g.gi++;
                    g.wait=P.pause;
                }
                else {
                    g.gx+=dx/d*st;
                    g.gz+=dz/d*st;
                    g.tdist+=st;
                    if (g.tdist>=P.trailGap) {
                        g.tdist=0;
                        const q=g.trail[g.ti++%g.trail.length];
                        q.t=0;
                        q.m.position.set(g.gx+(Math.random()-0.5)*0.15,0.05,g.gz+(Math.random()-0.5)*0.15);
                        q.m.visible=true;
                    }
                    if (Math.random()<dt*14) {
                        g.burst(g.gx,g.gz,'red',1,0.2);
                    }
                }
                g.ghost.position.set(g.gx,Math.abs(Math.sin(g.t*10))*0.15,g.gz);
                return;
            }
            for (let i=0;i<g.marks.length;i++) {
                const m=g.marks[i];
                const inside=g.inside(pl,m.x,m.z,P.markR);
                if (inside&&!m.in) {
                    const ok=g.seq[g.step]===i;
                    this.flash(g,i,ok);
                    if (!ok) {
                        g.lose();
                        return;
                    }
                    g.step++;
                    if (g.step>=g.seq.length) {
                        g.win();
                        return;
                    }
                }
                m.in=inside;
            }
        },
        info(g) {
            return g.phase==='show'?{key:'mg.shadow.watch'}:{key:'mg.shadow.info',params:{n:g.step,total:g.seq.length}};
        }
    },
    marble:{
        setup(g) {
            const P=g.P;
            const gx=g.range(-7,7);
            g.goal={x:gx,z:-5.2};
            g.ring(P.goalR,'accent',gx,-5.2);
            g.disc(P.goalR*0.9,'marker',gx,-5.2,0.03);
            const sx=g.range(-5,5);
            g.m={x:sx,z:2.6,vx:0,vz:0,sink:0};
            const used=[[gx,-5.2,2.8],[sx,2.6,2.8],[0,MINIGAMES.start[1],2.2]];
            g.holes=[];
            for (let i=0;i<g.a(P.holes);i++) {
                const p=g.spot(2.6,used,1.6);
                if (p[1]>3.4) {
                    p[1]=g.range(-3.5,2);
                }
                used.push([p[0],p[1],2.6]);
                g.disc(P.holeR,'ink',p[0],p[1],0.03);
                g.ring(P.holeR,'dark',p[0],p[1]);
                g.holes.push({x:p[0],z:p[1]});
            }
            g.ballM=g.ball(P.r,'accent',sx,P.r,2.6);
            g.box(P.r*2.05,0.1,0.1,'light',0,0,0,g.ballM);
        },
        begin(g) {
            g.place(g.m.x,g.m.z+1.6);
            g.timer(g.a(g.P.time));
        },
        tick(g,dt,pl) {
            const P=g.P;
            const m=g.m;
            if (m.sink>0) {
                m.sink+=dt;
                g.ballM.position.y=P.r-m.sink*2;
                return;
            }
            const R=TUNING.player.radius+P.r;
            const dx=m.x-pl.pos.x;
            const dz=m.z-pl.pos.z;
            const d=Math.hypot(dx,dz);
            if (d<R&&d>0.001) {
                const nx=dx/d;
                const nz=dz/d;
                m.x=pl.pos.x+nx*R;
                m.z=pl.pos.z+nz*R;
                const vn=pl.vel.x*nx+pl.vel.z*nz;
                const cur=m.vx*nx+m.vz*nz;
                const want=Math.max(P.kick*0.35,vn*1.25);
                if (want>cur) {
                    m.vx+=nx*(want-cur);
                    m.vz+=nz*(want-cur);
                    g.sound('draw',1.6);
                }
            }
            m.x+=m.vx*dt;
            m.z+=m.vz*dt;
            const f=Math.exp(-P.fric*dt);
            m.vx*=f;
            m.vz*=f;
            const A=MINIGAMES.area;
            if (m.x<A.minX+P.r||m.x>A.maxX-P.r) {
                m.vx*=-P.bounce;
                m.x=Math.max(A.minX+P.r,Math.min(A.maxX-P.r,m.x));
            }
            if (m.z<A.minZ+P.r||m.z>A.maxZ-P.r) {
                m.vz*=-P.bounce;
                m.z=Math.max(A.minZ+P.r,Math.min(A.maxZ-P.r,m.z));
            }
            g.ballM.position.set(m.x,P.r,m.z);
            g.ballM.rotation.x+=m.vz*dt/P.r;
            g.ballM.rotation.z-=m.vx*dt/P.r;
            for (const h of g.holes) {
                if (Math.hypot(m.x-h.x,m.z-h.z)<P.holeR*0.7) {
                    m.x=h.x;
                    m.z=h.z;
                    m.sink=0.001;
                    g.burst(h.x,h.z,'ink',16,0.2);
                    g.lose();
                    return;
                }
            }
            if (Math.hypot(m.x-g.goal.x,m.z-g.goal.z)<P.goalR*0.75) {
                g.burst(m.x,m.z,'red',16,0.6);
                g.win();
            }
        },
        info(g) {
            return {key:'mg.marble.info'};
        }
    },
    cups:{
        setup(g) {
            const P=g.P;
            const opts=g.a(P.counts);
            const n=opts[g.int(opts.length)];
            g.xs=[];
            for (let i=0;i<n;i++) {
                g.xs.push((i-(n-1)/2)*P.spacing);
            }
            g.cups=g.xs.map((x,i)=>{
                const root=new THREE.Group();
                root.position.set(x,0,P.z);
                g.add(root);
                g.cyl(0.5,0.68,1.1,'light',0,0.55,0,root);
                g.cyl(0.7,0.7,0.08,'dark',0,0.04,0,root);
                g.ball(0.12,'dark',0,1.12,0,root);
                return {root,slot:i,x,z:P.z,y:0};
            });
            g.ballM=g.ball(0.28,'accent',0,0.28,P.z);
            g.has=g.int(g.cups.length);
            g.pads=g.xs.map((x,i)=>{
                const p=g.pad(x,P.padZ,P.pad,'dark');
                p.slot=i;
                return p;
            });
        },
        begin(g) {
            g.place(0,MINIGAMES.start[1]);
            g.phase='peek';
            g.pt=0;
            g.swaps=g.a(g.P.swaps);
            g.sw=null;
            g.judged=false;
        },
        lay(g) {
            for (const c of g.cups) {
                c.root.position.set(c.x,c.y,c.z);
            }
            const h=g.cups[g.has];
            g.ballM.position.set(h.x,0.28,h.z);
        },
        idle(g) {
            this.lay(g);
        },
        tick(g,dt,pl) {
            const P=g.P;
            const h=g.cups[g.has];
            if (g.phase==='peek') {
                g.pt+=dt;
                const k=g.pt/P.peek;
                h.y=Math.sin(Math.min(1,k)*Math.PI)*P.lift;
                if (k>=1) {
                    h.y=0;
                    g.phase='shuffle';
                    g.pt=0;
                }
                return;
            }
            if (g.phase==='shuffle') {
                const T=g.a(P.swapT);
                if (!g.sw) {
                    if (g.swaps<=0) {
                        g.phase='pick';
                        return;
                    }
                    g.swaps--;
                    const N=g.cups.length;
                    const a=g.int(N);
                    const b=(a+1+g.int(N-1))%N;
                    g.sw={a:g.cups.find(c=>c.slot===a),b:g.cups.find(c=>c.slot===b),t:0};
                    g.sound('page',1.5);
                }
                const s=g.sw;
                s.t+=dt/T;
                const k=EASE.easeInOutQuad(Math.min(1,s.t));
                const xa=g.xs[s.a.slot];
                const xb=g.xs[s.b.slot];
                s.a.x=xa+(xb-xa)*k;
                s.b.x=xb+(xa-xb)*k;
                s.a.z=P.z+Math.sin(k*Math.PI)*0.9;
                s.b.z=P.z-Math.sin(k*Math.PI)*0.9;
                if (s.t>=1) {
                    const sa=s.a.slot;
                    s.a.slot=s.b.slot;
                    s.b.slot=sa;
                    s.a.z=P.z;
                    s.b.z=P.z;
                    g.sw=null;
                }
                return;
            }
            if (g.phase==='pick') {
                for (const p of g.pads) {
                    if (g.dwell(p,pl,dt,P.dwell)) {
                        g.pick=g.cups.find(c=>c.slot===p.slot);
                        g.phase='reveal';
                        g.pt=0;
                        p.ring.material=mat('accent');
                        return;
                    }
                }
                return;
            }
            if (g.phase==='reveal') {
                g.pt+=dt;
                g.pick.y=Math.min(1,g.pt*3)*P.lift;
                if (g.pick!==h&&g.pt>0.5) {
                    h.y=Math.min(1,(g.pt-0.5)*3)*P.lift;
                }
                if (g.pt>0.35&&!g.judged) {
                    g.judged=true;
                    if (g.pick===h) {
                        g.burst(h.x,h.z,'red',14,0.6);
                        g.win();
                    }
                    else {
                        g.lose();
                    }
                }
            }
        },
        info(g) {
            return {key:'mg.cups.'+g.phase};
        }
    },
    teacher:{
        setup(g) {
            const P=g.P;
            const C=P.circles;
            g.cx=P.center[0];
            g.cz=P.center[1];
            g.ring(P.centerR,'dark',g.cx,g.cz);
            g.disc(P.centerR*0.9,'cover',g.cx,g.cz,0.03);
            g.stamp(t('mg.stamp.home'),0.9,'midGray',g.cx,g.cz);
            g.pads={};
            for (const [k,sx] of [['left',-1],['right',1]]) {
                const x=sx*C.x;
                const ring=g.ring(C.r,'dark',x,C.z);
                g.disc(C.r*0.9,'light',x,C.z,0.03);
                g.stamp(t('mg.stamp.'+k),1.2,'ink',x,C.z);
                g.pads[k]={x,z:C.z,r:C.r,ring,lit:0};
            }
            g.cross=g.stamp('✕',P.markSize,'red',0,0,0.09);
            g.cross.visible=false;
            g.circle=g.stamp('○',P.markSize,'ink',0,0,0.09);
            g.circle.visible=false;
            g.mark=null;
            g.crossT=0;
            g.flash=null;
            const host=P.host||MINIGAMES.host;
            g.sign=new THREE.Group();
            g.sign.position.set(host[0]*g.flip,P.signY,host[1]);
            g.add(g.sign);
            g.box(0.9,0.14,0.14,'accent',0,0,0,g.sign);
            const head=g.cone(0.26,0.4,'accent',0.6,0,0,g.sign);
            head.rotation.z=-Math.PI/2;
            g.sign.visible=false;
        },
        begin(g) {
            const P=g.P;
            g.place(g.cx,g.cz);
            g.timer(g.a(P.timer));
            const n=g.a(P.cmds);
            g.list=[];
            let fakes=0;
            let last='';
            for (let i=0;i<n;i++) {
                const fake=i>=P.warm&&fakes<P.fakeMax&&g.r()<g.a(P.fake);
                fakes=fake?fakes+1:0;
                let kind;
                if (!fake&&g.r()<g.a(P.seqChance)) {
                    kind=g.r()<0.5?'lr':'rl';
                }
                else {
                    const opts=['left','right','dash'].filter(k=>k!==last);
                    kind=opts[g.int(opts.length)];
                }
                last=kind;
                const near=fake&&g.r()<g.a(P.nearMiss);
                const pool=g.r()<g.a(P.nearHard)?P.nearHardKeys:P.nearEasyKeys;
                const pre=fake?(near?t('mg.teacher.near'+pool[g.int(pool.length)]):''):t('mg.teacher.real');
                const trick=(kind==='left'||kind==='right')&&g.r()<g.a(P.handTrick);
                g.list.push({kind,fake,trick,text:t('mg.teacher.say',{p:pre,c:t('mg.teacher.cmd.'+kind)})});
            }
            g.i=0;
            g.err=0;
            g.state='ready';
            g.still=0;
            g.wait=g.a(P.gap)+g.r()*P.gapJitter;
            g.cur=null;
            g.prevDash=0;
            g.away=false;
        },
        idle(g,dt) {
            for (const k in g.pads) {
                const p=g.pads[k];
                p.lit=Math.max(0,p.lit-dt*2.5);
                p.ring.material=mat(p.lit>0.3?'accent':'dark');
            }
            if (g.crossT>0&&g.mark) {
                g.crossT-=dt;
                const k=Math.max(0,g.crossT/g.P.crossTime);
                g.mark.visible=g.crossT>0;
                g.mark.scale.setScalar(0.6+0.8*Math.min(1,(1-k)*4));
                g.mark.position.y=0.09+(1-k)*0.4;
            }
            if (g.flash) {
                g.flash.t-=dt;
                if (g.flash.t<=0) {
                    g.flash=null;
                }
            }
        },
        judge(g,pl,ok) {
            const P=g.P;
            const q=g.cur;
            g.cur=null;
            g.sign.visible=false;
            g.i++;
            g.state='ready';
            g.still=0;
            g.wait=g.a(P.gap)+g.r()*P.gapJitter;
            for (const m of [g.cross,g.circle]) {
                m.visible=false;
            }
            g.mark=ok?g.circle:g.cross;
            g.mark.position.set(pl.pos.x,0.09,pl.pos.z);
            g.mark.visible=true;
            g.crossT=P.crossTime;
            g.flash={text:t(ok?'mg.teacher.flash.ok':'mg.teacher.flash.wrong'),color:ok?'ink':'red',t:P.flashTime};
            if (ok) {
                g.burst(pl.pos.x,pl.pos.z,'red',22,0.6);
                g.sound('bell',q.fake?1.5:1.25);
                g.sound('bell',q.fake?2.0:1.68);
                if (q.fake) {
                    g.talk(t('mg.teacher.ok'),P.talkTime);
                }
            }
            else {
                g.err++;
                g.burst(pl.pos.x,pl.pos.z,'ink',24,0.4);
                g.shake(P.wrongShake);
                g.sound('fail',1);
                g.talk(t(q.fake?'mg.teacher.wrong.fake':'mg.teacher.wrong'),P.talkTime);
                if (g.err>g.a(P.miss)) {
                    g.lose();
                    return;
                }
            }
            if (g.i>=g.list.length) {
                g.win();
            }
        },
        tick(g,dt,pl) {
            const P=g.P;
            const dashed=pl.dashT>0&&g.prevDash<=0;
            g.prevDash=pl.dashT;
            const d=Math.hypot(pl.pos.x-g.cx,pl.pos.z-g.cz);
            g.away=d>=P.centerR;
            if (g.state==='ready') {
                const sp=Math.hypot(pl.vel.x,pl.vel.z);
                if (d<P.centerR&&sp<P.stillSpeed&&pl.dashT<=0) {
                    g.still+=dt;
                }
                else if (d>=P.centerR) {
                    g.still=0;
                }
                if (g.still<P.still) {
                    return;
                }
                g.wait-=dt;
                if (g.wait>0) {
                    return;
                }
                const q=g.list[g.i];
                g.cur=q;
                g.state=q.fake?'fake':'act';
                g.ct=0;
                g.step=0;
                g.limitT=q.fake?g.a(P.fakeHold):(q.kind==='lr'||q.kind==='rl'?g.a(P.seqWin):g.a(P.win));
                g.talk(q.text,g.limitT+0.3);
                g.sound('page',q.fake?1.1:1.4);
                if (q.trick) {
                    g.sign.visible=true;
                    g.sign.rotation.y=q.kind==='left'?0:Math.PI;
                }
                return;
            }
            const q=g.cur;
            g.ct+=dt;
            if (g.state==='fake') {
                if (d>P.leaveR||dashed) {
                    this.judge(g,pl,false);
                    return;
                }
                if (g.ct>=g.limitT) {
                    this.judge(g,pl,true);
                }
                return;
            }
            const inL=g.inside(pl,g.pads.left.x,g.pads.left.z,g.pads.left.r);
            const inR=g.inside(pl,g.pads.right.x,g.pads.right.z,g.pads.right.r);
            if (q.kind==='dash') {
                if (dashed) {
                    this.judge(g,pl,true);
                    return;
                }
                if (inL||inR) {
                    this.judge(g,pl,false);
                    return;
                }
            }
            else {
                const seq=q.kind==='lr'?['left','right']:(q.kind==='rl'?['right','left']:[q.kind]);
                const want=seq[g.step];
                const other=want==='left'?'right':'left';
                const inWant=want==='left'?inL:inR;
                const inOther=want==='left'?inR:inL;
                if (inOther&&!(g.step>0&&seq[g.step-1]===other)) {
                    this.judge(g,pl,false);
                    return;
                }
                if (inWant) {
                    g.pads[want].lit=1;
                    g.step++;
                    if (g.step>=seq.length) {
                        this.judge(g,pl,true);
                        return;
                    }
                    g.sound('bell',1.1);
                }
            }
            if (g.ct>=g.limitT) {
                this.judge(g,pl,false);
            }
        },
        info(g) {
            const left=Math.max(0,g.a(g.P.miss)-g.err);
            const big=g.flash?{text:g.flash.text,color:g.flash.color}:(g.cur?{text:g.cur.text}:(g.away?{text:t('mg.teacher.home'),dim:true}:null));
            return {key:'mg.teacher.info',params:{n:Math.min(g.i+1,g.list.length),total:g.list.length,m:left},big};
        },
        teardown(g) {
            g.sign.visible=false;
            g.cross.visible=false;
            g.circle.visible=false;
        }
    },
    count:{
        setup(g) {
            const P=g.P;
            const [wx,wz]=P.watch;
            g.watch=new THREE.Group();
            g.watch.position.set(wx,0,wz);
            g.add(g.watch);
            const face=new THREE.Group();
            face.position.y=P.r+0.35;
            face.rotation.x=-P.tilt;
            g.watch.add(face);
            const body=g.cyl(P.r,P.r,0.4,'light',0,0,0,face,32);
            body.rotation.x=Math.PI/2;
            const rim=g.cyl(P.r+0.08,P.r+0.08,0.3,'dark',0,0,-0.08,face,32);
            rim.rotation.x=Math.PI/2;
            g.cyl(0.16,0.16,0.3,'dark',0,P.r+0.2,0,face);
            g.box(0.5,0.16,0.26,'accent',0,P.r+0.42,0,face);
            const btn=g.cyl(0.11,0.11,0.24,'dark',0,0,0,face);
            btn.position.set(Math.sin(0.8)*(P.r+0.12),Math.cos(0.8)*(P.r+0.12),0);
            btn.rotation.z=-0.8;
            g.box(0.5,0.35,0.5,'dark',0,0.18,0,g.watch);
            const c=document.createElement('canvas');
            c.width=320;
            c.height=140;
            g.lcd=c;
            g.lcdTex=new THREE.CanvasTexture(c);
            g.lcdTex.colorSpace=THREE.NoColorSpace;
            const scr=new THREE.Mesh(new THREE.PlaneGeometry(P.r*P.screen,P.r*P.screen*140/320),iconMaterial(g.lcdTex));
            scr.position.set(0,-0.05,0.21);
            face.add(scr);
            g.scr=scr;
            g.solid([makeBox(wx,wz,P.r,P.depth,0)]);
            g.shown='';
            g.lit=1;
            g.pop=0;
            this.paint(g,'0.00',1,PALETTE.ink);
        },
        paint(g,text,lit,color) {
            const key=text+'|'+lit.toFixed(2)+'|'+color;
            if (key===g.shown) {
                return;
            }
            g.shown=key;
            const x=g.lcd.getContext('2d');
            x.fillStyle=PALETTE.nearGray;
            x.fillRect(0,0,320,140);
            x.globalAlpha=lit;
            x.fillStyle=PALETTE.paper;
            x.fillRect(8,8,304,124);
            x.fillStyle=color;
            x.font='bold 92px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
            x.textAlign='center';
            x.textBaseline='middle';
            x.fillText(text,160,76);
            x.globalAlpha=1;
            g.lcdTex.needsUpdate=true;
        },
        begin(g) {
            const P=g.P;
            g.target=P.target[0]+g.int(P.target[1]-P.target[0]+1);
            g.place(P.watch[0],P.watch[1]+P.front);
            g.phase='count';
            g.pt=0;
            g.beat=-1;
            g.run=0;
            g.fadeAt=g.range(P.fadeAt[0],P.fadeAt[1]);
            g.result=null;
        },
        idle(g,dt) {
            g.pop=Math.max(0,g.pop-dt/g.P.pop);
            const s=1+g.pop*0.25;
            g.scr.scale.set(s,s,1);
        },
        view(g) {
            const F=g.P.frame;
            return {minX:F[0],minZ:F[1],maxX:F[2],maxZ:F[3]};
        },
        canInteract(g) {
            return g.phase==='run';
        },
        prompt(g) {
            return g.phase==='run'?{x:g.P.watch[0],y:g.P.r*2+1.4,z:g.P.watch[1],key:'mg.count.stop'}:null;
        },
        interact(g) {
            this.judge(g,false);
        },
        judge(g,late) {
            const P=g.P;
            const d=Math.abs(g.run-g.target);
            g.result=late?'late':(d<=P.perfect?'perfect':(d<=P.ok?'ok':'fail'));
            g.diff=d;
            g.phase='show';
            g.pt=0;
            g.pop=1;
            const good=g.result==='perfect'||g.result==='ok';
            this.paint(g,g.run.toFixed(2),1,good?PALETTE.ink:PALETTE.red);
            g.sound('bell',good?1.5:0.7);
            const [wx,wz]=P.watch;
            if (good) {
                g.burst(wx,wz+0.6,'red',g.result==='perfect'?28:16,P.r+0.6);
            }
            else {
                g.burst(wx,wz+0.6,'ink',16,P.r+0.6);
            }
            g.talk(t('mg.count.say.'+g.result),P.show+0.6);
        },
        tick(g,dt) {
            const P=g.P;
            if (g.phase==='count') {
                g.pt+=dt;
                const b=Math.floor(g.pt);
                if (b!==g.beat&&b<P.count) {
                    g.beat=b;
                    g.pop=1;
                    g.sound('ui',1.2);
                }
                if (g.pt>=P.count) {
                    g.phase='run';
                    g.run=0;
                    g.pop=1;
                    g.sound('bell',1.3);
                    this.paint(g,'0.00',1,PALETTE.ink);
                    return;
                }
                this.paint(g,String(P.count-b),1,PALETTE.red);
                return;
            }
            if (g.phase==='run') {
                g.run+=dt;
                const lit=1-Math.max(0,Math.min(1,(g.run-g.fadeAt)/P.fadeTime));
                this.paint(g,lit>0?g.run.toFixed(2):'',lit,PALETTE.ink);
                if (g.run>g.target+P.over) {
                    this.judge(g,true);
                }
                return;
            }
            if (g.phase==='show') {
                g.pt+=dt;
                if (g.pt>=P.show) {
                    g.phase='done';
                    if (g.result==='perfect'||g.result==='ok') {
                        g.bonus=g.result==='perfect';
                        g.win();
                    }
                    else {
                        g.lose();
                    }
                }
            }
        },
        info(g) {
            if (g.phase==='show'||g.phase==='done') {
                return {key:'mg.count.result.'+g.result,params:{v:g.run.toFixed(2),d:g.diff.toFixed(2),n:g.target},big:{text:t('mg.count.big.'+g.result),yFrac:g.P.bigY}};
            }
            const big={text:g.phase==='count'?String(g.P.count-Math.max(0,g.beat)):t('mg.count.big',{n:g.target}),yFrac:g.P.bigY};
            return {key:'mg.count.info',params:{n:g.target},big};
        },
        teardown(g) {
            g.lcdTex.dispose();
            g.scr.geometry.dispose();
            g.scr.material.dispose();
        }
    }
};

export class MiniGames {
    constructor(api) {
        this.api=api;
        this.g=null;
        this.running=false;
    }

    setup(id,room,act,flip) {
        this.g=new Kit(this,id,room,act,flip);
        this.running=false;
        GAMES[id].setup(this.g);
    }

    clear() {
        this.g=null;
        this.running=false;
    }

    begin(player) {
        const g=this.g;
        if (!g) {
            return;
        }
        this.running=true;
        g.t=0;
        GAMES[g.id].begin(g,player);
    }

    update(dt,player) {
        const g=this.g;
        if (!g) {
            return;
        }
        const def=GAMES[g.id];
        if (def.idle) {
            def.idle(g,dt,player);
        }
        if (!this.running) {
            return;
        }
        if (g.ended) {
            g.endT-=dt;
            if (g.endT<=0) {
                this.running=false;
                if (def.teardown) {
                    def.teardown(g);
                }
                for (const pc of g.pieces) {
                    g.room.removePiece(pc);
                }
                g.pieces=[];
                this.api.onEnd(g.ok,!!g.bonus);
            }
            return;
        }
        g.t+=dt;
        if (g.limit>0) {
            g.left-=dt;
            if (g.left<=0) {
                g.left=0;
                g.say(player.pos.x,player.pos.z,'mg.timeUp');
                g.lose();
                return;
            }
        }
        if (def.tick) {
            def.tick(g,dt,player);
        }
    }

    hitTarget() {
        const g=this.g;
        if (g&&this.running&&!g.ended&&GAMES[g.id].hit) {
            GAMES[g.id].hit(g);
        }
    }

    view(player) {
        const g=this.g;
        if (!g||!this.running||g.ended) {
            return null;
        }
        const def=GAMES[g.id];
        return def.view?def.view(g,player):null;
    }

    wantsInteract(player) {
        const g=this.g;
        return !!g&&this.running&&!g.ended&&!!GAMES[g.id].canInteract&&GAMES[g.id].canInteract(g,player);
    }

    interact(player) {
        if (!this.wantsInteract(player)) {
            return false;
        }
        GAMES[this.g.id].interact(this.g,player);
        return true;
    }

    prompt(player) {
        const g=this.g;
        if (!g||!this.running||g.ended) {
            return null;
        }
        const def=GAMES[g.id];
        return def.prompt?def.prompt(g,player):null;
    }

    info() {
        const g=this.g;
        if (!g||!this.running) {
            return null;
        }
        if (g.ended) {
            return null;
        }
        const q=GAMES[g.id].info(g);
        const params={...(q.params||{})};
        if (g.limit>0) {
            params.s=Math.ceil(g.left);
        }
        return {key:q.key,params,big:q.big||null};
    }
}
