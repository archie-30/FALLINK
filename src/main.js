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
import {Player,Clone} from './game/player.js';
import {BulletSystem,Lobs} from './game/bullet.js';
import {Ink} from './game/ink.js';
import {Deck} from './game/deck.js';
import {CardEffects} from './game/card.js';
import {STARTING_DECK,ALL_CARDS} from './data/cards.js';
import {CardArt} from './ui2d/cardView.js';
import {Hand} from './ui2d/hand.js';
import {DeckView} from './ui2d/deckView.js';
import {EnemyManager} from './game/enemy.js';
import {Run} from './game/run.js';
import {RewardView} from './ui2d/reward.js';
import {RunSummary,MainMenu,PauseMenu,SettingsMenu,Codex} from './ui2d/menu.js';
import {audio} from './core/audio.js';
import {LAYOUTS} from './data/levels.js';
import {renderFlags} from './render/materials.js';
import {Transition} from './ui2d/transition.js';

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
    const game={room:null,mode:'menu'};
    let menuAngle=0;
    const player=new Player(actors);
    player.spawn(new THREE.Vector3(0,0,4));
    const rig=new CameraRig(1);
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
    const enemyShards=new Map();
    function shardsFor(e) {
        const key=e.type+'|'+e.def.shardTone;
        let sh=enemyShards.get(key);
        if (!sh) {
            sh=new Shards(world,toonMaterial({...e.def.tones[e.def.shardTone],jitter:TUNING.boil.vertexJitter,side:THREE.DoubleSide,unique:true}),e.def.boss?64:40);
            enemyShards.set(key,sh);
        }
        return sh;
    }
    const decals=new Decals(world);
    const terrainShards=new Shards(world,toonMaterial({light:'farGray',mid:'midGray',dark:'nearGray',jitter:TUNING.boil.vertexJitter,side:THREE.DoubleSide,unique:true}),48);
    const paperShards=new Shards(world,toonMaterial({light:'paper',mid:'farGray',dark:'midGray',jitter:TUNING.boil.vertexJitter,side:THREE.DoubleSide,unique:true}),24);
    const clones=[new Clone(fxScene),new Clone(fxScene)];
    const playerBullets=new BulletSystem(actors,fxScene,{color:'ink',...TUNING.bullet.player});
    const enemyBullets=new BulletSystem(actors,fxScene,{color:'red',owner:'enemy',...TUNING.bullet.enemy});
    const E=TUNING.effects;
    const pierceBullets=new BulletSystem(actors,fxScene,{color:'ink',capacity:16,radius:E.pierceRadius,size:E.pierceSize,trailWidth:E.pierceTrail,pierce:true});
    const homingBullets=new BulletSystem(actors,fxScene,{color:'ink',capacity:48,radius:0.22,size:E.homingSize,trailWidth:0.2,homing:E.homingTurn});
    const lobs=new Lobs(actors);
    const rings=new Rings(fxScene);
    const preview=new Preview(fxScene);
    const enemies=new EnemyManager(actors,fxScene);
    const ctx={room:null,player,playerBullets,enemyBullets,muzzle,particles,fx,lobs,enemies:[]};
    const ink=new Ink();
    const seedParam=Number(new URLSearchParams(location.search).get('seed'));
    const deckParam=new URLSearchParams(location.search).get('deck');
    const startIds=()=>deckParam==='all'?ALL_CARDS:STARTING_DECK;
    const deck=new Deck(startIds(),seedParam||(Date.now()&0xffff));
    const art=new CardArt();
    const deckView=new DeckView();
    ctx.enemyMgr=enemies;
    const effects=new CardEffects({player,playerBullets,pierceBullets,homingBullets,enemyBullets,lobs,enemies,particles,decals,rings,muzzle,fx,room:null,clones,ink,scene:actors,fxScene},TUNING);
    ctx.onPuddle=(x,z,r,dur,slow)=>{
        game.room.zones.addPuddle(x,z,r,dur,slow);
        decals.spawn(x,z,r*3.2,'ink','nearGray');
        particles.burst(x,0.3,z,12,{color:'ink',speed:[2,5],up:[2,5],size:[0.1,0.2]});
        fx.cameraShake(0.2);
    };
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
        execute:(card,target)=>{
            effects.run(card,target);
            audio.play(card.def.id==='pencilWall'?'wall':(card.def.type==='terrain'?'erase':'card'));
        },
        openDeck,
        onPlayStart:()=>{
            audio.play('card');
            if (run.stats) {
                run.stats.cards++;
            }
        }
    });
    deck.events.onDraw=c=>{
        hand.onDraw(c);
        audio.play('draw',0.9+Math.random()*0.3);
    };
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
    enemyBullets.onWall=(x,z,vx,vz,col)=>{
        if (col&&col.piece) {
            game.room.damagePiece(col.piece,1);
        }
        particles.burst(x,H,z,PT.wallPuff,{color:'darkRed',speed:[1,3],up:[1,3],size:[0.07,0.13],life:[0.2,0.4],dirX:-vx,dirZ:-vz,cone:1.3});
    };
    enemies.onHit=(e,x,z,dx,dz,dead,quiet,crit)=>{
        if (dead) {
            return;
        }
        ink.add(TUNING.ink.perHit);
        audio.play('hit',crit?1.5:0.9+Math.random()*0.2);
        if (crit) {
            particles.burst(x,1.4,z,5,{color:'red',dirX:dx,dirZ:dz,cone:1.2,speed:[3,7],up:[2,5]});
            fx.cameraShake(0.12);
        }
        if (quiet) {
            particles.burst(x,0.8,z,2,{color:'ink',speed:[1,3],up:[1,3]});
            return;
        }
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
        audio.play(e.def.boss?'boss':'kill',0.8+Math.random()*0.4);
        fx.hitStop(F.hitStopKill,true);
        fx.cameraShake(F.shakeKill);
        fx.fovPunch(F.fovKill);
        fx.flash('paper',F.killFlash*3,0.35);
        if (run.stats) {
            run.stats.kills++;
        }
        const sh=shardsFor(e);
        const n=Math.round(e.def.shards[0]+Math.random()*(e.def.shards[1]-e.def.shards[0]));
        if (e.def.boss) {
            for (let i=0;i<4;i++) {
                sh.burst(x+Math.cos(i*1.57)*1.2,1.5+i*0.8,z+Math.sin(i*1.57)*1.2,Math.ceil(n/4),dx,dz,2.2);
                if (i%2===0) {
                    decals.spawn(x+Math.cos(i*1.57+0.7)*2.0,z+Math.sin(i*1.57+0.7)*2.0,2.6);
                }
            }
            fx.slowMo(0.3,1.0);
            fx.invertFrame(4);
            fx.cameraShake(1.0);
            enemyBullets.killWhere(()=>true,null);
            for (const o of enemies.list.slice()) {
                enemies.damage(o,99999,0,0,true);
            }
        }
        else {
            sh.burst(x,0.9,z,n,dx,dz,e.def.scale);
        }
        decals.spawn(x+dx*0.6,z+dz*0.6,D.size[0]+Math.random()*(D.size[1]-D.size[0]));
        particles.burst(x,1.0,z,PT.inkKill,{color:'ink',speed:[2,8],up:[2,7],size:[0.1,0.22]});
        particles.burst(x,1.0,z,PT.redKill,{color:'red',dirX:dx,dirZ:dz,cone:0.8,speed:[4,10],up:[1,5],size:[0.08,0.18]});
    };
    player.events.onDash=()=>{
        fx.fovPunch(TUNING.player.dashFovPunch);
        fx.cameraShake(TUNING.player.dashTrauma);
    };
    player.events.onFire=(p,mx,mz)=>{
        audio.play('shoot',0.85+Math.random()*0.3);
        muzzle.show(mx,H,mz,'ink',W.flashScale);
        fx.cameraShake(W.recoilTrauma);
        fx.fovPunch(W.recoilFov);
    };
    player.events.onHurt=p=>{
        audio.play('hurt');
        fx.hitStop(F.hitStopHurt,true);
        fx.cameraShake(F.shakeHurt);
        fx.fovPunch(F.fovHurt);
        bleed=Math.min(1,bleed+DF.bleed);
        if (run.stats) {
            run.stats.damage++;
        }
        particles.burst(p.pos.x,1.0,p.pos.z,PT.redHurt,{color:'red',speed:[2,6],up:[2,6],size:[0.08,0.16]});
    };
    player.events.onShield=(p,idx,dx,dz)=>{
        fx.hitStop(60,true);
        fx.cameraShake(0.25);
        paperShards.burst(p.pos.x-dx*0.8,1.0,p.pos.z-dz*0.8,4,-dx,-dz,0.8);
        particles.burst(p.pos.x,1.0,p.pos.z,6,{color:'farGray',speed:[2,5],up:[2,4]});
    };
    const onBreak=piece=>{
        fx.cameraShake(0.2);
        particles.burst(piece.x,0.8,piece.z,10,{color:'midGray',speed:[2,5],up:[2,5]});
    };
    player.events.onDown=()=>run.playerDown();
    const reward=new RewardView();
    const summary=new RunSummary();
    const transition=new Transition();
    function allShards() {
        return [...enemyShards.values(),terrainShards,paperShards];
    }
    function clearWorld() {
        enemies.clear();
        playerBullets.clear();
        enemyBullets.clear();
        pierceBullets.clear();
        homingBullets.clear();
        lobs.clear();
        particles.clear();
        for (const sh of allShards()) {
            sh.clear();
        }
        decals.clear();
        for (const c of clones) {
            c.stop();
        }
        effects.sweeps.length=0;
        effects.eraserMesh.visible=false;
        effects.redrawLine.visible=false;
        preview.hide();
        renderer.post.invertHold.value=0;
    }
    function enterRoom(plan,deckList) {
        clearWorld();
        renderer.post.resetDeath();
        renderer.post.drawIn(TUNING.transition.drawIn,transition.active?TUNING.transition.drawInDelay:0);
        if (game.room) {
            game.room.destroy();
        }
        const r=buildRoom(plan.layout,world,fxScene);
        r.shards=terrainShards;
        r.onBreak=onBreak;
        game.room=r;
        ctx.room=r;
        effects.g.room=r;
        enemies.hpMult=plan.hpMult;
        enemies.act=plan.act;
        player.enterRoom(r.spawn);
        rig.setBounds(r.bounds);
        look.x=0;
        look.z=0;
        rig.follow(player.pos,0,0);
        rig.snap();
        hand.reset();
        deck.reset(deckList);
        deck.start();
        fx.paused=false;
        return r;
    }
    const run=new Run({
        enemies,
        enterRoom,
        banner:(kind,rn)=>{
            const p=rn.plan;
            if (kind==='boss') {
                overlay.hud.banner(t('run.bossTitle',{name:t('enemy.inkBottle')}),t('run.bossSub',{act:p.act+1}),2.6);
            }
            else {
                overlay.hud.banner(t('run.roomTitle',{act:p.act+1,page:p.index+1}),t('run.roomSub'),2.0);
            }
        },
        onSpawn:e=>{
            particles.burst(e.pos.x,0.4,e.pos.z,e.def.boss?30:PT.spawnPuff,{color:'midGray',speed:[1,4],up:[1,4],size:[0.1,0.2],life:[0.3,0.6]});
        },
        onCleared:plan=>{
            audio.play('clear');
            enemyBullets.killWhere(()=>true,(x,z)=>particles.burst(x,1.0,z,1,{color:'farGray',speed:[0.5,2],up:[1,2]}));
            fx.slowMo(0.4,0.6);
            if (plan.boss) {
                const heal=TUNING.run.bossHeal;
                player.hp=Math.min(TUNING.player.maxHp,player.hp+heal);
                overlay.hud.banner(t('run.cleared'),t('run.healed',{hp:heal}),1.6);
            }
            else {
                overlay.hud.banner(t('run.cleared'),'',1.3);
            }
        },
        openReward:(cards,cb)=>{
            fx.paused=true;
            hand.cancelTargeting();
            art.warm(cards);
            const d=hand.drawRect;
            reward.show(cards,run.plan.boss?t('reward.bossTitle'):t('reward.title'),cb,{x:d.x+d.w/2,y:d.y+d.h/2});
        },
        transition:mid=>{
            audio.play('page');
            transition.run(mid);
        },
        onDeath:()=>{
            audio.play('death');
            renderer.post.death();
            fx.slowMo(0.25,1.4);
            fx.invertFrame(10);
            fx.flash('paper',0.5,0.5);
            fx.cameraShake(0.8);
        },
        showSummary:(victory,stats)=>{
            fx.paused=true;
            hand.cancelTargeting();
            summary.show(victory,stats,toMenu=>{
                audio.play('ui');
                player.hp=TUNING.player.maxHp;
                ink.value=TUNING.ink.start;
                renderer.post.resetDeath();
                if (toMenu) {
                    enterMenu();
                }
                else {
                    run.start(startIds());
                }
            });
        }
    },seedParam||(Date.now()&0xffff));
    function enterMenu() {
        clearWorld();
        renderer.post.resetDeath();
        if (game.room) {
            game.room.destroy();
        }
        const r=buildRoom(LAYOUTS.crossroads,world,fxScene);
        r.shards=terrainShards;
        r.onBreak=onBreak;
        game.room=r;
        ctx.room=r;
        effects.g.room=r;
        player.enterRoom(new THREE.Vector3(0,0,1.5));
        player.aimYaw=0.6;
        enemies.hpMult=1;
        enemies.spawn('doodle',-4,-3,{quick:true}).yaw=2.4;
        enemies.spawn('blob',5,-2,{quick:true});
        enemies.spawn('compass',-7,4,{quick:true});
        hand.reset();
        deck.reset([]);
        run.state='idle';
        run.plan=null;
        game.mode='menu';
        fx.paused=true;
        pauseMenu.hide();
        summary.open=false;
        reward.open=false;
        mainMenu.show();
        renderer.post.drawIn(1.6,0.2);
    }
    function startGame() {
        audio.play('ui');
        mainMenu.hide();
        game.mode='play';
        player.hp=TUNING.player.maxHp;
        ink.value=TUNING.ink.start;
        run.start(startIds());
    }
    function openPause() {
        if (game.mode!=='play'||pauseMenu.open||summary.open||reward.open||transition.active) {
            return;
        }
        audio.play('ui');
        hand.cancelTargeting();
        deckView.hide();
        pauseMenu.show();
        fx.paused=true;
    }
    function closePause() {
        audio.play('ui');
        pauseMenu.hide();
        fx.paused=false;
    }
    let settingsReturn=null;
    function openSettings(from) {
        audio.play('ui');
        settingsReturn=from;
        settingsMenu.show();
    }
    function settingsChanged() {
        saveSettings();
        applyQuality();
        audio.setVolume(settings.volume);
        overlay.showDebug=settings.showFps;
    }
    const mainMenu=new MainMenu({
        start:startGame,
        settings:()=>openSettings('menu'),
        codex:()=>{
            audio.play('ui');
            codex.show();
        }
    });
    const pauseMenu=new PauseMenu({
        resume:closePause,
        settings:()=>openSettings('pause'),
        quit:()=>{
            audio.play('ui');
            enterMenu();
        }
    });
    const settingsMenu=new SettingsMenu({
        changed:settingsChanged,
        back:()=>{
            audio.play('ui');
            settingsMenu.hide();
        }
    });
    const codex=new Codex({
        back:()=>{
            audio.play('ui');
            codex.hide();
        }
    });
    const menus=[mainMenu,pauseMenu,settingsMenu,codex];
    const input=new Input(container);
    const overlay=new Overlay(document.getElementById('ui'));
    ink.events.onChange=d=>overlay.hud.inkChanged(d);
    ink.events.onFail=()=>{
        overlay.hud.inkFail();
        audio.play('fail');
    };
    const aim={mode:'none',point:new THREE.Vector3(),dx:0,dz:-1,sx:0,sy:0};
    const look={x:0,z:0};
    const bias={x:0,z:0};
    function applyQuality() {
        const q=qualityConfig();
        textures.hatch.anisotropy=Math.min(q.anisotropy,renderer.gl.capabilities.getMaxAnisotropy());
        textures.hatch.needsUpdate=true;
        setShadowQuality(q.hatchedShadow);
        particles.setLimit(q.particles);
        renderFlags.hulls=q.hulls!==false;
        player.root.traverse(o=>{
            if (o.name==='hull') {
                o.visible=renderFlags.hulls;
            }
        });
        renderer.applyQuality();
        overlay.resize(overlay.width,overlay.height);
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
        reward.resize(w,h);
        summary.resize(w,h);
        for (const m of menus) {
            m.resize(w,h);
        }
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
            audio.unlock();
            if (settingsMenu.open) {
                return settingsMenu.down(x,y);
            }
            if (codex.open) {
                return codex.down(x,y);
            }
            if (mainMenu.open) {
                return mainMenu.down(x,y);
            }
            if (pauseMenu.open) {
                return pauseMenu.down(x,y);
            }
            if (summary.open) {
                return summary.down(x,y);
            }
            if (reward.open) {
                return reward.down(x,y);
            }
            if (transition.active) {
                return true;
            }
            if (deckView.open) {
                closeDeck();
                return true;
            }
            if (overlay.hud.hitPause(x,y,overlay.width)) {
                openPause();
                return true;
            }
            if (overlay.hud.hitLegendTitle(x,y)) {
                overlay.hud.toggleLegend();
                return true;
            }
            return hand.down(x,y,id,type,button);
        },
        move:(x,y,id,type)=>{
            if (settingsMenu.open) {
                settingsMenu.move(x,y);
                return;
            }
            hand.move(x,y,id,type);
        },
        up:(x,y,id,type,button)=>{
            settingsMenu.up();
            hand.up(x,y,id,type,button);
        },
        hover:(x,y)=>{
            for (const m of menus) {
                if (m.open) {
                    m.hover(x,y);
                }
            }
            reward.hoverAt(x,y);
            hand.hoverAt(x,y);
        },
        leave:()=>hand.leave()
    };
    input.onCardKey=i=>{
        if (!deckView.open&&!reward.open&&!summary.open&&run.state==='combat') {
            hand.keyPlay(i);
        }
    };
    input.onDeckKey=()=>{
        if (reward.open||summary.open) {
            return;
        }
        if (deckView.open) {
            closeDeck();
        }
        else {
            openDeck();
        }
    };
    input.onEscape=()=>{
        audio.unlock();
        if (settingsMenu.open) {
            settingsMenu.hide();
            return;
        }
        if (codex.open) {
            codex.hide();
            return;
        }
        if (pauseMenu.open) {
            closePause();
            return;
        }
        if (deckView.open) {
            closeDeck();
            return;
        }
        if (hand.targetView||hand.press) {
            hand.cancelTargeting();
            return;
        }
        openPause();
    };
    input.onPauseKey=()=>{
        if (pauseMenu.open) {
            closePause();
        }
        else {
            openPause();
        }
    };
    window.addEventListener('keydown',()=>audio.unlock());
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
    const gameUi={ink,hand,art,deckView,deck,run,enemies,reward,summary,transition,dt:0,mode:'menu',mainMenu,pause:pauseMenu,settingsMenu,codex};
    function update(dt) {
        if (run.state!=='dead') {
            player.update(dt,input,ctx,aim);
        }
        enemies.update(dt,ctx);
        const room=game.room;
        playerBullets.update(dt,room);
        enemyBullets.update(dt,room);
        pierceBullets.update(dt,room);
        homingBullets.update(dt,room);
        lobs.update(dt);
        deck.update(dt);
        room.update(dt,enemies);
        effects.update(dt);
        for (const c of clones) {
            c.update(dt,ctx);
        }
        for (const sh of allShards()) {
            sh.update(dt);
        }
        particles.update(dt);
        decals.update(dt);
        if (game.mode==='play') {
            run.update(dt,player);
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
        for (const sh of allShards()) {
            sh.render();
        }
        reward.update(dt);
        summary.update(dt);
        transition.update(dt);
        for (const m of menus) {
            m.update(dt);
        }
        gameUi.dt=dt;
        gameUi.mode=game.mode;
        for (const c of clones) {
            c.sync(alpha);
        }
        const inv=renderer.post.invertHold;
        const invTarget=enemyBullets.frozen>0?1:0;
        inv.value+=(invTarget-inv.value)*(1-Math.exp(-dt/TUNING.effects.timeStopFade*3));
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
        const bossE=enemies.boss();
        let bx=0;
        let bz=0;
        if (bossE) {
            bx=(bossE.renderPos.x-player.renderPos.x)*TUNING.camera.bossBias;
            bz=(bossE.renderPos.z-player.renderPos.z)*TUNING.camera.bossBias;
        }
        bias.x+=(bx-bias.x)*(1-Math.exp(-3*dt));
        bias.z+=(bz-bias.z)*(1-Math.exp(-3*dt));
        if (game.mode==='menu') {
            menuAngle+=dt*0.12;
            const cam=rig.camera;
            cam.position.set(Math.sin(menuAngle)*24,15,Math.cos(menuAngle)*24);
            cam.lookAt(0,0.5,0);
            if (cam.fov!==TUNING.camera.fov) {
                cam.fov=TUNING.camera.fov;
                cam.updateProjectionMatrix();
            }
            cam.updateMatrixWorld();
        }
        else {
            rig.follow(player.renderPos,look.x+bias.x,look.z+bias.z);
            rig.update(dt);
        }
        input.getAim(aim);
        if (aim.mode==='point') {
            if (!rig.screenToGround(aim.sx,aim.sy,renderer.width,renderer.height,TUNING.player.aimHeight,aim.point)) {
                aim.mode='none';
            }
        }
        renderer.render(scene,fxScene,rig.camera);
        if (transition.state==='capture') {
            transition.capture(renderer.gl.domElement,renderer.width,renderer.height);
        }
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
    enterMenu();
    window.INKFALL={transition,hand,deck,ink,effects,deckView,renderer,scene,fxScene,rig,player,input,game,run,reward,summary,settings,time,applyQuality,enemies,playerBullets,enemyBullets,particles,fx};
}

boot();
