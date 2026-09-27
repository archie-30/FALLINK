import*as THREE from 'three';
import {PALETTE} from './data/palette.js';
import {TUNING} from './data/tuning.js';
import {LEVELS} from './data/levels.js';
import {ENEMIES} from './data/enemies.js';
import {t} from './data/strings.js';
import {createLoop,time} from './core/loop.js';
import {Input} from './core/input.js';
import {CameraRig} from './core/cameraRig.js';
import {createScene} from './core/scene.js';
import {tweens} from './core/tween.js';
import {fx} from './core/fx.js';
import {detectDevice,loadSettings,saveSettings,settings,qualityConfig,boilScale,device} from './core/settings.js';
import {Renderer} from './render/renderer.js';
import {initMaterials,setBoilSeed,setJitterScale,setShadowQuality,toonMaterial} from './render/materials.js';
import {Particles,MuzzleFlashes,Rings} from './render/particles.js';
import {Preview} from './render/preview.js';
import {Shards} from './render/shards.js';
import {Decals} from './render/decals.js';
import {createPaperTexture,createNoiseTexture} from './render/paperTexture.js';
import {createHatchTexture} from './render/hatching.js';
import {Overlay} from './ui2d/overlay.js';
import {buildRoom} from './game/terrain.js';
import {Player} from './game/player.js';
import {BulletSystem,Lobs} from './game/bullet.js';
import {Ink} from './game/ink.js';
import {Deck} from './game/deck.js';
import {CardEffects} from './game/card.js';
import {STARTING_DECK} from './data/cards.js';
import {CardArt} from './ui2d/cardView.js';
import {Hand} from './ui2d/hand.js';
import {DeckView} from './ui2d/deckView.js';
import {EnemyManager} from './game/enemy.js';
import {Sandbox} from './game/room.js';

const QUALITY_ORDER=['low','mid','high'];

function applyTheme() {
    const root=document.documentElement.style;
    for (const k in PALETTE) {
        root.setProperty('--'+k,PALETTE[k]);
    }
    const meta=document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content',PALETTE.paper);
    }
    document.getElementById('rotate-text').textContent=t('ui.rotate');
}

async function requestFullscreen() {
    const el=document.documentElement;
    if (document.fullscreenElement||!el.requestFullscreen) {
        return;
    }
    try {
        await el.requestFullscreen({navigationUI:'hide'});
        if (screen.orientation&&screen.orientation.lock) {
            await screen.orientation.lock('landscape');
        }
    }
    catch (e) {
    }
}

