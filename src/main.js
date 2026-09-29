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
import {initMaterials,setBoilSeed,setJitterScale,setShadowQuality,toonMaterial,shared} from './render/materials.js';
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
import {CardEffects,createCard} from './game/card.js';
import {STARTING_DECK,ALL_CARDS,CARDS,isUlt,unlockedCards} from './data/cards.js';
import {progress,loadProgress,addXp,markSeen,godMode,effectiveLevel} from './core/progress.js';
import {CardArt} from './ui2d/cardView.js';
import {Hand} from './ui2d/hand.js';
import {DeckView} from './ui2d/deckView.js';
import {EnemyManager} from './game/enemy.js';
import {Run} from './game/run.js';
import {Pickups} from './game/pickup.js';
import {RNG} from './core/rng.js';
import {RewardView} from './ui2d/reward.js';
import {UpgradeView} from './ui2d/upgrade.js';
import {RunSummary,MainMenu,PauseMenu,SettingsMenu,Codex,TrainingPicker,LevelView,SkinEditor,TrainingMenu} from './ui2d/menu.js';
import {DEFAULT_SKIN} from './data/skins.js';
import {EASE} from './core/easing.js';
import {UltCutin} from './ui2d/ultCutin.js';
import {audio} from './core/audio.js';
import {ENDLESS,MENU_SCENE} from './data/levels.js';
import {renderFlags} from './render/materials.js';
import {Transition} from './ui2d/transition.js';
import {DamageNumbers} from './ui2d/damageNumbers.js';

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
    loadProgress();
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
    player.applySkin({...DEFAULT_SKIN,...settings.skin});
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
    const dangerRings=new Rings(fxScene,12);
    const preview=new Preview(fxScene);
    const enemies=new EnemyManager(actors,fxScene);
    const ctx={dangerRings:null,room:null,player,playerBullets,enemyBullets,muzzle,particles,fx,lobs,enemies:[]};
    const ink=new Ink();
    const seedParam=Number(new URLSearchParams(location.search).get('seed'));
    const deckParam=new URLSearchParams(location.search).get('deck');
    const startIds=()=>deckParam==='all'?ALL_CARDS:STARTING_DECK;
    const deck=new Deck(startIds(),seedParam||(Date.now()&0xffff));
    const art=new CardArt();
    const deckView=new DeckView();
    ctx.enemyMgr=enemies;
    const effects=new CardEffects({player,playerBullets,pierceBullets,homingBullets,enemyBullets,lobs,enemies,particles,decals,rings,muzzle,fx,room:null,clones,ink,scene:actors,fxScene},TUNING);
    ctx.dangerRings=dangerRings;
    ctx.onInkDrop=(x,z,r,dur,slow)=>{
        game.room.zones.addPuddle(x,z,r,dur,slow);
        decals.spawn(x,z,r*1.7,'ink','nearGray');
        particles.burst(x,0.3,z,10,{speed:[2,5],up:[3,6],size:[0.1,0.2]});
        audio.play('drop');
    };
    ctx.onPuddle=(x,z,r,dur,slow)=>{
        game.room.zones.addPuddle(x,z,r,dur,slow);
        decals.spawn(x,z,r*3.2,'ink','nearGray');
        particles.burst(x,0.3,z,12,{color:'ink',speed:[2,5],up:[2,5],size:[0.1,0.2]});
        fx.cameraShake(0.2);
    };
    const tmpV=new THREE.Vector3();
    const tmpG=new THREE.Vector3();
    const ultCutin=new UltCutin();
    let pickerReturn=null;
    let trainFixed=[];
    const trainStats={total:0,max:0,last:0,lastT:0,kills:0,cards:0,hurt:0,hurtT:0,log:[],start:0};
    function resetTrainStats() {
        Object.assign(trainStats,{total:0,max:0,last:0,lastT:0,kills:0,cards:0,hurt:0,hurtT:0,log:[],start:time.real});
    }
    function trainPool(rare) {
        return unlockedCards(effectiveLevel()).filter(id=>isUlt(id)===rare);
    }
    function pickRandom(list,n) {
        const a=list.slice();
        const out=[];
        while (out.length<n&&a.length>0) {
            out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]);
        }
        return out;
    }
    function trainProvider() {
        if (run.mode!=='training') {
            return null;
        }
        if (settings.training.refill==='fixed') {
            const have=deck.hand.map(c=>c.id);
            for (const f of trainFixed) {
                const k=have.indexOf(f.id);
                if (k>=0) {
                    have.splice(k,1);
                    continue;
                }
                if (isUlt(f.id)?deck.ultCard():deck.normalCount()>=TUNING.deck.handSize) {
                    continue;
                }
                return createCard(f.id,f.upgraded);
            }
        }
        if (!deck.ultCard()) {
            const rare=trainPool(true);
            if (rare.length>0) {
                return createCard(rare[Math.floor(Math.random()*rare.length)]);
            }
        }
        return null;
    }
    function trainRandomPick() {
        trainPick(pickRandom(trainPool(false),TUNING.deck.handSize).concat(pickRandom(trainPool(true),1)),false);
    }
    function openPicker(start=false) {
        hand.cancelTargeting();
        trainingPicker.startMode=start;
        pickerReturn=trainingMenu.open?'training':null;
        if (trainingMenu.open) {
            trainingMenu.hide();
        }
        audio.play('ui');
        trainingPicker.show();
        fx.paused=true;
    }
    function closePicker(resume) {
        if (trainingPicker.startMode&&!resume) {
            trainRandomPick();
            return;
        }
        trainingPicker.hide();
        if (pickerReturn==='training'&&!resume) {
            pickerReturn=null;
            trainingMenu.show();
            return;
        }
        pickerReturn=null;
        trainingPicker.startMode=false;
        fx.paused=false;
        input.mouse.down=false;
    }
    function trainPick(ids,upgraded) {
        const normals=ids.filter(id=>!isUlt(id));
        const ult=ids.find(id=>isUlt(id));
        trainFixed=ids.map(id=>({id,upgraded}));
        if (normals.length>0) {
            const old=hand.normals().filter(v=>v.state==='idle'||v.state==='draw');
            const drop=Math.max(0,Math.min(old.length,deck.normalCount()+normals.length-TUNING.deck.handSize));
            for (let k=0;k<drop;k++) {
                hand.discardView(old[k]);
            }
        }
        if (ult) {
            const u=hand.ultView();
            if (u) {
                hand.discardView(u);
            }
        }
        const names=[];
        for (const id of normals.concat(ult?[ult]:[])) {
            const card=createCard(id,upgraded);
            deck.hand.push(card);
            hand.onDraw(card);
            names.push(t(card.def.nameKey)+(upgraded?'+':''));
        }
        overlay.hud.toast(t('training.picked',{name:names.join('、')}));
        audio.play('card');
        closePicker(true);
    }
    function openTrainingMenu() {
        hand.cancelTargeting();
        audio.play('ui');
        trainingMenu.show();
        fx.paused=true;
    }
    function closeTrainingMenu() {
        audio.play('ui');
        trainingMenu.hide();
        fx.paused=false;
        input.mouse.down=false;
        input.dashQueued=false;
        if (trainingMenu.pendingRoom) {
            trainingMenu.pendingRoom=false;
            run.enter();
        }
    }
    function openDeck() {
        if (run.mode==='training'&&game.mode==='play') {
            openPicker();
            return;
        }
        hand.cancelTargeting();
        deckView.returnPause=pauseMenu.open;
        if (pauseMenu.open) {
            audio.play('ui');
            pauseMenu.hide();
        }
        deckView.show();
        fx.paused=true;
    }
    function closeDeck() {
        deckView.hide();
        if (deckView.returnPause) {
            deckView.returnPause=false;
            deckView.onClosed=()=>{
                if (game.mode==='play'&&!summary.open) {
                    pauseMenu.show();
                }
            };
            return;
        }
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
            if (card.def.rarity==='rare') {
                ultCutin.play(card);
                fx.slowMo(TUNING.ultFx.slow,TUNING.ultFx.slowTime);
                audio.play('ult');
            }
            effects.run(card,target);
            audio.play(card.def.id==='pencilWall'?'wall':(card.def.type==='terrain'?'erase':'card'));
        },
        openDeck,
        showKeys:()=>input.lastDevice==='mouse'&&!device.mobile,
        onPlayStart:()=>{
            audio.play('card');
            if (run.stats) {
                run.stats.cards++;
            }
            if (run.mode==='training') {
                trainStats.cards++;
            }
        }
    });
    deck.events.onDraw=c=>{
        hand.onDraw(c);
        audio.play('draw',0.9+Math.random()*0.3);
    };
    deck.events.onReshuffleStart=n=>hand.onReshuffleStart(n);
    deck.events.onBurn=c=>hand.onBurn(c);
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
    const playerWall=(x,z,vx,vz,col)=>{
        if (col&&col.piece&&(col.piece.kind==='barrel'||col.piece.kind==='crate')) {
            game.room.damagePiece(col.piece,W.damage);
        }
        particles.burst(x,H,z,PT.wallPuff,{color:'nearGray',speed:[1,3.5],up:[1,3],size:[0.06,0.12],life:[0.2,0.4],dirX:-vx,dirZ:-vz,cone:1.3});
    };
    playerBullets.onWall=playerWall;
    pierceBullets.onWall=playerWall;
    homingBullets.onWall=playerWall;
    enemyBullets.onWall=(x,z,vx,vz,col)=>{
        if (col&&col.piece) {
            game.room.damagePiece(col.piece,1);
        }
        particles.burst(x,H,z,PT.wallPuff,{color:'darkRed',speed:[1,3],up:[1,3],size:[0.07,0.13],life:[0.2,0.4],dirX:-vx,dirZ:-vz,cone:1.3});
    };
    const dmgNums=new DamageNumbers();
    enemies.onDamage=(e,dmg,crit)=>{
        dmgNums.spawn(e.pos.x,e.def.height*0.9,e.pos.z,dmg,crit);
        if (run.mode==='training') {
            trainStats.total+=dmg;
            trainStats.max=Math.max(trainStats.max,dmg);
            trainStats.last=dmg;
            trainStats.lastT=1;
            trainStats.log.push({t:time.real,dmg});
        }
    };
    enemies.onHit=(e,x,z,dx,dz,dead,quiet,crit)=>{
        if (dead) {
            return;
        }
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
    enemies.onSpawned=e=>{
        if (game.mode==='play') {
            markSeen(e.type);
        }
    };
    enemies.onKill=(e,dx,dz)=>{
        const x=e.pos.x;
        const z=e.pos.z;
        const D=TUNING.decals;
        ink.add((e.def.ink||1)*(e.elite?TUNING.ink.eliteMult:1));
        if (run.mode==='training') {
            trainStats.kills++;
        }
        audio.play(e.def.boss?'boss':'kill',0.8+Math.random()*0.4);
        fx.hitStop(F.hitStopKill,true);
        fx.cameraShake(F.shakeKill);
        fx.fovPunch(F.fovKill);
        fx.flash('paper',F.killFlash*3,0.35);
        if (run.stats) {
            run.addScore(e.def.boss?ENDLESS.scoreBoss:ENDLESS.scoreKill*(e.def.cost||1)*(e.elite?TUNING.elite.score:1));
            run.stats.kills++;
            run.stats.xp+=e.def.boss?TUNING.levels.xpBoss:TUNING.levels.xpKill*(e.def.cost||1);
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
    player.events.onReload=()=>audio.play('reload');
    player.events.onDash=()=>{
        audio.play('dash');
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
        if (run.mode==='training') {
            trainStats.hurt++;
            trainStats.hurtT=1;
        }
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
    const pickups=new Pickups(actors);
    const floatText=(x,z,text)=>{
        dmgNums.spawnText(x,1.6,z,text);
    };
    const onPropBreak=piece=>{
        const P=TUNING.props;
        if (piece.kind==='barrel') {
            audio.play('kill',0.6);
            enemies.damageRadius(piece.x,piece.z,P.barrelRadius,P.barrelDamage);
            if (Math.hypot(player.pos.x-piece.x,player.pos.z-piece.z)<P.barrelRadius*0.7) {
                player.hurt(1,player.pos.x-piece.x,player.pos.z-piece.z);
            }
            rings.spawn(piece.x,piece.z,P.barrelRadius,'ink',0.35);
            decals.spawn(piece.x,piece.z,P.barrelRadius*1.4,'ink','midGray');
            particles.burst(piece.x,0.6,piece.z,30,{speed:[3,10],up:[3,9],size:[0.12,0.28],life:[0.4,0.9]});
            fx.hitStop(70,true);
            fx.cameraShake(0.5);
            fx.fovPunch(1.6);
            const px=piece.x;
            const pz=piece.z;
            tweens.delay(0.12,()=>{
                if (game.room) {
                    game.room.damageProps(px,pz,P.barrelRadius,P.barrelDamage);
                }
            });
        }
        else {
            audio.play('wall',1.4);
            const r=Math.random();
            if (r<0.5) {
                pickups.spawn('ink',piece.x,piece.z);
            }
            else if (r<0.8) {
                pickups.spawn('heal',piece.x,piece.z);
            }
            particles.burst(piece.x,0.6,piece.z,10,{color:'farGray',speed:[2,5],up:[2,5]});
        }
    };
    const onBreak=piece=>{
        fx.cameraShake(0.2);
        particles.burst(piece.x,0.8,piece.z,10,{color:'midGray',speed:[2,5],up:[2,5]});
    };
    player.events.onDown=()=>run.playerDown();
    const reward=new RewardView();
    const upgradeView=new UpgradeView();
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
        dmgNums.clear();
        pickups.clear();
        for (const c of clones) {
            c.stop();
        }
        effects.clear();
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
        const r=buildRoom(plan.layout,world,fxScene,{rng:new RNG(plan.act*100+plan.index*7+Math.floor(Math.random()*1000)),barrels:plan.barrels||0,crates:plan.crates||0});
        r.shards=terrainShards;
        r.onBreak=onBreak;
        r.onPropBreak=onPropBreak;
        game.mod=plan.mod||null;
        const M=TUNING.fog.mist;
        shared.uFog.value.set(TUNING.fog.near,TUNING.fog.far,TUNING.fog.max);
        shared.uMistK.value=game.mod==='dark'?M.max:0;
        shared.uMist.value.set(r.spawn.x,r.spawn.z,M.near,M.far);
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
            if (kind==='training') {
                overlay.hud.banner(t('training.title'),t('training.sub'),2.2);
            }
            else if (kind==='boss') {
                overlay.hud.banner(t('run.bossTitle',{name:t('enemy.'+p.bossType)}),p.endless?t('run.endlessBossSub'):t('run.bossSub',{act:p.act+1}),2.6);
            }
            else {
                const title=p.endless?t('run.endlessTitle',{page:p.index+1}):t('run.roomTitle',{act:p.act+1,page:p.index+1});
                const parts=[];
                if (p.fresh) {
                    parts.push(t('run.newEnemy',{name:t('enemy.'+p.fresh)}));
                }
                if (p.mod) {
                    parts.push(t('mod.'+p.mod));
                }
                overlay.hud.banner(title,parts.length>0?parts.join('　｜　'):t('run.roomSub'),parts.length>0?2.2+parts.length*0.6:2.0);
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
        onMerge:(id,done)=>{
            art.warm([createCard(id),createCard(id,true)]);
            audio.play('clear',0.8);
            upgradeView.show(id,done);
        },
        openReward:(groups,counts,cb)=>{
            fx.paused=true;
            hand.cancelTargeting();
            for (const g of groups) {
                art.warm(g.cards);
            }
            const d=hand.drawRect;
            reward.show(groups,run.plan.boss?t('reward.bossTitle'):t('reward.title'),counts,cb,{x:d.x+d.w/2,y:d.y+d.h/2});
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
        showSummary:(victory,stats,quit=false)=>{
            fx.paused=true;
            hand.cancelTargeting();
            const lvBefore=progress.level;
            const bestKey=run.mode==='endless'?'bestScore':'bestStory';
            if (run.mode==='endless') {
                stats.xp+=stats.score*TUNING.levels.xpScore;
            }
            stats.mode=run.mode;
            if (godMode()) {
                stats.newBest=false;
                stats.best=progress[bestKey];
                summary.progress={god:true,xp:0,before:lvBefore,after:lvBefore,unlocked:[]};
            }
            else {
                stats.newBest=stats.score>progress[bestKey];
                progress[bestKey]=Math.max(progress[bestKey],stats.score);
                stats.best=progress[bestKey];
                const res=addXp(stats.xp);
                summary.progress={xp:Math.round(stats.xp),before:lvBefore,after:progress.level,unlocked:res.unlocked.map(id=>t(CARDS[id].nameKey))};
            }
            summary.show(victory,stats,quit,toMenu=>{
                audio.play('ui');
                player.hp=TUNING.player.maxHp;
                ink.value=TUNING.ink.start;
                renderer.post.resetDeath();
                if (toMenu) {
                    enterMenu();
                }
                else {
                    run.start(startIds(),run.mode);
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
        const M=MENU_SCENE;
        const r=buildRoom(M.layout,world,fxScene,{rng:new RNG(M.seed),barrels:M.barrels,crates:M.crates});
        r.shards=terrainShards;
        r.onBreak=onBreak;
        game.mod=null;
        shared.uFog.value.set(TUNING.fog.near,TUNING.fog.far,TUNING.fog.max);
        shared.uMistK.value=0;
        game.room=r;
        ctx.room=r;
        effects.g.room=r;
        player.enterRoom(new THREE.Vector3(0,0,1.5));
        player.invuln=0;
        player.aimYaw=0.6;
        enemies.hpMult=1;
        for (const [type,x,z,yaw] of M.enemies) {
            enemies.spawn(type,x,z,{quick:true}).yaw=yaw;
        }
        for (const [x,z,size] of M.decals) {
            decals.spawn(x,z,size,'ink','midGray');
        }
        hand.reset();
        ultCutin.active=null;
        deck.provider=null;
        deck.reset([]);
        run.state='idle';
        run.plan=null;
        game.mode='menu';
        fx.paused=true;
        pauseMenu.hide();
        summary.open=false;
        reward.open=false;
        upgradeView.open=false;
        mainMenu.show();
        renderer.post.drawIn(1.6,0.2);
    }
    function startGame(mode='story') {
        audio.play('ui');
        mainMenu.hide();
        game.mode='play';
        player.hp=TUNING.player.maxHp;
        ink.value=TUNING.ink.start;
        trainFixed=[];
        resetTrainStats();
        deck.provider=mode==='training'?trainProvider:null;
        run.start(startIds(),mode);
        if (mode==='training') {
            openPicker(true);
        }
    }
    function openPause() {
        if (game.mode==='play'&&run.mode==='training'&&!trainingMenu.open&&!trainingPicker.open&&!transition.active) {
            openTrainingMenu();
            return;
        }
        if (game.mode!=='play'||pauseMenu.open||summary.open||reward.open||upgradeView.open||transition.active) {
            return;
        }
        audio.play('ui');
        hand.cancelTargeting();
        deckView.hide();
        pauseMenu.training=run.mode==='training';
        pauseMenu.show();
        fx.paused=true;
    }
    function closePause() {
        audio.play('ui');
        pauseMenu.hide();
        fx.paused=false;
        input.mouse.down=false;
        input.dashQueued=false;
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
        input.resize(input.width,input.height);
    }
    const mainMenu=new MainMenu({
        start:()=>startGame('story'),
        endless:()=>startGame('endless'),
        settings:()=>openSettings('menu'),
        codex:()=>{
            audio.play('ui');
            codex.show();
        },
        training:()=>startGame('training'),
        skin:()=>{
            audio.play('ui');
            mainMenu.hide();
            skinEditor.show();
        },
        levels:()=>{
            audio.play('ui');
            levelView.show();
        }
    });
    const skinEditor=new SkinEditor({
        changed:skin=>{
            player.applySkin(skin);
            saveSettings();
        },
        select:()=>audio.play('ui'),
        back:()=>{
            audio.play('ui');
            skinEditor.hide();
            mainMenu.show();
        }
    });
    const levelView=new LevelView({
        back:()=>{
            audio.play('ui');
            levelView.hide();
        }
    });
    const trainingMenu=new TrainingMenu({
        select:()=>audio.play('ui'),
        changed:kind=>{
            saveSettings();
            if (run.mode!=='training'||!run.director||!run.director.configure) {
                return;
            }
            if (kind==='foes') {
                run.director.configure(settings.training);
            }
            else if (kind==='attack') {
                run.director.setAttack(settings.training.attack);
            }
            else if (kind==='immortal') {
                run.director.setImmortal(settings.training.immortal);
            }
            else if (kind==='refill') {
                deck.requestDraw(0.2);
            }
        },
        resume:closeTrainingMenu,
        pick:openPicker,
        reset:()=>{
            resetTrainStats();
            overlay.hud.toast(t('trainMenu.resetDone'));
        },
        settings:()=>openSettings('training'),
        leave:()=>{
            trainingMenu.hide();
            trainingMenu.pendingRoom=false;
            run.quit();
            enterMenu();
        }
    });
    const trainingPicker=new TrainingPicker({
        pick:trainPick,
        random:trainRandomPick,
        select:()=>audio.play('ui'),
        back:()=>{
            audio.play('ui');
            closePicker(false);
        }
    });
    const pauseMenu=new PauseMenu({
        resume:closePause,
        deck:openDeck,
        codex:()=>{
            audio.play('ui');
            codex.show();
        },
        settings:()=>openSettings('pause'),
        quit:()=>{
            audio.play('ui');
            pauseMenu.hide();
            if (transition.active||!run.quit()) {
                enterMenu();
            }
        }
    });
    const settingsMenu=new SettingsMenu({
        changed:settingsChanged,
        select:()=>audio.play('ui'),
        back:()=>{
            audio.play('ui');
            settingsMenu.hide();
        }
    });
    const codex=new Codex({
        select:()=>audio.play('ui'),
        back:()=>{
            audio.play('ui');
            codex.hide();
        }
    });
    const menus=[mainMenu,pauseMenu,settingsMenu,codex,levelView,trainingPicker,skinEditor,trainingMenu];
    const input=new Input(container);
    const overlay=new Overlay(document.getElementById('ui'));
    ink.events.onChange=d=>overlay.hud.inkChanged(d);
    ink.events.onFail=()=>{
        overlay.hud.inkFail();
        audio.play('fail');
    };
    const aim={mode:'none',point:new THREE.Vector3(),dx:0,dz:-1,sx:0,sy:0};
    const look={x:0,z:0};
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
        time.freezeBoil=settings.reducedMotion;
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
        upgradeView.resize(w,h);
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
    input.ui={
        down:(x,y,id,type,button)=>{
            audio.unlock();
            if (settingsMenu.open) {
                return settingsMenu.down(x,y);
            }
            if (codex.open) {
                return codex.down(x,y);
            }
            if (levelView.open) {
                return levelView.down(x,y);
            }
            if (skinEditor.open) {
                return skinEditor.down(x,y);
            }
            if (trainingPicker.open) {
                return trainingPicker.down(x,y,type);
            }
            if (trainingMenu.open) {
                return trainingMenu.down(x,y);
            }
            if (mainMenu.open) {
                return mainMenu.down(x,y);
            }
            if (pauseMenu.open) {
                const hc=type==='mouse'?null:hand.hitCard(x,y);
                if (hc) {
                    hand.hover=hand.hover===hc?null:hc;
                    return true;
                }
                if (hand.inRect(hand.drawRect,x,y)||hand.inRect(hand.discardRect,x,y)) {
                    openDeck();
                    return true;
                }
                return pauseMenu.down(x,y);
            }
            if (summary.open) {
                return summary.down(x,y);
            }
            if (upgradeView.open) {
                return upgradeView.down(x,y);
            }
            if (reward.open) {
                return reward.down(x,y);
            }
            if (transition.active) {
                return true;
            }
            if (deckView.open) {
                if (!deckView.tap(x,y,type)) {
                    closeDeck();
                }
                return true;
            }
            if (overlay.hud.hitPause(x,y,overlay.width)) {
                openPause();
                return true;
            }
            return hand.down(x,y,id,type,button);
        },
        move:(x,y,id,type)=>{
            if (settingsMenu.open) {
                settingsMenu.move(x,y);
                return;
            }
            if (codex.open) {
                codex.move(x,y);
                return;
            }
            if (levelView.open) {
                levelView.move(x,y);
                return;
            }
            if (skinEditor.open) {
                skinEditor.move(x,y);
                return;
            }
            if (trainingPicker.open) {
                trainingPicker.move(x,y);
                return;
            }
            hand.move(x,y,id,type);
        },
        up:(x,y,id,type,button)=>{
            settingsMenu.up();
            codex.up(x,y);
            levelView.up();
            skinEditor.up();
            trainingPicker.up(x,y);
            hand.up(x,y,id,type,button);
        },
        hover:(x,y)=>{
            for (const m of menus) {
                if (m.open) {
                    m.hover(x,y);
                }
            }
            reward.hoverAt(x,y);
            deckView.hover(x,y);
            hand.hoverAt(x,y,pauseMenu.open);
        },
        leave:()=>hand.leave()
    };
    input.onCardKey=i=>{
        if (!deckView.open&&!trainingPicker.open&&!trainingMenu.open&&!reward.open&&!summary.open&&!pauseMenu.open&&run.state==='combat') {
            hand.keyPlay(i);
        }
    };
    input.onDeckKey=()=>{
        if (reward.open||upgradeView.open||summary.open||codex.open||settingsMenu.open||game.mode!=='play') {
            return;
        }
        if (trainingPicker.open) {
            closePicker(false);
        }
        else if (deckView.open) {
            closeDeck();
        }
        else {
            openDeck();
        }
    };
    input.onEscape=()=>{
        audio.unlock();
        if (settingsMenu.open) {
            if (!settingsMenu.closeKeys()) {
                settingsMenu.hide();
            }
            return;
        }
        if (codex.open) {
            if (!codex.closeDetail()) {
                codex.hide();
            }
            return;
        }
        if (levelView.open) {
            levelView.hide();
            return;
        }
        if (skinEditor.open) {
            skinEditor.actions.back();
            return;
        }
        if (trainingPicker.open) {
            closePicker(false);
            return;
        }
        if (trainingMenu.open) {
            closeTrainingMenu();
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
    input.onWheel=dy=>{
        codex.wheel(dy);
        levelView.wheel(dy);
        trainingPicker.wheel(dy);
    };
    input.canStick=()=>game.mode==='play'&&!pauseMenu.open&&!deckView.open&&!trainingPicker.open&&!trainingMenu.open&&!reward.open&&!upgradeView.open&&!summary.open&&!transition.active&&!settingsMenu.open&&!codex.open;
    input.onAimRelease=(vx,vy,mag,tap)=>{
        if (hand.targetView&&run.state==='combat'&&input.canStick()) {
            hand.stickCast(vx,vy,mag,tap);
        }
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
    const projectFn=(x,y,z,out)=>rig.worldToScreen(tmpV.set(x,y,z),renderer.width,renderer.height,out);
    const gameUi={dmgNums,project:projectFn,ink,hand,art,deckView,deck,run,enemies,reward,upgradeView,summary,transition,dt:0,mode:'menu',mainMenu,pause:pauseMenu,settingsMenu,codex,levelView,trainingPicker,skinEditor,trainingMenu,trainStats,ultCutin};
    let aimTarget=null;
    function applyAimAssist() {
        const A=TUNING.aimAssist;
        if (!settings.aimAssist||game.mode!=='play'||hand.targetView||hand.press) {
            aimTarget=null;
            gameUi.aimTarget=null;
            return;
        }
        if (aim.mode==='point') {
            const px=aim.point.x;
            const pz=aim.point.z;
            if (aimTarget&&(!aimTarget.alive||Math.hypot(aimTarget.renderPos.x-px,aimTarget.renderPos.z-pz)>A.release+aimTarget.def.radius)) {
                aimTarget=null;
            }
            if (!aimTarget) {
                let bd=Infinity;
                for (const e of enemies.list) {
                    if (e.state==='spawn') {
                        continue;
                    }
                    const d=Math.hypot(e.renderPos.x-px,e.renderPos.z-pz)-e.def.radius;
                    if (d<A.acquire&&d<bd) {
                        bd=d;
                        aimTarget=e;
                    }
                }
            }
            if (aimTarget) {
                aim.point.x+=(aimTarget.renderPos.x-aim.point.x)*A.strength;
                aim.point.z+=(aimTarget.renderPos.z-aim.point.z)*A.strength;
            }
        }
        else if (aim.mode==='dir') {
            aimTarget=null;
            let best=A.stickCone;
            const a0=Math.atan2(aim.dz,aim.dx);
            for (const e of enemies.list) {
                if (e.state==='spawn') {
                    continue;
                }
                const dx=e.renderPos.x-player.renderPos.x;
                const dz=e.renderPos.z-player.renderPos.z;
                if (Math.hypot(dx,dz)>A.stickRange) {
                    continue;
                }
                let da=Math.atan2(dz,dx)-a0;
                while (da>Math.PI) {
                    da-=Math.PI*2;
                }
                while (da<-Math.PI) {
                    da+=Math.PI*2;
                }
                if (Math.abs(da)<best) {
                    best=Math.abs(da);
                    aimTarget=e;
                }
            }
            if (aimTarget) {
                const dx=aimTarget.renderPos.x-player.renderPos.x;
                const dz=aimTarget.renderPos.z-player.renderPos.z;
                const l=Math.hypot(dx,dz)||1;
                const nx=aim.dx+(dx/l-aim.dx)*A.stickStrength;
                const nz=aim.dz+(dz/l-aim.dz)*A.stickStrength;
                const nl=Math.hypot(nx,nz)||1;
                aim.dx=nx/nl;
                aim.dz=nz/nl;
            }
        }
        else {
            aimTarget=null;
        }
        gameUi.aimTarget=aimTarget;
    }
    let bossDropT=0;
    function updateBossDrops(dt) {
        const B=TUNING.bossDrop;
        if (game.mode!=='play'||run.state!=='combat'||!run.plan||!run.plan.boss) {
            bossDropT=B.first;
            return;
        }
        bossDropT-=dt;
        if (bossDropT>0) {
            return;
        }
        bossDropT=B.interval[0]+Math.random()*(B.interval[1]-B.interval[0]);
        if (pickups.items.filter(q=>q.active&&q.type==='ink').length>=B.max) {
            return;
        }
        for (let i=0;i<8;i++) {
            const s=game.room.freeSpot(dropRng);
            if (s&&Math.hypot(s.x-player.pos.x,s.z-player.pos.z)>=B.minPlayerDist) {
                pickups.spawn('ink',s.x,s.z,B.ink);
                rings.spawn(s.x,s.z,1.2,'ink',0.4);
                particles.burst(s.x,2.5,s.z,8,{speed:[1,3],up:[-4,-1],size:[0.08,0.14]});
                return;
            }
        }
    }
    const dropRng=new RNG(4242);
    let skinZoom=0;
    const NO_AIM={mode:'none'};
    function update(dt) {
        if (run.state!=='dead') {
            player.update(dt,input,ctx,skinEditor.shown()?NO_AIM:aim);
        }
        shared.uMist.value.x+=(player.pos.x-shared.uMist.value.x)*Math.min(1,dt*TUNING.fog.mist.follow);
        shared.uMist.value.y+=(player.pos.z-shared.uMist.value.y)*Math.min(1,dt*TUNING.fog.mist.follow);
        if (run.mode==='training'&&game.mode==='play') {
            player.hp=TUNING.player.maxHp;
            if (ink.value<TUNING.training.ink) {
                ink.value=TUNING.training.ink;
            }
            if (settings.training.ammo) {
                player.ammo=TUNING.weapon.magazine;
            }
            trainStats.lastT=Math.max(0,trainStats.lastT-dt*3);
            trainStats.hurtT=Math.max(0,trainStats.hurtT-dt*1.5);
            const cut=time.real-TUNING.training.dpsWindow;
            while (trainStats.log.length>0&&trainStats.log[0].t<cut) {
                trainStats.log.shift();
            }
        }
        const hurry=game.mod==='hurry'&&game.mode==='play'?1.25:1;
        enemies.update(dt*hurry,ctx);
        pickups.update(dt,player,(type,x,z,amount)=>{
            const P=TUNING.props;
            audio.play('clear',1.5);
            if (type==='ink') {
                const n=amount||P.pickupInk;
                ink.add(n);
                floatText(x,z,t('pickup.ink',{n}));
            }
            else {
                player.hp=Math.min(TUNING.player.maxHp,player.hp+P.pickupHeal);
                floatText(x,z,t('pickup.heal',{n:P.pickupHeal}));
            }
            particles.burst(x,1,z,10,{color:type==='ink'?'ink':'farGray',speed:[1,3],up:[2,5]});
        });
        updateBossDrops(dt);
        const room=game.room;
        playerBullets.update(dt,room);
        enemyBullets.update(dt*hurry,room);
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
    let slowT=0;
    function updatePerf(dt) {
        const P=TUNING.perf;
        if (!device.mobile||game.mode!=='play'||fx.paused||settings.quality==='low') {
            return;
        }
        slowT=time.fps<P.lowFps?slowT+dt:Math.max(0,slowT-dt*0.5);
        if (slowT>P.window) {
            slowT=0;
            settings.quality=settings.quality==='high'?'mid':'low';
            saveSettings();
            applyQuality();
            resize();
            overlay.hud.toast(t('perf.lowered'));
        }
    }
    function render(dt,alpha) {
        fx.update(dt);
        tweens.update(dt*time.timeScale,dt);
        setBoilSeed(time.boilIndex);
        if (skinEditor.shown()) {
            const a=menuAngle+skinEditor.dragYaw;
            player.faceDir(Math.sin(a),Math.cos(a));
            player.moveYaw=a;
        }
        player.sync(alpha);
        enemies.sync(alpha,dt);
        playerBullets.render(alpha);
        enemyBullets.render(alpha);
        pierceBullets.render(alpha);
        homingBullets.render(alpha);
        lobs.render(alpha);
        particles.render();
        rings.update(dt*time.timeScale);
        dangerRings.update(dt*time.timeScale);
        preview.update(dt);
        const touchCast=input.lastDevice==='touch'&&!!hand.targetView;
        input.aimForCard=touchCast;
        hand.stickAim(input.aim.vx,input.aim.vy,input.aim.mag,input.aim.id>=0,touchCast);
        hand.update(dt,pauseMenu.open||deckView.open);
        updatePerf(dt);
        deckView.update(dt);
        for (const sh of allShards()) {
            sh.render();
        }
        dmgNums.update(dt*Math.max(time.timeScale,fx.paused?0:0.25));
        reward.update(dt);
        upgradeView.update(dt);
        summary.update(dt);
        transition.update(dt);
        for (const m of menus) {
            m.update(dt);
        }
        ultCutin.update(fx.paused?0:dt);
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
        const viewFrozen=game.mode==='play'&&(fx.paused||pauseMenu.open||deckView.open);
        if (!viewFrozen) {
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
        }
        if (game.mode==='menu') {
            const S=TUNING.ui.skinCam;
            skinZoom+=((skinEditor.open?1:0)-skinZoom)*(1-Math.exp(-S.follow*dt));
            menuAngle+=dt*0.12*(1-skinZoom);
            const cam=rig.camera;
            const z=EASE.easeInOutCubic(skinZoom);
            const sa=Math.sin(menuAngle);
            const ca=Math.cos(menuAngle);
            const p=player.renderPos;
            cam.position.set(sa*24+(p.x+sa*S.dist-sa*24)*z,15+(S.height-15)*z,ca*24+(p.z+ca*S.dist-ca*24)*z);
            cam.lookAt((p.x-ca*S.shift)*z,0.5+(S.look-0.5)*z,(p.z+sa*S.shift)*z);
            if (cam.fov!==TUNING.camera.fov) {
                cam.fov=TUNING.camera.fov;
                cam.updateProjectionMatrix();
            }
            cam.updateMatrixWorld();
        }
        else if (!viewFrozen) {
            rig.follow(player.renderPos,look.x,look.z);
            rig.update(dt);
        }
        input.getAim(aim);
        if (aim.mode==='point') {
            if (!rig.screenToGround(aim.sx,aim.sy,renderer.width,renderer.height,TUNING.player.aimHeight,aim.point)) {
                aim.mode='none';
            }
        }
        applyAimAssist();
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
    const loader=document.getElementById('loader');
    if (loader) {
        setTimeout(()=>{
            loader.classList.add('done');
            setTimeout(()=>loader.remove(),TUNING.ui.loaderFade*1000);
        },TUNING.ui.loaderMin*1000);
    }
    art.warm(deck.drawPile);
    enterMenu();
    window.INKFALL={audio,ultCutin,trainingMenu,trainStats,skinEditor,trainingPicker,levelView,transition,hand,deck,ink,effects,deckView,renderer,scene,fxScene,rig,player,input,game,run,reward,upgradeView,pickups,summary,codex,pauseMenu,mainMenu,settingsMenu,settings,time,applyQuality,enemies,playerBullets,enemyBullets,particles,fx};
}

boot();