function boot() {
    detectDevice();
    loadSettings();
    applyTheme();
    const container=document.getElementById('game');
    const renderer=new Renderer(document.getElementById('gl'));
    const textures={
        paper:createPaperTexture(TUNING.paper.texSize),
        noise:createNoiseTexture(256),
        hatch:createHatchTexture(256)
    };
    initMaterials(textures);
    const {scene,world,actors,fxScene}=createScene();
    const room=buildRoom(LEVELS.test,world);
    const player=new Player(actors);
    player.spawn(room.spawn);
    const rig=new CameraRig(1);
    rig.setBounds(room.bounds);
    rig.follow(player.pos,0,0);
    rig.snap();
    fx.init(rig,renderer.post);
    const F=TUNING.feel;
    const W=TUNING.weapon;
    const PT=TUNING.particles;
    const DF=TUNING.damageFx;
    const H=W.height;
    const particles=new Particles(fxScene,500);
    const muzzle=new MuzzleFlashes(fxScene);
    const shards=new Shards(world,toonMaterial({...ENEMIES.doodle.tones.body,jitter:TUNING.boil.vertexJitter,side:THREE.DoubleSide,unique:true}));
    const decals=new Decals(world);
    const playerBullets=new BulletSystem(actors,fxScene,{color:'ink',...TUNING.bullet.player});
    const enemyBullets=new BulletSystem(actors,fxScene,{color:'red',...TUNING.bullet.enemy});
    const E=TUNING.effects;
    const pierceBullets=new BulletSystem(actors,fxScene,{color:'ink',capacity:16,radius:E.pierceRadius,size:E.pierceSize,trailWidth:E.pierceTrail,pierce:true});
    const homingBullets=new BulletSystem(actors,fxScene,{color:'ink',capacity:48,radius:0.22,size:E.homingSize,trailWidth:0.2,homing:E.homingTurn});
    const lobs=new Lobs(actors);
    const rings=new Rings(fxScene);
    const preview=new Preview(fxScene);
    const enemies=new EnemyManager(actors,fxScene);
    const sandbox=new Sandbox(room,enemies);
    const ctx={room,player,playerBullets,enemyBullets,muzzle,particles,enemies:[]};
    const ink=new Ink();
    const seedParam=Number(new URLSearchParams(location.search).get('seed'));
    const deck=new Deck(STARTING_DECK,seedParam||(Date.now()&0xffff));
    const art=new CardArt();
    const deckView=new DeckView();
    const effects=new CardEffects({player,playerBullets,pierceBullets,homingBullets,lobs,enemies,particles,decals,rings,muzzle,fx},TUNING);
    const tmpV=new THREE.Vector3();
    const tmpG=new THREE.Vector3();
    function openDeck() {
        hand.cancelTargeting();
        deckView.show();
        fx.paused=true;
    }
    function closeDeck() {
        deckView.hide();
        fx.paused=false;
    }
    const hand=new Hand({
        deck,
        ink,
        preview,
        playerPos:()=>player.pos,
        aimDir:()=>({x:player.aimDirX,z:player.aimDirZ}),
        screenToGround:(sx,sy,out)=>{
            if (!rig.screenToGround(sx,sy,renderer.width,renderer.height,0,tmpG)) {
                return false;
            }
            out.x=tmpG.x;
            out.z=tmpG.z;
            return true;
        },
        worldToScreen:(x,y,z,out)=>rig.worldToScreen(tmpV.set(x,y,z),renderer.width,renderer.height,out),
        nearestEnemy:(x,z,r)=>{
            const e=enemies.nearest(x,z,r);
            return e?e.pos:null;
        },
        mouseScreen:()=>input.lastDevice==='mouse'&&input.mouse.inside?input.mouse:null,
        execute:(card,target)=>effects.run(card,target),
        openDeck
    });
    deck.events.onDraw=c=>hand.onDraw(c);
    deck.events.onReshuffleStart=n=>hand.onReshuffleStart(n);
    deck.events.onReshuffleEnd=()=>hand.onReshuffleEnd();
    homingBullets.onSeek=(x,z)=>{
        const e=enemies.nearest(x,z,40);
        return e?e.pos:null;
    };
    const hitEnemies=(x,z,r,dmg,vx,vz,sys,i)=>enemies.hitBullet(x,z,r,dmg,vx,vz,sys,i);
    pierceBullets.onHit=hitEnemies;
    homingBullets.onHit=hitEnemies;
    let bleed=0;
    let heart=0;
    playerBullets.onHit=hitEnemies;
    enemyBullets.onHit=(x,z,r,dmg,vx,vz)=>player.hitBullet(x,z,r,dmg,vx,vz);
    playerBullets.onWall=(x,z,vx,vz)=>{
        particles.burst(x,H,z,PT.wallPuff,{color:'nearGray',speed:[1,3.5],up:[1,3],size:[0.06,0.12],life:[0.2,0.4],dirX:-vx,dirZ:-vz,cone:1.3});
    };
    enemyBullets.onWall=(x,z,vx,vz)=>{
        particles.burst(x,H,z,PT.wallPuff,{color:'darkRed',speed:[1,3],up:[1,3],size:[0.07,0.13],life:[0.2,0.4],dirX:-vx,dirZ:-vz,cone:1.3});
    };
    enemies.onHit=(e,x,z,dx,dz,dead)=>{
        if (dead) {
            return;
        }
        ink.add(TUNING.ink.perHit);
        fx.hitStop(F.hitStopHit);
        fx.cameraShake(F.shakeHit);
        fx.fovPunch(F.fovHit);
        particles.burst(x,H,z,PT.inkHit,{color:'ink',dirX:dx,dirZ:dz,cone:0.9,speed:[3,7],up:[1,4]});
    };
    enemies.onKill=(e,dx,dz)=>{
        const x=e.pos.x;
        const z=e.pos.z;
        const D=TUNING.decals;
        ink.add(TUNING.ink.perKill);
        fx.hitStop(F.hitStopKill,true);
        fx.cameraShake(F.shakeKill);
        fx.fovPunch(F.fovKill);
        fx.flash('paper',F.killFlash*3,0.35);
        shards.burst(x,0.9,z,Math.round(e.def.shards[0]+Math.random()*(e.def.shards[1]-e.def.shards[0])),dx,dz,e.def.scale);
        decals.spawn(x+dx*0.6,z+dz*0.6,D.size[0]+Math.random()*(D.size[1]-D.size[0]));
        particles.burst(x,1.0,z,PT.inkKill,{color:'ink',speed:[2,8],up:[2,7],size:[0.1,0.22]});
        particles.burst(x,1.0,z,PT.redKill,{color:'red',dirX:dx,dirZ:dz,cone:0.8,speed:[4,10],up:[1,5],size:[0.08,0.18]});
    };
    player.events.onDash=()=>{
        fx.fovPunch(TUNING.player.dashFovPunch);
        fx.cameraShake(TUNING.player.dashTrauma);
    };
    player.events.onFire=(p,mx,mz)=>{
        muzzle.show(mx,H,mz,'ink',W.flashScale);
        fx.cameraShake(W.recoilTrauma);
        fx.fovPunch(W.recoilFov);
    };
    player.events.onHurt=p=>{
        fx.hitStop(F.hitStopHurt,true);
        fx.cameraShake(F.shakeHurt);
        fx.fovPunch(F.fovHurt);
        bleed=Math.min(1,bleed+DF.bleed);
        particles.burst(p.pos.x,1.0,p.pos.z,PT.redHurt,{color:'red',speed:[2,6],up:[2,6],size:[0.08,0.16]});
    };
    player.events.onDown=p=>{
        fx.invertFrame(8);
        fx.flash('paper',0.6,0.7);
        const revive=()=>{
            p.hp=TUNING.player.maxHp;
            p.invuln=TUNING.player.respawnInvuln;
            enemyBullets.clear();
        };
        tweens.to({},{},{duration:0.3,unscaled:true,onComplete:revive});
    };
    const input=new Input(container);
    const overlay=new Overlay(document.getElementById('ui'));
    ink.events.onChange=d=>overlay.hud.inkChanged(d);
    ink.events.onFail=()=>overlay.hud.inkFail();
    const aim={mode:'none',point:new THREE.Vector3(),dx:0,dz:-1,sx:0,sy:0};
    const look={x:0,z:0};
    function applyQuality() {
        const q=qualityConfig();
        textures.hatch.anisotropy=Math.min(q.anisotropy,renderer.gl.capabilities.getMaxAnisotropy());
        textures.hatch.needsUpdate=true;
        setShadowQuality(q.hatchedShadow);
        particles.setLimit(q.particles);
        renderer.applyQuality();
        renderer.post.setBoilScale(boilScale());
        setJitterScale(boilScale());
    }
    function resize() {
        const w=Math.max(1,window.innerWidth);
        const h=Math.max(1,window.innerHeight);
        renderer.resize(w,h);
        overlay.resize(w,h);
        input.resize(w,h);
        hand.resize(w,h);
        deckView.resize(w,h);
        art.setScale(overlay.dpr*hand.s*1.2);
        rig.setAspect(w/h);
    }
    input.onToggleDebug=()=>{
        overlay.showDebug=!overlay.showDebug;
        settings.showFps=overlay.showDebug;
        saveSettings();
    };
    input.onCycleQuality=()=>{
        const i=QUALITY_ORDER.indexOf(settings.quality);
        settings.quality=QUALITY_ORDER[(i+1)%QUALITY_ORDER.length];
        saveSettings();
        applyQuality();
    };
    input.onToggleLegend=()=>overlay.hud.toggleLegend();
    input.ui={
        down:(x,y,id,type,button)=>{
            if (deckView.open) {
                closeDeck();
                return true;
            }
            if (overlay.hud.hitLegendTitle(x,y)) {
                overlay.hud.toggleLegend();
                return true;
            }
            return hand.down(x,y,id,type,button);
        },
        move:(x,y,id,type)=>hand.move(x,y,id,type),
        up:(x,y,id,type,button)=>hand.up(x,y,id,type,button),
        hover:(x,y)=>hand.hoverAt(x,y),
        leave:()=>hand.leave()
    };
    input.onCardKey=i=>{
        if (!deckView.open) {
            hand.keyPlay(i);
        }
    };
    input.onDeckKey=()=>{
        if (deckView.open) {
            closeDeck();
        }
        else {
            openDeck();
        }
    };
    input.onEscape=()=>{
        if (deckView.open) {
            closeDeck();
        }
        else {
            hand.cancelTargeting();
        }
    };
    input.onFirstTouch=()=>{
        if (device.mobile) {
            requestFullscreen();
        }
    };
    overlay.showDebug=settings.showFps;
    window.addEventListener('resize',resize);
    window.addEventListener('orientationchange',()=>setTimeout(resize,150));
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize',resize);
    }
    resize();
    applyQuality();
    const debugInfo={fps:0,calls:0,triangles:0,quality:'',pixelRatio:1,resolution:''};
    const gameUi={ink,hand,art,deckView,deck};
    function update(dt) {
        player.update(dt,input,ctx,aim);
        enemies.update(dt,ctx);
        playerBullets.update(dt,room);
        enemyBullets.update(dt,room);
        pierceBullets.update(dt,room);
        homingBullets.update(dt,room);
        lobs.update(dt);
        deck.update(dt);
        particles.update(dt);
        shards.update(dt);
        decals.update(dt);
        const e=sandbox.update(dt,player);
        if (e) {
            particles.burst(e.pos.x,0.4,e.pos.z,PT.spawnPuff,{color:'midGray',speed:[1,4],up:[1,4],size:[0.1,0.2],life:[0.3,0.6]});
        }
    }
    function updateDamageFx(dt) {
        bleed=Math.max(0,bleed-DF.bleedDecay*dt);
        let low=0;
        const f=player.hp/TUNING.player.maxHp;
        if (f<DF.lowHp&&player.hp>0) {
            const prev=Math.floor(heart);
            heart+=dt*DF.heartRate;
            if (Math.floor(heart)!==prev) {
                fx.fovPunch(DF.heartFov);
            }
            low=DF.lowBase+DF.lowPulse*Math.pow(Math.max(0,Math.sin(heart*Math.PI*2)),2);
        }
        renderer.post.uniforms.uBleed.value=Math.max(bleed,low);
    }
    function render(dt,alpha) {
        fx.update(dt);
        tweens.update(dt*time.timeScale,dt);
        setBoilSeed(time.boilIndex);
        player.sync(alpha);
        enemies.sync(alpha,dt);
        playerBullets.render(alpha);
        enemyBullets.render(alpha);
        pierceBullets.render(alpha);
        homingBullets.render(alpha);
        lobs.render(alpha);
        particles.render();
        rings.update(dt*time.timeScale);
        preview.update(dt);
        hand.update(dt);
        deckView.update(dt);
        shards.render();
        muzzle.update(dt);
        overlay.hud.update(dt,player,ink);
        updateDamageFx(dt);
        const L=TUNING.camera;
        let lx=0;
        let lz=0;
        if (aim.mode==='point') {
            lx=(aim.point.x-player.renderPos.x)*L.mouseLookFactor;
            lz=(aim.point.z-player.renderPos.z)*L.mouseLookFactor;
            const l=Math.hypot(lx,lz);
            if (l>L.lookAhead) {
                lx*=L.lookAhead/l;
                lz*=L.lookAhead/l;
            }
        }
        else if (aim.mode==='dir') {
            lx=aim.dx*L.lookAhead;
            lz=aim.dz*L.lookAhead;
        }
        else {
            lx=player.vel.x/TUNING.player.speed*L.lookAhead*0.5;
            lz=player.vel.z/TUNING.player.speed*L.lookAhead*0.5;
        }
        const k=1-Math.exp(-5*dt);
        look.x+=(lx-look.x)*k;
        look.z+=(lz-look.z)*k;
        rig.follow(player.renderPos,look.x,look.z);
        rig.update(dt);
        input.getAim(aim);
        if (aim.mode==='point') {
            if (!rig.screenToGround(aim.sx,aim.sy,renderer.width,renderer.height,TUNING.player.aimHeight,aim.point)) {
                aim.mode='none';
            }
        }
        renderer.render(scene,fxScene,rig.camera);
        const st=renderer.stats();
        debugInfo.fps=time.fps;
        debugInfo.calls=st.calls;
        debugInfo.triangles=st.triangles;
        debugInfo.quality=settings.quality;
        debugInfo.pixelRatio=renderer.pixelRatio;
        debugInfo.resolution=renderer.post.target.width+'×'+renderer.post.target.height;
        overlay.draw(input,player,debugInfo,gameUi);
    }
    const loop=createLoop(update,render);
    loop.start();
    art.warm(deck.drawPile);
    deck.start();
    window.INKFALL={hand,deck,ink,effects,deckView,renderer,scene,fxScene,rig,player,input,room,settings,time,applyQuality,enemies,playerBullets,enemyBullets,particles,fx};
}

boot();
