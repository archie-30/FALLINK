import*as THREE from 'three';
import {PALETTE} from './data/palette.js';
import {TUNING} from './data/tuning.js';
import {LEVELS} from './data/levels.js';
import {ENEMIES} from './data/enemies.js';
import {t,setTouchText,setLang} from './data/strings.js';
import {createLoop,time} from './core/loop.js';
import {Input} from './core/input.js';
import {CameraRig} from './core/cameraRig.js';
import {createScene} from './core/scene.js';
import {tweens} from './core/tween.js';
import {fx} from './core/fx.js';
import {isFlagship,wipeStorage,detectDevice,loadSettings,saveSettings,settings,autoDrop,qualityConfig,boilScale,device,TRAINING_DEFAULTS,TRAINING_SPAWN} from './core/settings.js';
import {Renderer} from './render/renderer.js';
import {initMaterials,setBoilSeed,setJitterScale,setShadowQuality,toonMaterial,shared,dissolveVariant} from './render/materials.js';
import {Particles,MuzzleFlashes,Rings,FloorMarks} from './render/particles.js';
import {Preview} from './render/preview.js';
import {Shards} from './render/shards.js';
import {Decals} from './render/decals.js';
import {createPaperTexture,createNoiseTexture} from './render/paperTexture.js';
import {createHatchTexture} from './render/hatching.js';
import {Overlay} from './ui2d/overlay.js';
import {buildRoom} from './game/terrain.js';
import {Player,Clone} from './game/player.js';
import {BulletSystem,Lobs} from './game/bullet.js';
import {BrushStrokes,Beam} from './game/weaponFx.js';
import {circleVs} from './core/collision.js';
import {Ink} from './game/ink.js';
import {Deck} from './game/deck.js';
import {CardEffects,createCard,cardParams} from './game/card.js';
import {STARTING_DECK,ALL_CARDS,CARDS,isUlt,unlockedCards,TUTORIAL_MERGE} from './data/cards.js';
import {progress,loadProgress,addXp,markSeen,markBeaten,markBossIntro,godMode,effectiveLevel,xpToNext} from './core/progress.js';
import {CardArt} from './ui2d/cardView.js';
import {Hand} from './ui2d/hand.js';
import {DeckView} from './ui2d/deckView.js';
import {EnemyManager} from './game/enemy.js';
import {Run} from './game/run.js';
import {Pickups} from './game/pickup.js';
import {RNG} from './core/rng.js';
import {RewardView} from './ui2d/reward.js';
import {UpgradeView} from './ui2d/upgrade.js';
import {RelicGacha} from './ui2d/gacha.js';
import {RunSummary,MainMenu,PauseMenu,SettingsMenu,Codex,TrainingPicker,LevelView,SkinEditor,TrainingMenu,Coach,LangPicker,InfoPopup,ChoicePanel,DeckPicker,LevelUpView,drawWeaponIcon} from './ui2d/menu.js';
import {weaponUnlocked,pickWeapon,unlockedWeapons,RANDOM_WEAPON,WEAPONS,WEAPON_ORDER} from './data/weapons.js';
import {initMeta,gradeOf,grantCoins,clampSkin,grantLevelChest,setGate,setAchHold,bump,setMax,addKind,flushMeta,metaDirty,achQueue,grant,buy,buyAll,presetMissing,checkAch,claimAchChest,runChestCount,reviveReady,spendRevive,earnDots,modeSeen,markModeSeen,pullRelic} from './core/meta.js';
import {startRelic,relic,takeGuard,hasRelic,flashRelic,tickRelics,dmgMult,killRelic,pageRelic,perfectRelic,dripRelic,usePhoenix,inkMaxBonus,cardRelic,holdRelic,lowHp,relicState,restoreRelic,addRelic,removeRelic,gamblerMult} from './game/relic.js';
import {saveRunSnap,loadRunSnap,clearRunSnap} from './core/runSave.js';
import {GuidePopup,courseGuide,modeGuide,modesGuide,relicGuide,coinGuide} from './ui2d/guide.js';
import {BuyPrompt,ChestView,AchievementView,RevivePopup,AchToast,ConfirmPopup} from './ui2d/meta.js';
import {EASE} from './core/easing.js';
import {UltCutin} from './ui2d/ultCutin.js';
import {audio} from './core/audio.js';
import {music} from './core/music.js';
import {ENDLESS,MENU_SCENE} from './data/levels.js';
import {renderFlags} from './render/materials.js';
import {Transition} from './ui2d/transition.js';
import {DamageNumbers} from './ui2d/damageNumbers.js';
import {Doors,doorXs} from './game/doors.js';
import {Npcs} from './game/npc.js';
import {MiniGames} from './game/minigames.js';
import {checkForUpdate} from './core/appUpdate.js';
import {WorldMarks} from './ui2d/worldMarks.js';
import {VERSION} from './data/version.js';

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
    document.getElementById('rotate-ver').textContent=VERSION.stage+' '+VERSION.number;
}

function exitFullscreen() {
    if (document.fullscreenElement&&document.exitFullscreen) {
        document.exitFullscreen().catch(()=>{});
    }
}

async function requestFullscreen() {
    const el=document.documentElement;
    if (document.fullscreenElement||!el.requestFullscreen) {
        return;
    }
    try {
        await el.requestFullscreen({navigationUI:'hide'});
        if (navigator.keyboard&&navigator.keyboard.lock) {
            navigator.keyboard.lock(['Escape']).catch(()=>{});
        }
        if (screen.orientation&&screen.orientation.lock) {
            await screen.orientation.lock('landscape');
        }
    }
    catch (e) {
    }
}

function boot() {
    function applyLang() {
        setLang(settings.lang);
        document.documentElement.lang=settings.lang==='en'?'en':'zh-Hant';
    }
    detectDevice();
    loadSettings();
    if (!TUNING.langPick.showLang) {
        settings.lang='zh';
    }
    if (!settings.langChosen&&settings.tutorialSeen) {
        settings.langChosen=true;
    }
    applyLang();
    loadProgress();
    initMeta();
    flushMeta();
    settings.skin=clampSkin(settings.skin);
    applyTheme();
    settings.aimGuide=settings.aimAssist;
    time.fpsCap=settings.fpsAuto?0:settings.fpsCap;
    let fpsProbe=settings.fpsAuto?{t:0,peak:0}:null;
    const probeFps=dt=>{
        if (!fpsProbe) {
            return;
        }
        const L=TUNING.loop;
        fpsProbe.t+=dt;
        fpsProbe.peak=Math.max(fpsProbe.peak,time.fps);
        if (fpsProbe.t<L.autoProbe) {
            return;
        }
        const weak=device.mobile&&(navigator.hardwareConcurrency||4)<L.weakCores;
        const top=isFlagship(fpsProbe.peak);
        const max=weak?L.fpsOptions[0]:(device.mobile?(top?L.flagshipMax:L.mobileMax):L.fpsOptions[L.fpsOptions.length-1]);
        settings.fpsCap=L.fpsOptions.filter(q=>q<=Math.min(fpsProbe.peak+L.autoMargin,max)).pop()||L.fpsOptions[0];
        time.fpsCap=settings.fpsCap;
        fpsProbe=null;
        if (device.mobile&&settings.qualityAuto) {
            const q=top?'high':(weak?'low':'mid');
            if (q!==settings.quality) {
                settings.quality=q;
                autoDrop.base=null;
                applyQuality();
                resize();
            }
        }
        saveSettings();
    };
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
    let randT=0;
    let quietEquip=false;
    const player=new Player(actors);
    player.applySkin(clampSkin(settings.skin));
    const equipWeapon=(play=false)=>{
        const lv=effectiveLevel();
        let id=weaponUnlocked(settings.weapon,lv)?settings.weapon:'pen';
        if (id===RANDOM_WEAPON.id) {
            id=play?pickWeapon(lv,settings.lastWeapon):(weaponUnlocked(settings.lastWeapon,lv)&&settings.lastWeapon!==RANDOM_WEAPON.id?settings.lastWeapon:'pen');
        }
        player.setWeapon(id);
        if (play) {
            settings.lastWeapon=id;
            saveSettings();
        }
    };
    player.spawn(new THREE.Vector3(0,0,4));
    const rig=new CameraRig(1);
    if (device.mobile) {
        rig.setPitch(TUNING.camera.mobilePitch,TUNING.camera.mobileDistance);
    }
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
            shardList=null;
        }
        return sh;
    }
    const decals=new Decals(world);
    const doors=new Doors(fxScene,particles);
    const npcs=new Npcs();
    const marks=new WorldMarks();
    doors.onClose=()=>fx.cameraShake(0.15);
    doors.onOpen=()=>audio.play('clear',1.3);
    const terrainShards=new Shards(world,toonMaterial({light:'farGray',mid:'midGray',dark:'nearGray',jitter:TUNING.boil.vertexJitter,side:THREE.DoubleSide,unique:true}),48);
    const paperShards=new Shards(world,toonMaterial({light:'paper',mid:'farGray',dark:'midGray',jitter:TUNING.boil.vertexJitter,side:THREE.DoubleSide,unique:true}),24);
    const clones=[new Clone(fxScene),new Clone(fxScene)];
    const puppet=new Clone(fxScene);
    const allClones=[...clones,puppet];
    const playerBullets=new BulletSystem(actors,fxScene,{color:'ink',...TUNING.bullet.player});
    const enemyBullets=new BulletSystem(actors,fxScene,{color:'red',owner:'enemy',...TUNING.bullet.enemy});
    const chalkBullets=new BulletSystem(actors,fxScene,TUNING.bullet.chalk);
    const E=TUNING.effects;
    const pierceBullets=new BulletSystem(actors,fxScene,{color:'ink',capacity:16,radius:E.pierceRadius,size:E.pierceSize,trailWidth:E.pierceTrail,pierce:true,thruWalls:true});
    const homingBullets=new BulletSystem(actors,fxScene,{color:'ink',capacity:48,radius:0.22,size:E.homingSize,trailWidth:0.2,homing:E.homingTurn});
    const WB=TUNING.weaponFx;
    const weaponSys={player:playerBullets};
    for (const k in WB) {
        weaponSys[k]=new BulletSystem(actors,fxScene,WB[k]);
    }
    const extraSys=Object.keys(WB).map(k=>weaponSys[k]);
    weaponSys.compass.target=player.renderPos;
    const strokes=new BrushStrokes(fxScene,'ink');
    const beam=new Beam(fxScene,'marker','paper');
    const beamL=new Beam(fxScene,'marker','paper');
    const beamHit={x:0,z:0,depth:0};
    let beamMerge=false;
    function beamReach(x,z,dx,dz,max) {
        const C=TUNING.beam;
        const room=game.room;
        const b=room.bounds;
        for (let d=C.step;d<=max;d+=C.step) {
            const px=x+dx*d;
            const pz=z+dz*d;
            if (px<b.minX||px>b.maxX||pz<b.minZ||pz>b.maxZ) {
                return {len:d,col:null};
            }
            for (const col of room.colliders) {
                if (!col.passPlayer&&circleVs(px,pz,0.12,col,beamHit)) {
                    return {len:d,col};
                }
            }
        }
        return {len:max,col:null};
    }
    const lobs=new Lobs(actors);
    const rings=new Rings(fxScene);
    const dangerRings=new Rings(fxScene,12);
    const floorMarks=new FloorMarks(fxScene,TUNING.courses.music.max+1);
    const preview=new Preview(fxScene);
    preview.roomFn=()=>game.room;
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
    const effects=new CardEffects({player,playerBullets,pierceBullets,homingBullets,enemyBullets,lobs,enemies,particles,decals,rings,muzzle,fx,room:null,clones,puppet,weaponSys,ink,scene:actors,fxScene},TUNING);
    ctx.dangerRings=dangerRings;
    ctx.weaponSys=weaponSys;
    const swings=[];
    const updateSwings=dt=>{
        const S=TUNING.brushSwing;
        for (let i=swings.length-1;i>=0;i--) {
            const s=swings[i];
            const r0=s.r;
            s.v*=Math.exp(-WB.brush.drag*dt);
            s.r+=s.v*dt;
            s.life-=dt;
            const inArc=(px,pz,pad)=>{
                const dx=px-s.x;
                const dz=pz-s.z;
                const d=Math.hypot(dx,dz);
                if (d<=pad+S.start) {
                    return d;
                }
                let da=Math.atan2(dz,dx)-s.a;
                da=Math.atan2(Math.sin(da),Math.cos(da));
                if (!(d>=r0-pad-S.band&&d<=s.r+pad&&Math.abs(da)<=s.fan/2+Math.atan2(pad,Math.max(d,0.3)))) {
                    return -1;
                }
                return beamReach(s.x,s.z,dx/d,dz/d,d).len<d-pad?-1:d;
            };
            for (const e of enemies.list) {
                if (!e.alive||e.state==='spawn'||s.hit.has(e)) {
                    continue;
                }
                const d=inArc(e.pos.x,e.pos.z,e.def.radius);
                if (d<0) {
                    continue;
                }
                s.hit.add(e);
                const PW=s.W;
                const touch=Math.max(0,d-e.def.radius);
                const band=PW.bands[Math.min(PW.bands.length-1,Math.floor(touch/(s.reach/PW.bands.length)))];
                const m=e.damageMult(e.pos.x,e.pos.z);
                const nx=(e.pos.x-s.x)/(d||1);
                const nz=(e.pos.z-s.z)/(d||1);
                const dmg=band*m*cutter(e.pos.x,e.pos.z);
                s.dealt+=dmg;
                enemies.damage(e,dmg,nx,nz,false,m>1);
            }
            if (game.room) {
                for (const pc of game.room.pieces.slice()) {
                    if (pc.state!=='alive'||!(pc.kind==='barrel'||pc.kind==='crate'||pc.kind==='target')||s.hit.has(pc)) {
                        continue;
                    }
                    const d=inArc(pc.x,pc.z,pc.radius+S.propPad);
                    if (d<0) {
                        continue;
                    }
                    s.hit.add(pc);
                    game.room.damagePiece(pc,Math.max(...s.W.bands));
                }
            }
            enemyBullets.killWhere((bx,bz)=>inArc(bx,bz,S.bulletPad)>=0,(bx,bz)=>particles.burst(bx,1,bz,2,{color:'farGray',speed:[1,3],up:[1,2]}));
            if (s.life<=0) {
                swings.splice(i,1);
                player.swingResult(s.dealt);
            }
        }
    };
    const brushRay=(x,z,an,max)=>beamReach(x,z,Math.cos(an),Math.sin(an),max).len;
    ctx.onBrush=(x,z,a,fan)=>{
        const PW=player.W;
        const reach=TUNING.brushSwing.start+PW.bulletSpeed/WB.brush.drag*(1-Math.exp(-WB.brush.drag*PW.bulletLife));
        swings.push({x,z,a,fan,r:TUNING.brushSwing.start,v:PW.bulletSpeed,life:PW.bulletLife,hit:new Set(),W:PW,dealt:0,reach});
        strokes.spawn(x,z,a,fan,PW.bulletSpeed,WB.brush.drag,PW.bulletLife,brushRay);
        for (let i=0;i<5;i++) {
            const an=a+(Math.random()-0.5)*fan;
            particles.burst(x+Math.cos(an)*0.8,1,z+Math.sin(an)*0.8,1,{color:'ink',dirX:Math.cos(an),dirZ:Math.sin(an),cone:0.4,speed:[3,7],up:[0.5,2],size:[0.08,0.16],life:[0.3,0.5]});
        }
        fx.cameraShake(0.05);
    };
    const clearCompassBullets=()=>{
        const C=weaponSys.compass;
        const R=TUNING.brushSwing.compassClear;
        for (let i=0;i<C.n;i++) {
            const cx=C.x[i];
            const cz=C.z[i];
            enemyBullets.killWhere((bx,bz)=>(bx-cx)*(bx-cx)+(bz-cz)*(bz-cz)<R*R,(bx,bz)=>particles.burst(bx,1,bz,2,{color:'farGray',speed:[1,3],up:[1,2]}));
        }
    };
    ctx.onBeam=(x,z,dx,dz,PW)=>{
        const B=PW.beam;
        const r=beamReach(x,z,dx,dz,B.range);
        const hw=B.width*0.5;
        beamMerge=true;
        for (const e of enemies.list.slice()) {
            if (e.state==='spawn') {
                continue;
            }
            const ex=e.pos.x-x;
            const ez=e.pos.z-z;
            const t=ex*dx+ez*dz;
            if (t<0||t>r.len+e.def.radius) {
                continue;
            }
            const px=ex-dx*t;
            const pz=ez-dz*t;
            if (px*px+pz*pz<(e.def.radius+hw)*(e.def.radius+hw)) {
                const m=e.damageMult(x+dx*t,z+dz*t);
                enemies.damage(e,PW.damage*m*cutter(e.pos.x,e.pos.z),dx,dz,true,m>1);
            }
        }
        beamMerge=false;
        const hx=x+dx*r.len;
        const hz=z+dz*r.len;
        if (r.col) {
            playerWall(hx,hz,dx,dz,r.col);
        }
        particles.burst(hx,H,hz,TUNING.beam.sparks,{color:'marker',dirX:-dx,dirZ:-dz,cone:1.4,speed:[2,5],up:[1,3],size:[0.08,0.16],life:[0.15,0.3]});
    };
    ctx.onInkDrop=(x,z,r,dur,slow)=>{
        game.room.zones.addPuddle(x,z,r,dur,slow);
        decals.spawn(x,z,r*1.7,'ink','nearGray');
        particles.burst(x,0.3,z,10,{speed:[2,5],up:[3,6],size:[0.1,0.2]});
        audio.play('drop');
    };
    ctx.onStampPrint=(x,z,r,dur,fade,slow)=>{
        game.room.zones.addPrint(x,z,r,dur,fade,slow);
        decals.spawn(x,z,r*1.2,'ink','nearGray');
        particles.burst(x,0.3,z,14,{color:'ink',speed:[2,6],up:[1,4],size:[0.08,0.18]});
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
    let uiS=1;
    const toUi=out=>{
        out.x/=uiS;
        out.y/=uiS;
        return out;
    };
    const uiMp={x:0,y:0,down:false,inside:true};
    const uiMouse=()=>{
        uiMp.x=input.mouse.x/uiS;
        uiMp.y=input.mouse.y/uiS;
        uiMp.down=input.mouse.down;
        return uiMp;
    };
    const ultCutin=new UltCutin();
    let pickerReturn=null;
    let trainFixed=[];
    const trainStats={total:0,max:0,last:0,lastT:0,kills:0,cards:0,hurt:0,hurtT:0,log:[],start:0,clock:0};
    function resetTrainStats() {
        Object.assign(trainStats,{total:0,max:0,last:0,lastT:0,kills:0,cards:0,hurt:0,hurtT:0,log:[],start:trainStats.clock});
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
        if (trainingPicker.startMode) {
            settings.training.refill='random';
            saveSettings();
        }
        trainPick(pickRandom(trainPool(false),TUNING.deck.handSize).concat(pickRandom(trainPool(true),1)),false,true);
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
    function trainPick(ids,upgraded,rnd=false) {
        if (trainingPicker.startMode&&!rnd) {
            settings.training.refill='fixed';
            saveSettings();
        }
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
        overlay.hud.toast(t('training.picked',{name:names.join(t('ui.list'))}));
        audio.play('card');
        closePicker(true);
    }
    function modalShown() {
        return trainingMenu.shown()||pauseMenu.shown()||trainingPicker.shown()||settingsMenu.shown()||codex.shown();
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
        tutNotify('deck');
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
            if (!rig.screenToGround(sx*uiS,sy*uiS,renderer.width,renderer.height,0,tmpG)) {
                return false;
            }
            out.x=tmpG.x;
            out.z=tmpG.z;
            return true;
        },
        worldToScreen:(x,y,z,out)=>toUi(rig.worldToScreen(tmpV.set(x,y,z),renderer.width,renderer.height,out)),
        nearestEnemy:(x,z,r)=>{
            const e=enemies.nearest(x,z,r);
            return e?e.pos:null;
        },
        mouseScreen:()=>input.lastDevice==='mouse'&&input.mouse.inside?uiMouse():null,
        execute:(card,target)=>{
            if (card.def.rarity==='rare') {
                const echo=card.def.id==='echo'?effects.lastUlt:null;
                const tg=echo?{...target,echo:hand.stickTarget(echo,0,0,0)}:target;
                fx.cutin=true;
                hand.cancelTargeting();
                input.mouse.down=false;
                audio.play('ult');
                ultCutin.play(card,()=>{
                    fx.cutin=false;
                    audio.play('ultHit');
                    fx.cameraShake(TUNING.ultFx.hitShake);
                    fx.fovPunch(TUNING.ultFx.hitFov);
                    effects.run(card,tg);
                    tutNotify('ult');
                },{params:cardParams(echo||card),echo});
                return;
            }
            effects.run(card,target);
            audio.play(card.def.id==='pencilWall'?'wall':(card.def.type==='terrain'?'erase':'card'));
        },
        openDeck,
        onCancel:()=>tutNotify('cancel'),
        showKeys:()=>input.lastDevice==='mouse'&&!device.mobile,
        onPlayStart:card=>{
            hand.idleT=0;
            if (card&&run.mode!=='training') {
                cardRelic(card.def.rarity==='rare');
            }
            if (card&&!isUlt(card.id)) {
                tutNotify('card');
            }
            audio.play('card');
            if (run.stats) {
                run.stats.cards++;
                bump('cards');
                if (card&&isUlt(card.id)) {
                    bump('ults');
                }
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
    deck.events.onReshuffleEnd=()=>{
        hand.onReshuffleEnd();
        if (game.mode==='play') {
            ink.add(TUNING.deck.reshuffleInk);
        }
    };
    homingBullets.onSeek=(x,z)=>{
        const e=enemies.nearest(x,z,40);
        return e?e.pos:null;
    };
    const hitEnemies=(x,z,r,dmg,vx,vz,sys,i)=>enemies.hitBullet(x,z,r,sys.tag[i]&TUNING.relics.weaponTag?dmg*cutter(x,z):dmg,vx,vz,sys,i);
    pierceBullets.onHit=(x,z,r,dmg,vx,vz,sys,i)=>{
        const e=hitEnemies(x,z,r,dmg,vx,vz,sys,i);
        if (e) {
            setMax('pierceBest',sys.hitN[i]+1);
        }
        return e;
    };
    for (const s of extraSys) {
        s.onHit=hitEnemies;
    }
    weaponSys.staple.onHit=(x,z,r,dmg,vx,vz,sys,i)=>{
        const e=hitEnemies(x,z,r,dmg,vx,vz,sys,i);
        if (e&&player.W.slow) {
            e.slowT=Math.max(e.slowT||0,player.W.slow.time);
            e.slowMult=player.W.slow.mult;
        }
        return e;
    };
    homingBullets.onHit=hitEnemies;
    const rulerMove=(sys,i,ax,az,bx,bz)=>effects.rulerCross(sys,i,ax,az,bx,bz);
    for (const s of [playerBullets,pierceBullets,homingBullets,...extraSys]) {
        s.onMove=rulerMove;
    }
    let bleed=0;
    let heart=0;
    playerBullets.onHit=hitEnemies;
    enemyBullets.onHit=(x,z,r,dmg,vx,vz)=>player.hitBullet(x,z,r,dmg,vx,vz);
    chalkBullets.onHit=(x,z,r,dmg,vx,vz)=>player.hitBullet(x,z,r,dmg,vx,vz);
    const playerWall=(x,z,vx,vz,col)=>{
        if (col&&col.piece&&(col.piece.kind==='barrel'||col.piece.kind==='crate'||col.piece.kind==='target')) {
            game.room.damagePiece(col.piece,W.damage);
        }
        particles.burst(x,H,z,PT.wallPuff,{color:'nearGray',speed:[1,3.5],up:[1,3],size:[0.06,0.12],life:[0.2,0.4],dirX:-vx,dirZ:-vz,cone:1.3});
    };
    playerBullets.onWall=playerWall;
    for (const s of extraSys) {
        s.onWall=playerWall;
    }
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
        if (dmg<=0) {
            return;
        }
        dmgNums.spawn(e.pos.x,e.def.height*0.9,e.pos.z,dmg,crit,beamMerge?TUNING.beam.mergeTime:0);
        if (run.stats) {
            run.stats.dealt+=dmg;
        }
        if (run.mode==='training') {
            trainStats.total+=dmg;
            trainStats.max=Math.max(trainStats.max,dmg);
            trainStats.last=dmg;
            trainStats.lastT=1;
            trainStats.log.push({t:trainStats.clock,dmg});
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
    enemies.onBlock=e=>{
        particles.burst(e.pos.x,1.8,e.pos.z,3,{color:'red',speed:[2,5],up:[1,3]});
    };
    enemies.onSpawned=e=>{
        if (game.mode==='play'&&run.mode!=='training') {
            const met=progress.seen.includes(e.type)||progress.beaten.includes(e.type);
            markSeen(e.type);
            if (e.def.boss&&!e.tutor&&(run.mode==='story'||run.mode==='endless')&&!progress.bossIntro.includes(e.type)) {
                if (met||godMode()) {
                    markBossIntro(e.type);
                }
                else {
                    pendingBoss=e.type;
                    bossIntroT=TUNING.bossIntro.delay;
                }
            }
        }
    };
    enemies.dmgHook=(e,dmg)=>e.tutor?0:(run.course&&run.state==='combat'?run.course.damage(e,dmg):dmg)*dmgMult();
    enemies.onKill=(e,dx,dz)=>{
        const x=e.pos.x;
        const z=e.pos.z;
        const D=TUNING.decals;
        if (run.course&&run.state==='combat') {
            run.course.onKill(e);
        }
        if (e.noReward) {
            particles.burst(x,1.0,z,8,{color:'ink',speed:[2,5],up:[2,5],size:[0.08,0.16]});
            return;
        }
        ink.add((e.def.ink||1)*(e.elite?TUNING.ink.eliteMult:1));
        const bits=killRelic(e.type==='blobSmall');
        if (bits>0) {
            ink.add(bits);
        }
        if (run.mode==='training') {
            trainStats.kills++;
        }
        tutNotify('kill');
        audio.play(e.def.boss?'boss':'kill',0.8+Math.random()*0.4);
        if (e.def.boss&&run.mode!=='training'&&run.mode!=='tutorial') {
            markBeaten(e.type);
        }
        bump('kills');
        if (e.elite) {
            bump('elites');
        }
        if (e.def.boss) {
            bump('bosses');
            addKind('boss',e.type);
            if (run.mode==='story'||run.mode==='endless') {
                const got=earnDots(TUNING.meta.dotBoss);
                if (got>0) {
                    overlay.hud.toast(t('run.dotsGain',{n:got}));
                }
            }
        }
        fx.hitStop(F.hitStopKill,true);
        fx.cameraShake(F.shakeKill);
        fx.fovPunch(F.fovKill);
        fx.flash('paper',F.killFlash*3,0.35);
        if (run.stats) {
            run.addScore((e.def.boss?ENDLESS.scoreBoss:ENDLESS.scoreKill*(e.def.cost||1)*(e.elite?TUNING.elite.score:1)));
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
                enemies.slay(o);
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
    player.events.onLand=p=>{
        audio.play('dash',0.7);
        effects.landed(p);
    };
    player.events.onArm=()=>audio.play('equip',1.2);
    player.events.onEquip=p=>{
        if (quietEquip) {
            return;
        }
        audio.play('equip');
        if (game.mode==='play') {
            particles.burst(p.pos.x,1.2,p.pos.z,TUNING.equip.particles,{color:'ink',speed:[2,5],up:[2,5],size:[0.08,0.16]});
        }
    };
    weaponSys.compass.onProp=(piece,dmg)=>{
        if (piece.state!=='alive'||time.real-(piece.compHit||-9)<TUNING.weaponFx.compass.propGap) {
            return;
        }
        piece.compHit=time.real;
        game.room.damagePiece(piece,dmg);
    };
    weaponSys.compass.onReturn=(x,z,caught,struck)=>{
        if (!struck&&player.W.missCut) {
            player.cdT*=player.W.missCut;
        }
        if (caught) {
            particles.burst(x,H,z,4,{color:'nearGray',speed:[1,3],up:[1,3],size:[0.06,0.12]});
            audio.play('draw',1.7);
        }
    };
    const dodgeTimes=[];
    let dodgeFxAt=-9;
    function perfectDodge(p) {
        const D=TUNING.dodgeFx;
        ink.add(D.ink);
        perfectRelic();
        if (time.real-dodgeFxAt<D.cooldown) {
            return;
        }
        dodgeFxAt=time.real;
        audio.play('dash',0.6);
        particles.burst(p.pos.x,1.0,p.pos.z,10,{color:'farGray',speed:[2,5],up:[1,3],size:[0.06,0.12]});
        if (settings.reducedMotion) {
            return;
        }
        fx.slowMo(D.slow,D.slowTime);
        fx.flash('paper',0.25,D.flash);
        const s=rig.worldToScreen(tmpV.set(p.pos.x,1,p.pos.z),renderer.width,renderer.height,{x:0,y:0});
        renderer.post.blurPulse(D.blur,D.blurTime,s.x/Math.max(1,renderer.width),1-s.y/Math.max(1,renderer.height));
    }
    player.events.onDodge=p=>{
        bump('dodges');
        const DC=TUNING.achFx.dodgeChain;
        dodgeTimes.push(time.game);
        while (dodgeTimes.length>0&&time.game-dodgeTimes[0]>DC.window) {
            dodgeTimes.shift();
        }
        setMax('dodgeChain',dodgeTimes.length);
        if (run.course&&run.state==='combat') {
            run.course.dodged();
        }
        perfectDodge(p);
        if (!run.tutorial()) {
            dmgNums.spawnText(p.pos.x,2.2,p.pos.z,t('dodge.perfect',{n:TUNING.dodgeFx.ink}));
            return;
        }
        dmgNums.spawnText(p.pos.x,2.2,p.pos.z,t('tut.dodged'));
        tutNotify('dodge');
    };
    player.events.onDash=()=>{
        audio.play('dash');
        fx.fovPunch(TUNING.player.dashFovPunch);
        fx.cameraShake(TUNING.player.dashTrauma);
    };
    player.events.onFire=(p,mx,mz)=>{
        const PW=p.W;
        audio.play(PW.sound||'shoot',0.85+Math.random()*0.3);
        muzzle.show(mx,H,mz,PW.flashColor||'ink',W.flashScale*(PW.flashMul||1));
        fx.cameraShake(W.recoilTrauma*(PW.kick||1));
        fx.fovPunch(W.recoilFov*(PW.kick||1));
    };
    player.events.onHurt=(p,dx,dz,dmg)=>{
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
            run.stats.taken+=dmg;
        }
        particles.burst(p.pos.x,1.0,p.pos.z,PT.redHurt,{color:'red',speed:[2,6],up:[2,6],size:[0.08,0.16]});
    };
    player.events.onGuard=(p,dx,dz)=>{
        audio.play('clear',1.3);
        fx.hitStop(60,true);
        fx.cameraShake(0.25);
        overlay.hud.toast(t('relic.guarded'));
        particles.burst(p.pos.x,1.0,p.pos.z,12,{color:'paper',speed:[2,6],up:[2,5],size:[0.1,0.2]});
        particles.burst(p.pos.x,1.0,p.pos.z,6,{color:'ink',speed:[2,5],up:[2,4]});
    };
    player.events.onShield=(p,idx,dx,dz)=>{
        fx.hitStop(60,true);
        fx.cameraShake(0.25);
        paperShards.burst(p.pos.x-dx*0.8,1.0,p.pos.z-dz*0.8,4,-dx,-dz,0.8);
        particles.burst(p.pos.x,1.0,p.pos.z,6,{color:'farGray',speed:[2,5],up:[2,4]});
    };
    let fortFx=0;
    player.events.onFortHit=(p,dx,dz)=>{
        if (time.real-fortFx<TUNING.effects.fortFxGap) {
            return;
        }
        fortFx=time.real;
        const R=TUNING.effects.fortRadius;
        particles.burst(p.pos.x-dx*R,1.0,p.pos.z-dz*R,6,{color:'farGray',speed:[1,4],up:[1,3],size:[0.06,0.12]});
        audio.play('draw',1.8);
    };
    player.events.onFortEnd=p=>{
        paperShards.burst(p.pos.x,1.0,p.pos.z,8,0,0,1.2);
        audio.play('erase',1.1);
    };
    const pickups=new Pickups(actors);
    player.events.onDualEnd=p=>{
        audio.play('erase',1.2);
        particles.burst(p.pos.x,1.0,p.pos.z,8,{color:'farGray',speed:[1,3],up:[2,4],size:[0.06,0.12]});
    };
    player.events.onRefund=p=>{
        dmgNums.spawnText(p.pos.x,2.2,p.pos.z,t('weapon.refund'));
        particles.burst(p.pos.x,1.2,p.pos.z,8,{color:'ink',speed:[1,3],up:[2,4],size:[0.06,0.12]});
        audio.play('ui',1.4);
    };
    const floatText=(x,z,text)=>{
        dmgNums.spawnText(x,1.6,z,text);
    };
    const onPropBreak=piece=>{
        const P=TUNING.props;
        if (piece.kind==='target') {
            audio.play('wall',1.6);
            particles.burst(piece.x,1.2,piece.z,16,{color:'farGray',speed:[2,5],up:[2,5]});
            particles.burst(piece.x,1.2,piece.z,6,{color:'red',speed:[2,4],up:[2,4]});
            minis.hitTarget();
            return;
        }
        if (piece.kind==='barrel') {
            bump('barrels');
            audio.play('kill',0.6);
            enemies.damageRadius(piece.x,piece.z,P.barrelRadius,P.barrelDamage);
            if (Math.hypot(player.pos.x-piece.x,player.pos.z-piece.z)<P.barrelRadius*0.7&&player.hurt(P.barrelSelf,player.pos.x-piece.x,player.pos.z-piece.z)&&player.hp<=0) {
                bump('barrelDeaths');
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
            if (piece.kind==='crate') {
                bump('crates');
            }
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
    player.events.onAttacked=()=>{
        if (hasRelic('masochist')&&run.state==='combat') {
            ink.add(TUNING.relics.masochist.ink);
            flashRelic('masochist');
        }
    };
    const cutter=(x,z)=>{
        const C=TUNING.relics.boxCutter;
        if (!hasRelic('boxCutter')||Math.hypot(x-player.pos.x,z-player.pos.z)>C.range) {
            return 1;
        }
        flashRelic('boxCutter',0.35);
        return C.mult;
    };
    const reward=new RewardView();
    reward.onArm=()=>audio.play('ui',0.8);
    const upgradeView=new UpgradeView();
    const summary=new RunSummary();
    const transition=new Transition();
    transition.onDoorDone=()=>{
        if (game.mode==='play'&&run.state!=='summary') {
            resumePlay();
        }
    };
    let shardList=null;
    function allShards() {
        if (!shardList) {
            shardList=[...enemyShards.values(),terrainShards,paperShards];
        }
        return shardList;
    }
    const beamMp={x:0,z:0};
    const beamMpL={x:0,z:0};
    function updateBeam(dt) {
        const PW=player.W;
        if (PW.beam&&player.beamT>0&&player.hp>0) {
            player.muzzlePoint(beamMp);
            const a=player.beamAngle(beamMp.x,beamMp.z);
            const r=beamReach(beamMp.x,beamMp.z,Math.cos(a),Math.sin(a),PW.beam.range);
            beam.set(true,beamMp.x,beamMp.z,Math.cos(a),Math.sin(a),r.len,PW.beam.width);
            if (player.dualT>0) {
                player.muzzleLeft(beamMpL);
                const rl=beamReach(beamMpL.x,beamMpL.z,Math.cos(a),Math.sin(a),PW.beam.range);
                beamL.set(true,beamMpL.x,beamMpL.z,Math.cos(a),Math.sin(a),rl.len,PW.beam.width);
            }
            else {
                beamL.set(false);
            }
        }
        else {
            beam.set(false);
            beamL.set(false);
        }
        beam.update(dt);
        beamL.update(dt);
    }

    function clearWorld() {
        minis.clear();
        enemies.clear();
        playerBullets.clear();
        enemyBullets.clear();
        chalkBullets.clear();
        pierceBullets.clear();
        for (const s of extraSys) {
            s.clear();
        }
        strokes.clear();
        beam.clear();
        beamL.clear();
        homingBullets.clear();
        lobs.clear();
        particles.clear();
        for (const sh of allShards()) {
            sh.clear();
        }
        decals.clear();
        dmgNums.clear();
        pickups.clear();
        for (const c of allClones) {
            c.stop();
        }
        effects.clear();
        preview.hide();
        renderer.post.invertHold.value=0;
    }
    function enterRoom(plan,deckList) {
        clearWorld();
        renderer.post.resetDeath();
        const viaDoor=transition.state==='hold';
        renderer.post.drawIn(TUNING.transition.drawIn,viaDoor?TUNING.doorFx.hold:(transition.active?TUNING.transition.drawInDelay:0));
        if (game.room) {
            game.room.destroy();
        }
        const gaps=doorXs((plan.exits||[]).length,plan.layout.size[0]/2).map(x=>({x,w:TUNING.doors.width}));
        const r=buildRoom(plan.layout,world,fxScene,{gaps,rng:new RNG(plan.act*100+plan.index*7+Math.floor(Math.random()*1000)),barrels:plan.barrels||0,crates:plan.crates||0});
        r.shards=terrainShards;
        r.onBreak=onBreak;
        r.onPropBreak=onPropBreak;
        doors.build(r,plan.exits||[]);
        npcs.build(r,plan.npcs||[]);
        if (plan.game) {
            minis.setup(plan.game,r,plan.act,plan.gameFlip);
        }
        art.warm(deckList.map(c=>createCard(c.id,c.upgraded)));
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
        rig.setBounds(r.walkBounds||r.bounds);
        look.x=0;
        look.z=0;
        rig.follow(player.pos,0,0);
        rig.snap();
        hand.reset();
        deck.reset(deckList);
        if (!plan.peace) {
            deck.start();
        }
        hand.setShown(!plan.peace,true);
        player.setArmed(!plan.peace,true);
        overlay.hud.result=null;
        fx.paused=viaDoor;
        warmShaders();
        preview.warm();
        return r;
    }
    const minis=new MiniGames({
        burst:(x,y,z,n,color)=>particles.burst(x,y,z,n,{color,speed:[1,4],up:[1,4],size:[0.08,0.18]}),
        shake:a=>fx.cameraShake(a),
        arm:on=>player.setArmed(on),
        sound:(name,pitch)=>audio.play(name,pitch),
        say:(x,z,key,params)=>dmgNums.spawnText(x,2.2,z,t(key,params)),
        talk:(text,dur)=>npcs.say(0,text,dur),
        place:(x,z)=>{
            particles.burst(player.pos.x,0.6,player.pos.z,8,{color:'midGray',speed:[1,3],up:[1,3]});
            player.pos.set(x,0,z);
            player.prev.copy(player.pos);
            player.renderPos.copy(player.pos);
            player.root.position.copy(player.pos);
            particles.burst(x,0.6,z,10,{color:'ink',speed:[1,3],up:[1,3]});
        },
        onEnd:(ok,bonus)=>run.gameDone(ok,bonus)
    });
    function endlessAP(i) {
        return {act:Math.floor(i/ENDLESS.bossEvery)+1,page:i%ENDLESS.bossEvery+1};
    }
    function tutNotify(kind) {
        if (run.tutorial()&&run.director&&run.director.notify) {
            run.director.notify(kind);
        }
    }
    function tutProvider() {
        return run.tutorial()&&run.director&&run.director.provide?run.director.provide(deck):null;
    }
    const tutHooks={
        enemies,
        enter:()=>{
            hand.setShown(false,true);
            deck.timers.length=0;
            coach.reset();
            overlay.hud.banner(t('tut.banner'),t('tut.bannerSub'),2);
        },
        intro:(step,i)=>{
            hand.cancelTargeting();
            input.mouse.down=false;
            fx.paused=true;
            if (step.key==='end') {
                settings.tutorialSeen=true;
                saveSettings();
            }
            audio.play('page',1.2);
            coach.intro(step,i);
        },
        task:step=>coach.task(step),
        remind:(step,i)=>{
            hand.cancelTargeting();
            input.mouse.down=false;
            fx.paused=true;
            audio.play('page',1.2);
            coach.remind(step,i);
        },
        progress:(kind,n,pad)=>{
            coach.progress(kind,n);
            audio.play('ui',1.2+n*0.1);
            if (kind==='pad'&&pad) {
                particles.burst(pad.x,0.4,pad.z,14,{color:'red',speed:[2,5],up:[2,5],size:[0.08,0.16]});
                rings.spawn(pad.x,pad.z,pad.r*1.6,'red',0.4);
            }
        },
        done:()=>{
            coach.done();
            audio.play('clear',1.2);
            fx.cameraShake(0.2);
            particles.burst(player.pos.x,1.2,player.pos.z,18,{color:'red',speed:[2,6],up:[3,7],size:[0.08,0.18]});
        },
        showHand:ult=>{
            hand.setShown(true);
            ink.value=ink.max;
            if (deck.hand.length===0&&deck.pendingDraws()===0) {
                deck.start();
            }
            if (ult) {
                deck.requestDraw(TUNING.tutorial.handDraw);
            }
        }
    };
    const run=new Run({
        tutorial:tutHooks,
        enemies,
        enterRoom,
        banner:(kind,rn)=>{
            const p=rn.plan;
            if (kind==='training') {
                overlay.hud.banner(t('training.title'),t('training.sub'),2.2);
            }
            else if (kind==='peace') {
                const sub=p.game?t('event.'+p.game+'.title')+t('ui.sep')+t('peace.game'):p.event?t('event.'+p.event+'.title')+t('ui.sep')+t(p.block?'peace.block':'peace.sub'):t('peace.'+p.node);
                overlay.hud.banner(t('node.'+p.node),sub,2.4);
            }
            else if (kind==='ambush') {
                fx.cameraShake(0.4);
                overlay.hud.banner(t('run.ambush'),t('run.ambushSub'),1.8);
            }
            else if (kind==='boss') {
                overlay.hud.banner(t('run.bossTitle',{name:t('enemy.'+p.bossType)}),p.endless?t('run.endlessBossSub',endlessAP(p.index)):t('run.bossSub',{act:p.act+1}),2.6);
            }
            else {
                const title=p.overtime?t('run.overtimeTitle',{page:p.otPage+1}):p.endless?t('run.endlessTitle',endlessAP(p.index)):t('run.roomTitle',{act:p.act+1,page:p.index+1});
                const parts=[];
                if (p.course) {
                    parts.push(t('course.'+p.course+'.name'));
                }
                if (p.fresh) {
                    parts.push(t('run.newEnemy',{name:t('enemy.'+p.fresh)}));
                }
                if (p.mod) {
                    parts.push(t('mod.'+p.mod));
                }
                if (p.challenge) {
                    parts.push(t('challenge.'+p.challenge.id,p.challenge));
                }
                overlay.hud.banner(title,parts.length>0?parts.join(t('ui.sep')):t('run.roomSub'),parts.length>0?2.2+parts.length*0.6:2.0);
            }
        },
        courseIntro:(id,first)=>{
            pendingGuide=first?id:null;
        },
        course:{
            enemies,
            bullets:chalkBullets,
            room:()=>game.room,
            chalked:(x,z,warn)=>{
                dangerRings.spawn(x,z,1.1,'red',warn);
                particles.burst(x,1.0,z,6,{color:'paper',speed:[1,3],up:[1,3],size:[0.08,0.14]});
            },
            thrown:(x,z)=>{
                audio.play('dash',1.6);
                particles.burst(x,1.0,z,8,{color:'farGray',speed:[2,4],up:[1,3],size:[0.06,0.12]});
            },
            stepped:(x,z)=>{
                audio.play('clear',1.4);
                particles.burst(x,0.3,z,16,{color:'red',speed:[2,5],up:[2,5],size:[0.08,0.16]});
                rings.spawn(x,z,TUNING.courses.music.radius*1.8,'red',0.4);
            },
            counted:e=>{
                audio.play('clear',1.6);
                rings.spawn(e.pos.x,e.pos.z,1.6,'red',0.35);
            },
            missed:(x,z)=>{
                particles.burst(x,0.3,z,6,{color:'midGray',speed:[1,3],up:[1,3],size:[0.06,0.12]});
            },
            hpMult:()=>run.plan.hpMult,
            note:key=>overlay.hud.toast(t(key),key),
            copied:(src,c)=>{
                audio.play('ui',0.6);
                particles.burst(c.pos.x,1.0,c.pos.z,8,{color:'farGray',speed:[1,4],up:[1,4],size:[0.08,0.16]});
            },
            reward:c=>{
                const R=TUNING.courses[c.id].reward;
                const parts=[];
                audio.play('clear',1.3);
                fx.cameraShake(0.25);
                if (R.score) {
                    run.addScore(R.score);
                    parts.push(t('course.rw.score',{n:R.score}));
                }
                if (R.hp) {
                    player.hp=Math.min(player.maxHp,player.hp+R.hp);
                    parts.push(t('course.rw.hp',{n:R.hp}));
                }
                if (R.ink) {
                    ink.add(ink.max);
                    parts.push(t('course.rw.ink'));
                }
                if (R.dots) {
                    const got=earnDots(R.dots);
                    if (got>0) {
                        parts.push(t('course.rw.dots',{n:got}));
                    }
                }
                bump('courses');
                particles.burst(player.pos.x,1.2,player.pos.z,18,{color:'red',speed:[2,6],up:[3,7],size:[0.08,0.18]});
                overlay.hud.banner(t('course.done'),parts.join(t('ui.sep')),2.4);
            }
        },
        onSpawn:e=>{
            particles.burst(e.pos.x,0.4,e.pos.z,e.def.boss?30:PT.spawnPuff,{color:'midGray',speed:[1,4],up:[1,4],size:[0.1,0.2],life:[0.3,0.6]});
        },
        pageStart:plan=>{
            const R=TUNING.relics;
            if (hasRelic('inkVial')&&ink.value<R.inkVial.min) {
                ink.value=R.inkVial.min;
                flashRelic('inkVial');
            }
            if (hasRelic('amulet')&&(plan.elite||plan.boss)) {
                player.setShield(player.shield+R.amulet.shields);
                flashRelic('amulet');
            }
            if (plan.node==='shop') {
                flashRelic('coupon',1.5);
            }
        },
        onCleared:plan=>{
            audio.play('clear');
            const patch=plan.ambush?0:pageRelic();
            if (patch>0) {
                player.hp=Math.min(player.maxHp,player.hp+patch);
                overlay.hud.toast(t('relic.healed',{n:patch}));
            }
            enemyBullets.killWhere(()=>true,(x,z)=>particles.burst(x,1.0,z,1,{color:'farGray',speed:[0.5,2],up:[1,2]}));
            chalkBullets.killWhere(()=>true,null);
            fx.slowMo(0.4,0.6);
            if (plan.boss) {
                const heal=TUNING.run.bossHeal;
                player.hp=Math.min(player.maxHp,player.hp+heal);
                overlay.hud.banner(t('run.cleared'),t('run.healed',{hp:heal}),1.6);
            }
            else {
                overlay.hud.banner(t('run.cleared'),'',1.3);
            }
        },
        cardFx:(kind,id,done)=>{
            fx.paused=true;
            hand.cancelTargeting();
            art.warm([].concat(id).flatMap(q=>[createCard(q),createCard(q,true)]));
            audio.play(kind==='remove'?'erase':(kind==='downgrade'?'fail':'clear'),kind==='gain'?1.2:0.9);
            upgradeView.play(kind,id,done);
        },
        onMerge:(id,done)=>{
            art.warm([createCard(id),createCard(id,true)]);
            audio.play('clear',0.8);
            upgradeView.show(id,done);
        },
        openReward:(groups,counts,cb,forced=false,title=null)=>{
            fx.paused=true;
            hand.cancelTargeting();
            for (const g of groups) {
                art.warm(g.cards);
            }
            const d=hand.drawRect;
            reward.show(groups,title||(run.plan.boss?t('reward.bossTitle'):t('reward.title')),counts,cb,{x:d.x+d.w/2,y:d.y+d.h/2},forced);
        },
        openDoors:quiet=>{
            doors.openAll();
            if (!quiet) {
                resumePlay();
            }
        },
        openGames:()=>{
            hand.cancelTargeting();
            audio.play('ui');
            trainingMenu.show(true);
            fx.paused=true;
        },
        leaveToMenu:()=>{
            run.quit();
            enterMenu();
        },
        closeDoors:()=>{
            doors.closeAll();
            audio.play('page',0.6);
        },
        npcUsed:(i,sealed)=>npcs.markUsed(i,sealed),
        npcSay:(i,text)=>npcs.say(i,text,TUNING.worldMarks.sayTime),
        dealDeck:()=>{
            resumePlay();
            hand.setShown(true);
            player.setArmed(true);
            audio.play('page',1.1);
            deck.start();
        },
        toast:(key,params,card)=>overlay.hud.toast(t(key,{...params,name:card?t(CARDS[card].nameKey):''})),
        hp:()=>player.hp,
        saveRun:data=>saveRunSnap({...data,hp:player.hp,ink:ink.value,weapon:player.weaponId,relic:relicState()}),
        clearRun:()=>clearRunSnap(),
        showReport:(title,lines,cb)=>{
            const SK={'note.score':1,'note.scoreLoss':-1,'note.paid':-1};
            overlay.hud.showResult(t(title.key,title.params?{name:t(title.params.name)}:{}),lines.map(l=>({text:t(l.key,{...l.params,name:l.card?t(CARDS[l.card].nameKey):''}),bad:l.bad,score:SK[l.key]?SK[l.key]*l.params.n:0})));
            cb();
        },
        startGame:()=>minis.begin(player),
        weaponId:()=>player.weaponId,
        setWeapon:id=>{
            player.setWeapon(id);
            player.setArmed(hand.shown,true);
        },
        gameInfo:()=>minis.info(),
        resume:()=>resumePlay(),
        takeRelic:(id,done)=>{
            addRelic(id);
            player.hp=Math.min(player.hp,player.maxHp);
            audio.play('clear',1.3);
            particles.burst(player.pos.x,1.4,player.pos.z,24,{color:'red',speed:[2,6],up:[3,7],size:[0.08,0.2]});
            overlay.hud.toast(t('library.got',{name:t('relic.'+id+'.name')}));
            if (relic.list.length<=TUNING.relics.max) {
                done();
                return;
            }
            fx.paused=true;
            hand.cancelTargeting();
            choice.open2({kind:'drop',options:relic.list.map(q=>({id:q,fresh:q===id}))},k=>{
                const out=relic.list[k];
                removeRelic(out);
                player.hp=Math.min(player.hp,player.maxHp);
                overlay.hud.toast(t('drop.done',{name:t('relic.'+out+'.name')}));
                done();
            });
        },
        openChoice:(spec,cb)=>{
            fx.paused=true;
            hand.cancelTargeting();
            choice.open2(spec,cb);
        },
        openDeckPick:(mode,list,cb,back=null)=>{
            fx.paused=true;
            art.warm(list.map(c=>createCard(c.id,c.upgraded)).concat(mode==='upgrade'?list.map(c=>createCard(c.id,true)):[]));
            deckPick.open2(mode,list,cb,back);
        },
        heal:n=>{
            const before=player.hp;
            player.hp=Math.min(player.maxHp,player.hp+n);
            return player.hp-before;
        },
        hurt:n=>{
            if (takeGuard()) {
                overlay.hud.toast(t('relic.guarded'));
                return 0;
            }
            const before=player.hp;
            player.hp=Math.max(1,player.hp-n);
            run.stats.taken+=before-player.hp;
            return before-player.hp;
        },
        addInk:n=>ink.addOver(n),
        transition:mid=>{
            audio.play('page');
            transition.run(mid);
        },
        doorTransition:(mid,i)=>{
            const d=doors.list[i];
            const p={x:overlay.width/2,y:overlay.height/2};
            if (d) {
                projectFn(d.x,TUNING.doors.height*0.5,d.z-d.t-TUNING.doors.alcove*0.5,p);
            }
            fx.paused=true;
            hand.cancelTargeting();
            audio.play('page');
            transition.runDoor(mid,p.x,p.y);
        },
        onDeath:()=>{
            audio.play('death');
            music.death();
            renderer.post.death();
            fx.slowMo(0.25,1.4);
            fx.invertFrame(10);
            fx.flash('paper',0.5,0.5);
            fx.cameraShake(0.8);
        },
        canRevive:()=>reviveReady(),
        phoenix:()=>{
            if ((run.mode!=='story'&&run.mode!=='endless')||!usePhoenix()) {
                return false;
            }
            const PH=TUNING.relics.phoenix;
            player.hp=PH.hp;
            player.invuln=PH.invuln;
            renderer.post.resetDeath();
            music.recover();
            audio.play('clear',1.4);
            fx.flash('red',0.5,0.6);
            fx.cameraShake(0.5);
            rings.spawn(player.pos.x,player.pos.z,3,'red',0.6);
            particles.burst(player.pos.x,1,player.pos.z,30,{color:'red',speed:[3,8],up:[3,8],size:[0.08,0.2]});
            overlay.hud.toast(t('relic.phoenixUp'));
            return true;
        },
        openRevive:cb=>{
            fx.paused=true;
            hand.cancelTargeting();
            revivePopup.open2(n=>{
                if (n>0&&spendRevive(n)) {
                    fx.paused=false;
                    player.hp=n;
                    player.invuln=TUNING.meta.revive.invuln;
                    renderer.post.resetDeath();
                    music.recover();
                    audio.play('clear',1.3);
                    fx.flash('paper',0.5,0.8);
                    fx.cameraShake(0.5);
                    particles.burst(player.pos.x,1.2,player.pos.z,30,{color:'red',speed:[3,7],up:[3,8],size:[0.1,0.22],life:[0.5,1]});
                    rings.spawn(player.pos.x,player.pos.z,2.6,'red',0.6);
                    dmgNums.spawnText(player.pos.x,2.4,player.pos.z,t('revive.done',{n}));
                    cb(true);
                    return;
                }
                cb(false);
            });
        },
        showSummary:(victory,stats,quit=false)=>{
            clearRunSnap();
            fx.paused=true;
            hand.cancelTargeting();
            const scoring=run.mode==='story'||run.mode==='endless';
            if (scoring) {
                bump('runs');
                if (victory) {
                    bump('clears');
                }
                addKind('weapon',player.weaponId);
            }
            const lvBefore=progress.level;
            const xpFrom=progress.xp/xpToNext(lvBefore);
            const bestKey=run.mode==='endless'?'bestScore':'bestStory';
            if (run.mode==='endless') {
                stats.xp+=stats.score*TUNING.levels.xpScore;
            }
            stats.mode=run.mode;
            if (godMode()) {
                stats.newBest=false;
                stats.best=progress[bestKey];
                summary.progress={god:true,xp:0,before:lvBefore,after:lvBefore,unlocked:[],xpFrom,xpTo:xpFrom};
            }
            else {
                stats.newBest=stats.score>progress[bestKey];
                progress[bestKey]=Math.max(progress[bestKey],stats.score);
                stats.best=progress[bestKey];
                const res=addXp(stats.xp);
                if (res.levels>0) {
                    const from=pendingLevel?pendingLevel.from:lvBefore;
                    pendingLevel={from,to:progress.level,cards:(pendingLevel?pendingLevel.cards:[]).concat(res.unlocked),weapons:WEAPON_ORDER.filter(id=>WEAPONS[id].unlock>from&&WEAPONS[id].unlock<=progress.level)};
                }
                summary.progress={xp:Math.round(stats.xp),before:lvBefore,after:progress.level,unlocked:res.unlocked.map(id=>t(CARDS[id].nameKey)),xpFrom,xpTo:progress.xp/xpToNext(progress.level)};
            }
            flushMeta();
            const levels=progress.level-lvBefore;
            const items=scoring&&!godMode()?grant(runChestCount(stats,run.mode)+levels,levels,true).concat(grantCoins(TUNING.meta.gradeCoins[gradeOf(stats.score,run.mode)]||0)):[];
            summary.show(victory,stats,quit,toMenu=>{
                audio.play('ui');
                player.hp=player.maxHp;
                ink.value=TUNING.ink.start;
                renderer.post.resetDeath();
                if (toMenu) {
                    enterMenu();
                    if (pendingLevel) {
                        const q=pendingLevel;
                        art.warm(q.cards.map(id=>createCard(id)));
                        levelUp.open2(q.from,q.to,q.cards,q.weapons);
                    }
                    pendingLevel=null;
                }
                else {
                    effects.lastUlt=null;
                    startRelic([]);
                    equipWeapon(true);
                    run.start(startIds(),run.mode);
                }
            });
            if (items.length>0) {
                summary.chest={items,opened:false};
                summary.onChest=(list,after)=>{
                    audio.play('ui');
                    chestView.open2(list,t('meta.runChest'),settings.skin,after);
                };
            }
        }
    },seedParam||(Date.now()&0xffff));
    function warmShaders() {
        const shown=[];
        for (const sc of [scene,fxScene]) {
            sc.traverse(o=>{
                if (!o.visible) {
                    o.visible=true;
                    shown.push(o);
                }
            });
        }
        renderer.gl.compile(scene,rig.camera);
        renderer.gl.compile(fxScene,rig.camera);
        for (const o of shown) {
            o.visible=false;
        }
    }
    function resumePlay() {
        if (!pauseMenu.open&&!guide.open) {
            fx.paused=false;
        }
        input.mouse.down=false;
        input.dashQueued=false;
    }
    function tryInteract() {
        if (game.mode!=='play'||fx.paused||transition.active) {
            return false;
        }
        if (doors.focus>=0&&run.canExit()) {
            audio.play('ui');
            hand.cancelTargeting();
            return run.useExit(doors.focus);
        }
        if (minis.interact(player)) {
            return true;
        }
        if (npcs.focus<0||!run.canInteract(npcs.focus)) {
            return false;
        }
        audio.play('ui');
        hand.cancelTargeting();
        const pickRelic=run.plan&&run.plan.node==='library'&&npcs.list[npcs.focus]&&npcs.list[npcs.focus].relic&&!(run.lib&&run.lib.relic);
        if (input.lastDevice==='touch'&&run.plan&&(run.plan.node==='shop'&&npcs.focus>0||pickRelic)&&npcs.armed!==npcs.focus) {
            npcs.armed=npcs.focus;
            buyArmT=TUNING.shopArm.time;
            return true;
        }
        npcs.armed=-1;
        return run.interact(npcs.focus);
    }
    function enterMenu() {
        coach.reset();
        overlay.hud.openRelicInfo('');
        clearWorld();
        player.setArmed(true,true);
        doors.clear();
        npcs.clear();
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
        if (run.tutorial()) {
            equipWeapon();
        }
        player.resetPose();
        player.aimYaw=0.6;
        enemies.hpMult=1;
        for (const [type,x,z,yaw] of M.enemies) {
            enemies.spawn(type,x,z,{quick:true}).yaw=yaw;
        }
        for (const [x,z,size] of M.decals) {
            decals.spawn(x,z,size,'ink','midGray');
        }
        hand.reset();
        ultCutin.cancel();
        fx.cutin=false;
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
        choice.open=false;
        deckPick.open=false;
        mainMenu.show();
        renderer.post.drawIn(1.6,0.2);
    }
    function startGame(mode='story') {
        audio.play('ui');
        coach.reset();
        mainMenu.hide();
        game.mode='play';
        player.hp=player.maxHp;
        ink.value=TUNING.ink.start;
        trainFixed=[];
        pendingGuide=null;
        pendingBoss=null;
        startRelic([]);
        equipWeapon(mode!=='training');
        if (mode==='tutorial') {
            player.setWeapon('pen');
        }
        if (mode==='training') {
            for (const k of TRAINING_SPAWN) {
                settings.training[k]=JSON.parse(JSON.stringify(TRAINING_DEFAULTS[k]));
            }
            settings.training.weapon=player.weaponId;
        }
        resetTrainStats();
        deck.provider=mode==='training'?trainProvider:(mode==='tutorial'?tutProvider:null);
        effects.lastUlt=null;
        run.start(startIds(),mode);
        if (mode==='training') {
            openPicker(true);
        }
    }
    function resumeRun(s,settle) {
        coach.reset();
        mainMenu.hide();
        game.mode='play';
        trainFixed=[];
        pendingGuide=null;
        pendingBoss=null;
        restoreRelic(s.relic&&typeof s.relic==='object'?s.relic:null);
        player.setWeapon(WEAPONS[s.weapon]?s.weapon:'pen');
        resetTrainStats();
        deck.provider=null;
        effects.lastUlt=null;
        run.restore(s);
        player.hp=Math.max(1,Math.min(player.maxHp,s.hp||player.maxHp));
        ink.value=Math.max(0,s.ink??TUNING.ink.start);
        if (settle) {
            run.quit();
            return;
        }
        overlay.hud.banner(t('resume.banner'),resumePlace(s),2.4);
    }
    function resumePlace(s) {
        const p=s.plan;
        if (p.overtime) {
            return t('run.overtimeTitle',{page:(p.otPage||0)+1});
        }
        if (s.mode==='endless') {
            return t('run.endlessTitle',endlessAP(p.index));
        }
        return t('run.roomTitle',{act:p.act+1,page:p.index+1});
    }
    function offerResume() {
        const s=loadRunSnap();
        if (!s) {
            return;
        }
        guide.open2({title:t('resume.title'),icon:null,blocks:[
            {kind:'text',text:t('resume.body')},
            {kind:'bullet',text:t('resume.mode',{mode:t('modeinfo.'+s.mode+'.title')})},
            {kind:'bullet',text:t('resume.page',{page:resumePlace(s)})},
            {kind:'bullet',text:t('resume.score',{n:s.stats.score||0})}
        ]},{ok:t('resume.continue'),cancel:t('resume.settle'),esc:'ok',onOk:()=>resumeRun(s,false),onCancel:()=>resumeRun(s,true)});
    }
    let pendingGuide=null;
    let pendingBoss=null;
    let buyArmT=0;
    let bossIntroT=0;
    function openBossIntro(id) {
        if (game.mode!=='play'||!markBossIntro(id)) {
            return;
        }
        audio.play('ui');
        hand.cancelTargeting();
        fx.paused=true;
        codex.showSolo(id,()=>resumeGame());
    }
    function openCourseGuide(id,intro) {
        if (game.mode!=='play'||run.mode!=='endless'||guide.open) {
            return;
        }
        audio.play('ui');
        hand.cancelTargeting();
        fx.paused=true;
        guide.open2(courseGuide(id),{ok:t(intro?'course.start':'course.go'),onOk:()=>{
            if (intro) {
                fx.paused=false;
            }
            else {
                resumeGame();
            }
        }});
    }
    function openPause() {
        if (game.mode==='play'&&run.mode==='training'&&!trainingMenu.open&&!trainingPicker.open&&!transition.active) {
            openTrainingMenu();
            return;
        }
        if (game.mode!=='play'||pauseMenu.open||summary.open||reward.open||upgradeView.open||choice.open||deckPick.open||transition.active) {
            return;
        }
        audio.play('ui');
        hand.cancelTargeting();
        deckView.hide();
        pauseMenu.training=run.mode==='training';
        pauseMenu.tutorial=run.tutorial();
        pauseMenu.show();
        fx.paused=true;
    }
    let tauntBag=[];
    const rnd=r=>r[0]+Math.random()*(r[1]-r[0]);
    function updateTaunts(dt) {
        const T=TUNING.taunt;
        if (game.mode!=='play') {
            return;
        }
        for (const e of enemies.list) {
            if (e.say) {
                e.say.t+=dt;
                if (e.say.t>=e.say.dur) {
                    e.say=null;
                }
            }
            if (run.mode==='training'||!e.alive||!(e.def.boss||e.elite)||e.state==='spawn'||(e.say&&e.say.keep)) {
                continue;
            }
            if (e.tauntT===undefined) {
                e.tauntT=rnd(T.first);
            }
            e.tauntT-=dt;
            if (e.tauntT<=0) {
                e.tauntT=rnd(T.every);
                if (tauntBag.length===0) {
                    tauntBag=Array.from({length:T.count},(q,i)=>i+1).sort(()=>Math.random()-0.5);
                }
                e.say={text:t('taunt.'+tauntBag.pop()),t:0,dur:T.dur};
            }
        }
    }
    let resumeT=0;
    function closePause() {
        audio.play('ui');
        pauseMenu.hide();
        resumeGame();
    }
    function resumeGame() {
        input.mouse.down=false;
        input.dashQueued=false;
        resumeT=coach.open||upgradeView.open||!tense()||!settings.resumeCount?0:TUNING.ui.resumeCount;
        if (resumeT<=0&&!coach.open&&!upgradeView.open) {
            fx.paused=false;
        }
    }
    function tense() {
        const g=minis.g;
        const timed=minis.running&&g&&!g.ended&&(g.limit>0||g.dur>0);
        return run.state==='combat'||timed;
    }
    function tickResume(dt) {
        if (resumeT<=0) {
            return;
        }
        if (pauseMenu.open||game.mode!=='play') {
            resumeT=0;
            return;
        }
        const prev=Math.ceil(resumeT);
        resumeT-=dt;
        if (resumeT<=0) {
            resumeT=0;
            fx.paused=false;
            input.dashQueued=false;
            audio.play('ui',1.5);
        }
        else if (Math.ceil(resumeT)!==prev) {
            audio.play('ui',1.1);
        }
    }
    let settingsReturn=null;
    function openSettings(from) {
        audio.play('ui');
        settingsReturn=from;
        settingsMenu.origin=from;
        settingsMenu.show();
    }
    function settingsChanged(key) {
        if (key==='lang') {
            applyLang();
            art.cache.clear();
        }
        if (key==='god') {
            settings.skin=clampSkin(settings.skin);
            player.applySkin(settings.skin);
        }
        if (key==='reduced') {
            if (settings.reducedMotion) {
                settings.jitterPrev=settings.jitter;
                settings.jitter=0;
            }
            else {
                settings.jitter=settings.jitterPrev??1;
            }
        }
        if (key==='full') {
            if (settings.fullscreen) {
                requestFullscreen();
            }
            else {
                exitFullscreen();
            }
        }
        saveSettings();
        applyQuality();
        audio.applyVolumes();
        if (key==='fps') {
            time.fpsCap=settings.fpsCap;
        }
        input.resize(input.width,input.height);
    }
    function beginMode(mode) {
        if (modeSeen(mode)) {
            startGame(mode);
            return;
        }
        audio.play('ui');
        markModeSeen(mode);
        guide.open2(modeGuide(mode),{ok:t('guide.go'),cancel:t('menu.back'),onOk:()=>startGame(mode)});
    }
    const mainMenu=new MainMenu({
        start:()=>beginMode('story'),
        endless:()=>beginMode('endless'),
        settings:()=>openSettings('menu'),
        codex:()=>{
            audio.play('ui');
            codex.show();
        },
        training:()=>startGame('training'),
        coins:()=>{
            audio.play('ui');
            guide.open2(coinGuide(),{ok:t('coins.more'),cancel:t('coins.back'),fit:true,keep:true,onOk:()=>guide.note(t('coins.soon'))});
        },
        weapon:()=>{
            audio.play('ui');
            relicView.show();
            if (!modeSeen('relics')) {
                markModeSeen('relics');
                guide.open2(relicGuide(),{ok:t('notice.ok'),fit:true});
            }
        },
        skin:()=>{
            audio.play('ui');
            mainMenu.hide();
            skinEditor.show();
        },
        levels:()=>{
            audio.play('ui');
            levelView.show();
        },
        achieve:()=>{
            audio.play('ui');
            achView.show();
        }
    });
    const achView=new AchievementView({
        back:()=>{
            audio.play('ui');
            achView.hide();
        },
        chest:()=>{
            const items=claimAchChest();
            if (items) {
                audio.play('ui');
                chestView.open2(items,t('ach.chestTitle'),settings.skin,null);
            }
        }
    });
    const chestView=new ChestView({
        burst:()=>{
            audio.play('clear',1.1);
            fx.cameraShake(0.3);
        },
        pop:i=>audio.play('draw',1+i*0.15)
    });
    const buyPrompt=new BuyPrompt({
        fail:()=>audio.play('fail'),
        cancel:()=>audio.play('ui'),
        bought:()=>audio.play('equip'),
        weaponIcon:(ctx,id,x,y,s,v)=>drawWeaponIcon(ctx,id,x,y,s,v,false)
    });
    const revivePopup=new RevivePopup({
        tick:()=>audio.play('ui',1.2)
    });
    const achToast=new AchToast();
    const confirmPop=new ConfirmPopup({
        yes:()=>audio.play('erase'),
        no:()=>audio.play('ui')
    });
    const skinEditor=new SkinEditor({
        buy:item=>{
            audio.play('ui');
            buyPrompt.open2(item,skinEditor.skin(),()=>{
                if (buy(item)) {
                    skinEditor.applyItem(item);
                    return true;
                }
                return false;
            });
        },
        bundle:pr=>{
            audio.play('ui');
            const items=presetMissing(pr);
            buyPrompt.open2({kind:'bundle',items,name:t('skin.preset.'+pr.id)},skinEditor.skin(),()=>{
                if (buyAll(items)) {
                    skinEditor.walletK=1;
                    skinEditor.applyPreset(pr);
                    return true;
                }
                return false;
            });
        },
        equipWeapon:id=>{
            settings.weapon=id;
            saveSettings();
            equipWeapon();
            audio.play('reload');
        },
        buyWeapon:id=>{
            audio.play('ui');
            const item={kind:'weapon',value:id};
            buyPrompt.open2(item,settings.skin,()=>{
                if (buy(item)) {
                    skinEditor.walletK=1;
                    skinEditor.pulse['w'+id]=1;
                    settings.weapon=id;
                    saveSettings();
                    equipWeapon();
                    return true;
                }
                return false;
            });
        },
        locked:()=>audio.play('fail'),
        dice:()=>audio.play('draw',1.3),
        fail:()=>audio.play('fail'),
        changed:(skin,big)=>{
            for (const c of allClones) {
                c.fig.applyAcc(skin);
            }
            player.applySkin(skin);
            saveSettings();
            player.sqv+=big?4:2.2;
            player.stv=(player.stv||0)+(big?1.2:0.6);
            particles.burst(player.pos.x,1.2,player.pos.z,big?22:10,{color:big?'red':'ink',speed:[2,5],up:[3,6],size:[0.08,0.18],life:[0.4,0.8]});
            if (big) {
                rings.spawn(player.pos.x,player.pos.z,1.6,'ink',0.5);
            }
        },
        select:()=>audio.play('ui'),
        back:()=>{
            audio.play('ui');
            skinEditor.hide();
            mainMenu.show();
        }
    });
    const popup=new InfoPopup({
        close:()=>{
            audio.play('ui');
            popup.hide();
        },
        link:url=>{
            audio.play('ui');
            window.open(url,'_blank');
        }
    });
    const guide=new GuidePopup({
        ok:()=>{
            audio.play('ui');
            const fn=guide.opts.onOk;
            if (guide.opts.keep) {
                if (fn) {
                    fn();
                }
                return;
            }
            guide.hide();
            if (fn) {
                fn();
            }
        },
        cancel:()=>{
            audio.play('ui');
            const fn=guide.opts.onCancel;
            guide.hide();
            if (fn) {
                fn();
            }
        }
    });
    const PRIVACY_URL='https://archie-30.github.io/INKRAGE/privacy.html';
    let lastDev='mouse';
    let devSeen=false;
    function checkDevice() {
        const d=input.lastDevice;
        if (d!==lastDev) {
            const k=d==='touch'?'device.touch':'device.mouse';
            if (devSeen) {
                overlay.hud.toast(t(k),k);
            }
            if (d==='touch') {
                hand.cancelTargeting();
            }
        }
        if (d!==lastDev||game.mode==='play') {
            devSeen=true;
        }
        lastDev=d;
    }
    const relicView=new RelicGacha({
        select:()=>audio.play('ui'),
        fail:()=>audio.play('fail'),
        pull:()=>{
            const id=pullRelic();
            if (id) {
                audio.play('gachaCoin');
            }
            return id;
        },
        sfx:(k,p)=>audio.play('gacha'+k[0].toUpperCase()+k.slice(1),p||1),
        back:()=>{
            audio.play('ui');
            relicView.hide();
        }
    });
    const langPick=new LangPicker({
        choose:k=>{
            audio.play('ui');
            settings.lang=k;
            applyLang();
            art.cache.clear();
        },
        size:k=>{
            audio.play('ui');
            settings.textSize=k;
            art.cache.clear();
        },
        done:()=>{
            audio.play('clear',1.2);
            settings.langChosen=true;
            saveSettings();
            langPick.hide();
            if (!settings.tutorialSeen) {
                startGame('tutorial');
            }
        }
    });
    const coach=new Coach({
        begin:()=>{
            audio.play('ui');
            fx.paused=false;
            input.mouse.down=false;
            input.dashQueued=false;
            run.director.begin();
        },
        next:()=>{
            audio.play('ui');
            coach.hide();
            run.director.next();
        },
        resume:()=>{
            audio.play('ui');
            fx.paused=false;
            input.mouse.down=false;
            input.dashQueued=false;
            coach.hide();
        },
        merge:()=>{
            coach.hide();
            art.warm([createCard(TUTORIAL_MERGE),createCard(TUTORIAL_MERGE,true)]);
            audio.play('clear',0.8);
            upgradeView.show(TUTORIAL_MERGE,()=>coach.show());
        },
        finish:()=>{
            audio.play('clear',1.3);
            coach.hide();
            transition.run(()=>enterMenu());
        }
    });
    const levelView=new LevelView({
        back:()=>{
            audio.play('ui');
            levelView.hide();
        },
        chest:n=>{
            const items=grantLevelChest(n);
            if (items.length>0) {
                audio.play('ui');
                chestView.open2(items,t('levels.chestTitle',{n}),settings.skin,null);
            }
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
            else if (kind==='weapon') {
                player.setWeapon(settings.training.weapon);
            }
        },
        resume:closeTrainingMenu,
        pick:openPicker,
        testGame:id=>{
            audio.play('ui');
            trainingMenu.hide();
            trainingMenu.pendingRoom=false;
            fx.paused=false;
            input.mouse.down=false;
            run.testGame(id);
        },
        reset:()=>{
            resetTrainStats();
            overlay.hud.toast(t('trainMenu.resetDone'));
        },
        settings:()=>openSettings('training'),
        home:()=>{
            audio.play('ui');
            trainingMenu.hide();
            trainingMenu.pendingRoom=false;
            fx.paused=false;
            input.mouse.down=false;
            run.quit();
            enterMenu();
        }
    });
    const trainingPicker=new TrainingPicker({
        home:()=>{
            audio.play('ui');
            trainingPicker.hide();
            trainingPicker.startMode=false;
            fx.paused=false;
            run.quit();
            enterMenu();
        },
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
            if (run.tutorial()) {
                settings.tutorialSeen=true;
                saveSettings();
            }
            if (transition.active||!run.quit()) {
                enterMenu();
            }
        }
    });
    const lockWeapons=()=>{
        for (const q of [settings,settings.training]) {
            if (!weaponUnlocked(q.weapon,effectiveLevel())) {
                q.weapon='pen';
            }
        }
        if (!weaponUnlocked(settings.lastWeapon,effectiveLevel())) {
            settings.lastWeapon='';
        }
        saveSettings();
        if (game.mode!=='play') {
            equipWeapon();
        }
    };
    const settingsMenu=new SettingsMenu({
        changed:settingsChanged,
        modes:()=>{
            audio.play('ui');
            markModeSeen('story');
            markModeSeen('endless');
            guide.open2(modesGuide(),{ok:t('notice.ok')});
        },
        privacy:()=>{
            audio.play('ui');
            guide.open2({title:t('privacy.title'),icon:null,blocks:[
                {kind:'text',text:t('privacy.body')},
                {kind:'head',text:t('privacy.aiHead')},
                {kind:'text',text:t('privacy.ai')}
            ]},{ok:t('notice.ok'),cancel:t('privacy.open'),esc:'ok',onCancel:()=>window.open(PRIVACY_URL,'_blank')});
        },
        tutorial:()=>{
            settingsMenu.hide();
            startGame('tutorial');
        },
        devOn:()=>{
            audio.play('clear',1.2);
            overlay.hud.toast(t('dev.on'));
        },
        devOff:lockWeapons,
        wrong:()=>audio.play('fail'),
        resetGame:()=>{
            audio.play('fail');
            const wipe=()=>{
                wipeStorage();
                location.reload();
            };
            confirmPop.open2({title:t('reset.title'),body:t('reset.body'),warn:t('reset.warn'),yes:t('reset.yes'),no:t('meta.cancel'),onYes:wipe});
        },
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
    const choice=new ChoicePanel({
        select:()=>audio.play('ui'),
        arm:()=>audio.play('ui',0.8)
    });
    const deckPick=new DeckPicker({
        select:()=>audio.play('ui'),
        confirm:mode=>audio.play(mode==='remove'?'fail':'clear',0.8)
    });
    const levelUp=new LevelUpView({
        sound:(name,pitch)=>audio.play(name,pitch),
        close:()=>{
            audio.play('ui');
            levelUp.hide();
        }
    });
    let pendingLevel=null;
    const menus=[mainMenu,pauseMenu,settingsMenu,codex,levelView,trainingPicker,skinEditor,trainingMenu,coach,langPick,relicView,popup,guide,choice,deckPick,levelUp,achView,chestView,buyPrompt,revivePopup,confirmPop];
    setGate(()=>game.mode==='play'&&(run.mode==='story'||run.mode==='endless')&&!godMode());
    setAchHold(()=>game.mode==='play'&&run.mode==='training');
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
        decals.setLimit(q.decals);
        renderFlags.hulls=q.hulls!==false;
        player.root.traverse(o=>{
            if (o.name==='hull') {
                o.visible=renderFlags.hulls;
            }
        });
        renderer.applyQuality();
        overlay.refresh();
        renderer.post.setBoilScale(boilScale());
        setJitterScale(boilScale());
        time.freezeBoil=settings.reducedMotion||boilScale()<=0;
        time.boilFps=TUNING.boil.fpsMin+(TUNING.boil.fps-TUNING.boil.fpsMin)*Math.min(1,boilScale());
    }
    function resize() {
        const w=Math.max(1,window.innerWidth);
        const h=Math.max(1,window.innerHeight);
        const U=TUNING.ui.scale;
        uiS=Math.max(U.min,Math.min(1,h/U.refH,w/U.refW));
        const vw=w/uiS;
        const vh=h/uiS;
        renderer.resize(w,h);
        overlay.resize(w,h,uiS);
        input.uiScale=uiS;
        input.resize(w,h);
        hand.resize(vw,vh);
        deckView.resize(vw,vh);
        reward.resize(vw,vh);
        upgradeView.resize(vw,vh);
        summary.resize(vw,vh);
        for (const m of menus) {
            m.resize(vw,vh);
        }
        art.setScale(overlay.dpr*hand.s*uiS*1.2);
        rig.setAspect(w/h);
    }
    let debugHide=false;
    input.onToggleDebug=()=>{
        if (settings.godMode) {
            debugHide=!debugHide;
        }
    };
    input.onCycleQuality=()=>{
        const i=QUALITY_ORDER.indexOf(settings.quality);
        settings.quality=QUALITY_ORDER[(i+1)%QUALITY_ORDER.length];
        autoDrop.base=null;
        settings.qualityAuto=false;
        saveSettings();
        applyQuality();
    };
    input.ui={
        down:(x,y,id,type,button)=>{
            audio.unlock();
            if (type!=='mouse') {
                input.lastDevice='touch';
            }
            checkDevice();
            if (langPick.open) {
                return langPick.down(x,y);
            }
            if (confirmPop.open) {
                return confirmPop.down(x,y);
            }
            if (chestView.open) {
                return chestView.down(x,y);
            }
            if (buyPrompt.open) {
                return buyPrompt.down(x,y);
            }
            if (revivePopup.open) {
                return revivePopup.down(x,y);
            }
            if (game.mode==='play'&&overlay.hud.relicInfo) {
                overlay.hud.openRelicInfo('');
                audio.play('ui');
                return true;
            }
            if (game.mode==='play'&&(pauseMenu.open||run.state!=='combat')&&!reward.open&&!choice.open&&!deckPick.open&&!summary.open&&!upgradeView.open) {
                const rid=overlay.hud.hitRelic(x,y,overlay.width);
                if (rid) {
                    overlay.hud.openRelicInfo(rid);
                    audio.play('ui');
                    return true;
                }
            }
            if (levelUp.open) {
                return levelUp.down(x,y);
            }
            if (popup.open) {
                return popup.down(x,y);
            }
            if (guide.open) {
                return guide.down(x,y);
            }
            if (settingsMenu.open) {
                return settingsMenu.down(x,y);
            }
            if (codex.open) {
                return codex.down(x,y);
            }
            if (levelView.open) {
                return levelView.down(x,y);
            }
            if (relicView.open) {
                return relicView.down(x,y);
            }
            if (achView.open) {
                return achView.down(x,y);
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
            if (deckPick.open) {
                return deckPick.down(x,y);
            }
            if (choice.open) {
                return choice.down(x,y);
            }
            if (transition.active||fx.cutin) {
                return true;
            }
            if (deckView.open) {
                if (!(type==='mouse'?deckView.tap(x,y,type):deckView.press(x,y))) {
                    closeDeck();
                }
                return true;
            }
            if (overlay.hud.hitPause(x,y,overlay.width)) {
                openPause();
                return true;
            }
            if (run.course&&run.mode==='endless'&&!transition.active&&overlay.hud.hitCourse(x,y,overlay.width)) {
                openCourseGuide(run.course.id,false);
                return true;
            }
            if (coach.open) {
                return coach.down(x,y);
            }
            if (type!=='mouse'&&marks.hitPrompt(x,y)&&tryInteract()) {
                return true;
            }
            if (resumeT>0||modalShown()) {
                return true;
            }
            return hand.down(x,y,id,type,button);
        },
        move:(x,y,id,type)=>{
            if (guide.open) {
                guide.move(x,y);
                return;
            }
            if (summary.open) {
                summary.move(x,y);
            }
            if (settingsMenu.open) {
                settingsMenu.move(x,y);
                return;
            }
            if (codex.open) {
                codex.move(x,y);
                return;
            }
            if (deckView.open&&deckView.drag) {
                deckView.move(x,y);
                return;
            }
            if (levelView.open) {
                levelView.move(x,y);
                return;
            }
            if (relicView.open) {
                relicView.move(x,y);
                return;
            }
            if (achView.open) {
                achView.move(x,y);
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
            if (trainingMenu.open) {
                trainingMenu.move(x,y);
                return;
            }
            if (modalShown()) {
                return;
            }
            hand.move(x,y,id,type);
        },
        up:(x,y,id,type,button)=>{
            guide.up();
            deckView.up();
            summary.up();
            settingsMenu.up();
            codex.up(x,y);
            levelView.up();
            achView.up();
            relicView.up();
            skinEditor.up(x,y);
            trainingPicker.up(x,y);
            trainingMenu.up(x,y);
            if (modalShown()) {
                hand.cancelTargeting();
                return;
            }
            hand.up(x,y,id,type,button);
        },
        hover:(x,y)=>{
            for (const m of menus) {
                if (m.open) {
                    m.hover(x,y);
                }
            }
            if (summary.open) {
                summary.hover(x,y);
            }
            reward.hoverAt(x,y);
            deckView.hover(x,y);
            hand.hoverAt(x,y,pauseMenu.open);
        },
        leave:()=>hand.leave(),
        clearHover:()=>{
            const far=TUNING.input.far;
            for (const m of menus) {
                if (m.clearHover) {
                    m.clearHover();
                }
                else {
                    m.hover(far,far);
                }
            }
            summary.hover(far,far);
        }
    };
    input.onCardKey=i=>{
        if (resumeT<=0&&!fx.cutin&&!guide.open&&!deckView.open&&!trainingPicker.open&&!trainingMenu.open&&!reward.open&&!choice.open&&!deckPick.open&&!summary.open&&!pauseMenu.open&&run.state==='combat') {
            hand.keyPlay(i);
        }
    };
    input.onDeckKey=()=>{
        if (reward.open||upgradeView.open||choice.open||deckPick.open||summary.open||codex.open||settingsMenu.open||game.mode!=='play') {
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
        if (confirmPop.open) {
            if (confirmPop.done<0) {
                confirmPop.actions.no();
                confirmPop.hide();
            }
            return;
        }
        if (chestView.open) {
            chestView.skip();
            return;
        }
        if (buyPrompt.open) {
            buyPrompt.actions.cancel();
            buyPrompt.hide();
            return;
        }
        if (revivePopup.open) {
            return;
        }
        if (achView.open) {
            achView.actions.back();
            return;
        }
        if (popup.open) {
            popup.actions.close();
            return;
        }
        if (guide.open) {
            guide.actions[guide.opts.esc||(guide.cancelBtn?'cancel':'ok')]();
            return;
        }
        if (choice.open||deckPick.open) {
            return;
        }
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
        if (levelUp.open) {
            levelUp.down();
            return;
        }
        if (levelView.open) {
            levelView.hide();
            return;
        }
        if (relicView.open) {
            if (!relicView.anim) {
                relicView.actions.back();
            }
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
            if (!trainingMenu.closeDropdown()) {
                closeTrainingMenu();
            }
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
            tutNotify('cancel');
            return;
        }
        openPause();
    };
    // Android back button (called from MainActivity). Returns true when the game used it,
    // false when the system may close the app (second back press within 2 s on the idle main menu).
    let lastExitBack=-1e9;
    window.__inkrageBack=()=>{
        const idleMenu=game.mode==='menu'&&!popup.open&&!guide.open&&!settingsMenu.open&&!codex.open&&!levelUp.open&&!levelView.open&&!relicView.open&&!skinEditor.open&&!trainingPicker.open&&!achView.open&&!chestView.open&&!buyPrompt.open&&!confirmPop.open;
        if (idleMenu) {
            const now=performance.now();
            if (now-lastExitBack<2000) {
                return false;
            }
            lastExitBack=now;
            overlay.hud.toast(t('exit.again'),'exit.again');
            audio.play('ui',0.7);
            return true;
        }
        input.onEscape();
        return true;
    };
    input.onWheel=dy=>{
        guide.wheel(dy);
        deckView.wheel(dy);
        codex.wheel(dy);
        summary.wheel(dy);
        levelView.wheel(dy);
        relicView.wheel(dy);
        trainingPicker.wheel(dy);
        trainingMenu.wheel(dy);
        skinEditor.wheel(dy);
        achView.wheel(dy);
    };
    input.canStick=()=>!modalShown()&&!popup.open&&!guide.open&&!coach.open&&!fx.cutin&&game.mode==='play'&&!pauseMenu.open&&!deckView.open&&!trainingPicker.open&&!trainingMenu.open&&!reward.open&&!upgradeView.open&&!choice.open&&!deckPick.open&&!summary.open&&!transition.active&&!settingsMenu.open&&!codex.open;
    let skillToggle=false;
    let skillQuick=false;
    input.onSkill=(type,slot,vx,vy,mag,moved)=>{
        if (type==='cancel') {
            skillQuick=false;
            hand.cancelTargeting();
            tutNotify('cancel');
            audio.play('ui',0.7);
            return;
        }
        if (run.state!=='combat'||!input.canStick()) {
            return;
        }
        const tv=hand.targetView;
        if (type==='down') {
            skillQuick=hand.quickCast(slot);
            if (skillQuick) {
                return;
            }
            skillToggle=!!(tv&&tv.slot===slot);
            if (!skillToggle) {
                hand.selectSlot(slot);
            }
            return;
        }
        if (skillQuick) {
            skillQuick=false;
            return;
        }
        if (moved&&mag>0&&tv&&tv.slot===slot) {
            hand.stickCast(vx,vy,mag,false);
            return;
        }
        if (!moved&&skillToggle) {
            hand.cancelTargeting();
            tutNotify('cancel');
        }
    };
    input.onAimRelease=(vx,vy,mag,tap)=>{
        if (hand.targetView&&run.state==='combat'&&input.canStick()) {
            hand.stickCast(vx,vy,mag,tap);
        }
    };
    input.onInteract=()=>tryInteract();
    input.onPauseKey=()=>{
        if (pauseMenu.open) {
            closePause();
        }
        else {
            openPause();
        }
    };
    window.addEventListener('keydown',()=>audio.unlock());
    window.addEventListener('keydown',e=>{
        if (langPick.open&&e.code==='Enter') {
            langPick.confirm();
            return;
        }
        if (!coach.open||pauseMenu.open||upgradeView.open) {
            return;
        }
        if (e.code==='ArrowRight'||e.code==='Enter'||e.code==='Space') {
            coach.press();
        }
    });
    input.onFirstTouch=()=>{
        if (settings.fullscreen) {
            requestFullscreen();
        }
    };
    const gestureFull=()=>{
        if (settings.fullscreen&&!document.fullscreenElement) {
            requestFullscreen();
        }
    };
    window.addEventListener('pointerdown',gestureFull);
    window.addEventListener('keydown',e=>{
        if (e.code!=='Escape') {
            gestureFull();
        }
    });
    const autoPause=()=>{
        if (metaDirty()) {
            flushMeta();
        }
        input.resetPointers();
        hand.cancelTargeting();
        if (game.mode==='play'&&!pauseMenu.open&&!trainingMenu.open&&!trainingPicker.open&&!fx.cutin) {
            openPause();
        }
    };
    document.addEventListener('visibilitychange',()=>{
        if (document.hidden) {
            autoPause();
        }
        else if (device.native) {
            audio.unlock();
        }
    });
    window.addEventListener('blur',autoPause);
    document.addEventListener('fullscreenchange',()=>{
        setTimeout(resize,60);
        if (!document.fullscreenElement&&settings.fullscreen&&game.mode==='play'&&!pauseMenu.open&&!trainingMenu.open) {
            openPause();
        }
    });
    overlay.showDebug=false;
    window.addEventListener('resize',resize);
    window.addEventListener('orientationchange',()=>setTimeout(resize,150));
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize',resize);
    }
    resize();
    applyQuality();
    const debugInfo={fps:0,calls:0,triangles:0,quality:'',pixelRatio:1,resolution:''};
    const projectFn=(x,y,z,out)=>toUi(rig.worldToScreen(tmpV.set(x,y,z),renderer.width,renderer.height,out));
    const gameUi={confirmPop,achView,chestView,buyPrompt,revivePopup,achToast,effects,clones,dmgNums,project:projectFn,ink,hand,art,deckView,deck,run,enemies,reward,upgradeView,summary,transition,dt:0,mode:'menu',mainMenu,pause:pauseMenu,settingsMenu,codex,levelView,trainingPicker,skinEditor,trainingMenu,trainStats,ultCutin,coach,langPick,relicView,popup,guide,choice,deckPick,doors,npcs,marks,levelUp,minis,player};
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
        for (let i=0;i<B.tries;i++) {
            const s=game.room.freeSpot(dropRng);
            if (s&&Math.hypot(s.x-player.pos.x,s.z-player.pos.z)>=B.minPlayerDist&&!enemies.list.some(e=>e.alive&&Math.hypot(s.x-e.pos.x,s.z-e.pos.z)<B.minFoeDist+(e.def.radius||0))) {
                pickups.spawn('ink',s.x,s.z,B.ink);
                rings.spawn(s.x,s.z,1.2,'ink',0.4);
                particles.burst(s.x,2.5,s.z,8,{speed:[1,3],up:[-4,-1],size:[0.08,0.14]});
                return;
            }
        }
    }
    const dropRng=new RNG(4242);
    let skinZoom=0;
    let achCheckT=0;
    const NO_AIM={mode:'none'};
    const spin={yaw:null,acc:0,idle:0,back:0,x:0,z:0};
    function trackSpin(dt) {
        const K=TUNING.spin;
        if (game.mode!=='play'||fx.paused||dt<=0||run.state==='dead') {
            spin.yaw=null;
            return;
        }
        const y=player.aimYaw;
        if (spin.yaw===null) {
            spin.yaw=y;
            spin.x=player.pos.x;
            spin.z=player.pos.z;
            return;
        }
        let d=y-spin.yaw;
        d=Math.atan2(Math.sin(d),Math.cos(d));
        spin.yaw=y;
        if (Math.hypot(player.pos.x-spin.x,player.pos.z-spin.z)>K.radius) {
            spin.acc=0;
            spin.x=player.pos.x;
            spin.z=player.pos.z;
        }
        if (Math.abs(d)/dt<K.still) {
            spin.idle+=dt;
            if (spin.idle>K.pause) {
                spin.acc=0;
            }
            return;
        }
        spin.idle=0;
        if (spin.acc!==0&&Math.sign(d)!==Math.sign(spin.acc)) {
            spin.back+=Math.abs(d);
            if (spin.back>K.back) {
                spin.acc=d;
                spin.back=0;
            }
            return;
        }
        spin.back=0;
        spin.acc+=d;
        setMax('spinTurns',Math.floor(Math.abs(spin.acc)/(Math.PI*2)));
    }
    function update(dt) {
        if (run.state!=='dead') {
            player.update(dt,input,ctx,game.mode==='menu'?NO_AIM:aim);
        }
        trackSpin(dt);
        shared.uMist.value.x+=(player.pos.x-shared.uMist.value.x)*Math.min(1,dt*TUNING.fog.mist.follow);
        shared.uMist.value.y+=(player.pos.z-shared.uMist.value.y)*Math.min(1,dt*TUNING.fog.mist.follow);
        if (run.mode==='training'&&game.mode==='play') {
            player.hp=player.maxHp;
            if (ink.value<TUNING.training.ink) {
                ink.value=TUNING.training.ink;
            }
            if (settings.training.ammo) {
                player.ammo=player.W.magazine;
            }
            trainStats.lastT=Math.max(0,trainStats.lastT-dt*3);
            trainStats.hurtT=Math.max(0,trainStats.hurtT-dt*1.5);
            trainStats.clock+=dt;
            const cut=trainStats.clock-TUNING.training.dpsWindow;
            while (trainStats.log.length>0&&trainStats.log[0].t<cut) {
                trainStats.log.shift();
            }
        }
        if (run.tutorial()&&game.mode==='play') {
            player.hp=player.maxHp;
            if (hand.visible()) {
                ink.value=ink.max;
            }
        }
        ink.max=TUNING.ink.max+inkMaxBonus();
        tickRelics(dt);
        if (overlay.hud.relicInfo&&game.mode==='play'&&run.state==='combat') {
            overlay.hud.openRelicInfo('');
        }
        holdRelic('lastStand',lowHp(player.hp));
        if (game.mode==='play'&&run.state==='combat'&&!fx.cutin&&run.mode!=='training') {
            const drip=dripRelic(dt);
            if (drip>0) {
                ink.add(drip);
            }
        }
        const cr=game.mode==='play'&&run.course&&run.state==='combat'?run.course:null;
        player.courseSpeed=cr?cr.playerSpeed():1;
        player.courseDash=cr?cr.dashRate():1;
        const hurry=(game.mod==='hurry'&&game.mode==='play'?1.25:1)*(cr?cr.enemyRate():1);
        enemies.update(dt*hurry,ctx);
        updateTaunts(dt);
        pickups.update(dt,player,(type,x,z,amount)=>{
            const P=TUNING.props;
            audio.play('clear',1.5);
            if (type==='ink') {
                const n=amount||P.pickupInk;
                ink.add(n);
                floatText(x,z,t('pickup.ink',{n}));
            }
            else {
                player.hp=Math.min(player.maxHp,player.hp+P.pickupHeal);
                floatText(x,z,t('pickup.heal',{n:P.pickupHeal}));
            }
            particles.burst(x,1,z,10,{color:type==='ink'?'ink':'farGray',speed:[1,3],up:[2,5]});
        });
        updateBossDrops(dt);
        const room=game.room;
        playerBullets.update(dt,room);
        enemyBullets.update(dt*hurry,room);
        chalkBullets.frozen=enemyBullets.frozen;
        chalkBullets.update(dt,room);
        pierceBullets.update(dt,room);
        for (const s of extraSys) {
            s.update(dt,room);
        }
        strokes.update(dt);
        updateSwings(dt);
        clearCompassBullets();
        updateBeam(dt);
        homingBullets.update(dt,room);
        lobs.update(dt);
        deck.update(dt);
        hand.idleT=run.state==='combat'&&run.mode!=='training'&&run.mode!=='tutorial'&&hand.visible()?(hand.idleT||0)+dt:0;
        room.update(dt,enemies);
        effects.update(dt);
        for (const c of allClones) {
            c.update(dt,ctx);
        }
        for (const sh of allShards()) {
            sh.update(dt);
        }
        particles.update(dt);
        decals.update(dt);
        if (game.mode==='play') {
            run.update(dt,player);
            minis.update(dt,player);
            npcs.update(dt,player,i=>run.canInteract(i));
            doors.update(dt,player);
            input.interactReady=!fx.paused&&!transition.active&&((doors.focus>=0&&run.canExit())||(npcs.focus>=0&&run.canInteract(npcs.focus))||minis.wantsInteract(player));
            buyArmT-=dt;
            if (npcs.armed>=0&&(npcs.focus!==npcs.armed||buyArmT<=0||!input.interactReady||input.lastDevice!=='touch')) {
                npcs.armed=-1;
            }
            input.interactArmed=npcs.armed>=0;
        }
    }
    function updateDamageFx(dt) {
        bleed=Math.max(0,bleed-DF.bleedDecay*dt);
        let low=0;
        const f=player.hp/player.maxHp;
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
    const gov={scale:1,acc:0,n:0,good:0,slow:0,cool:0};
    function setRenderScale(k) {
        gov.scale=k;
        renderer.setScale(k);
    }
    function updatePerf(dt) {
        const P=TUNING.perf;
        if (document.hidden||dt>P.hitch||transition.active) {
            gov.acc=0;
            gov.n=0;
            return;
        }
        gov.cool-=dt;
        gov.acc+=dt;
        gov.n++;
        if (gov.acc<P.window) {
            return;
        }
        const fps=gov.n/gov.acc;
        gov.acc=0;
        gov.n=0;
        const target=time.fpsCap||TUNING.loop.fpsOptions[0];
        const min=P.minScale[settings.quality]??P.minScale.mid;
        if (fps<target*P.low) {
            gov.good=0;
            if (gov.scale>min+0.001) {
                if (gov.cool<=0) {
                    setRenderScale(Math.max(min,gov.scale-P.down));
                    gov.cool=P.coolDown;
                }
                return;
            }
            gov.slow+=P.window;
            if (gov.slow>=P.dropAfter&&game.mode==='play'&&!fx.paused&&settings.qualityAuto&&settings.quality!=='low') {
                gov.slow=0;
                autoDrop.base=autoDrop.base||settings.quality;
                settings.quality=settings.quality==='high'?'mid':'low';
                applyQuality();
                setRenderScale(1);
                resize();
                overlay.hud.toast(t('perf.lowered'));
            }
            return;
        }
        gov.slow=0;
        if (fps>=target*P.high) {
            gov.good+=P.window;
            if (gov.good>=P.upAfter&&gov.scale<1&&gov.cool<=0) {
                setRenderScale(Math.min(1,gov.scale+P.up));
                gov.good=0;
                gov.cool=P.coolUp;
            }
        }
        else {
            gov.good=0;
        }
    }
    function musicTrack() {
        const p=run.plan;
        if (game.mode!=='play'||summary.open||!p) {
            return game.mode==='menu'&&relicView.shown()?'gacha':'menu';
        }
        if ((run.mode==='training'&&!p.trainGame)||run.tutorial()) {
            return 'training';
        }
        if (!p.peace||run.state==='combat') {
            return p.boss?'boss':'battle';
        }
        return p.game?'game':'peace';
    }
    function render(dt,alpha) {
        probeFps(dt);
        if (run.tutorial()&&((deckView.open&&deckView.hovered())||(pauseMenu.open&&hand.hover))) {
            tutNotify('detail');
        }
        tickResume(dt);
        if (pendingGuide&&!transition.active&&game.mode==='play'&&run.state==='combat'&&!pauseMenu.open) {
            const gid=pendingGuide;
            pendingGuide=null;
            openCourseGuide(gid,true);
        }
        if (pendingBoss&&!transition.active&&game.mode==='play'&&run.state==='combat'&&!pauseMenu.open&&!guide.open&&!codex.open&&!fx.cutin) {
            bossIntroT-=dt;
            if (bossIntroT<=0) {
                const bid=pendingBoss;
                pendingBoss=null;
                openBossIntro(bid);
            }
        }
        gameUi.resumeT=resumeT;
        setTouchText(input.lastDevice==='touch');
        music.update(musicTrack());
        music.setDuck((pauseMenu.open&&!settingsMenu.open&&!codex.open)||relicView.rolling());
        fx.update(dt);
        tweens.update(dt*time.timeScale,dt);
        setBoilSeed(time.boilIndex);
        if (game.mode==='menu') {
            const a=menuAngle+(skinEditor.shown()?skinEditor.dragYaw+skinEditor.spinYaw():Math.sin(time.real*0.7)*TUNING.menu.sway);
            player.faceDir(Math.sin(a),Math.cos(a));
            player.moveYaw=a;
        }
        player.sync(alpha);
        enemies.sync(alpha,dt);
        playerBullets.render(alpha);
        enemyBullets.render(alpha);
        chalkBullets.render(alpha);
        pierceBullets.render(alpha);
        for (const s of extraSys) {
            s.render(alpha);
        }
        strokes.render(alpha);
        beam.render();
        beamL.render();
        homingBullets.render(alpha);
        lobs.render(alpha);
        particles.render();
        rings.update(dt*time.timeScale);
        dangerRings.update(dt*time.timeScale);
        floorMarks.update(run.course&&run.course.id==='music'?run.course.rings:null,TUNING.courses.music.radius+0.3,TUNING.courses.music.life,time.real);
        preview.update(dt);
        const touchCast=input.lastDevice==='touch'&&!!hand.targetView;
        input.aimForCard=touchCast;
        const sd=input.skillDrag();
        if (sd&&touchCast&&!sd.cancel&&hand.targetView.card.def.targeting==='aura'&&sd.mag>=TUNING.input.skill.auraCast) {
            hand.stickCast(sd.vx,sd.vy,sd.mag,false);
        }
        else if (sd&&touchCast) {
            hand.stickAim(sd.vx,sd.vy,sd.mag,true,true);
        }
        else {
            hand.stickAim(input.aim.vx,input.aim.vy,input.aim.mag,input.aim.id>=0,touchCast);
        }
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
        achCheckT-=dt;
        if (achCheckT<=0) {
            achCheckT=0.5;
            checkAch();
        }
        while (achQueue.length>0) {
            achToast.push(achQueue.shift());
            audio.play('equip',1.2);
        }
        ultCutin.update(fx.paused?0:dt);
        checkDevice();
        gameUi.dt=dt;
        gameUi.frozen=fx.paused||fx.cutin;
        gameUi.mode=game.mode;
        for (const c of allClones) {
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
            const MM=TUNING.menu;
            menuAngle+=dt*MM.camSpin*(1-skinZoom);
            const lvR=effectiveLevel();
            if (settings.weapon===RANDOM_WEAPON.id&&weaponUnlocked(RANDOM_WEAPON.id,lvR)) {
                randT-=dt;
                if (randT<=0) {
                    randT=MM.randomCycle;
                    const list=unlockedWeapons(lvR);
                    quietEquip=true;
                    player.setWeapon(list[(list.indexOf(player.weaponId)+1)%list.length]);
                    quietEquip=false;
                }
            }
            else {
                randT=0;
            }
            const cam=rig.camera;
            const z=EASE.easeInOutCubic(skinZoom);
            const sa=Math.sin(menuAngle);
            const ca=Math.cos(menuAngle);
            const p=player.renderPos;
            const R=MM.camRadius+(S.dist-MM.camRadius)*z;
            cam.position.set(p.x+sa*R,MM.camHeight+(S.height-MM.camHeight)*z,p.z+ca*R);
            cam.lookAt(p.x,MM.camLook+(S.look-MM.camLook)*z,p.z);
            const W=renderer.width;
            const H=renderer.height;
            skinEditor.layout();
            const pf=Math.min(0.8,(skinEditor.P.x+skinEditor.P.w)/Math.max(1,skinEditor.width));
            cam.setViewOffset(W,H,W*(MM.colFrac/2)*(1-z)-W*pf/2*z,0,W,H);
            if (cam.fov!==TUNING.camera.fov) {
                cam.fov=TUNING.camera.fov;
                cam.updateProjectionMatrix();
            }
            cam.updateMatrixWorld();
        }
        else if (rig.camera.view&&rig.camera.view.enabled) {
            rig.camera.clearViewOffset();
        }
        if (game.mode!=='menu'&&!viewFrozen) {
            const mv=game.mode==='play'?minis.view(player):null;
            if (mv) {
                rig.frame(mv);
            }
            else {
                rig.zoomTarget=1;
                rig.follow(player.renderPos,look.x,look.z);
            }
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
        debugInfo.scale=gov.scale;
        debugInfo.cap=time.fpsCap;
        overlay.showDebug=!!settings.godMode&&!debugHide;
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
    equipWeapon();
    enterMenu();
    const keep=new THREE.Group();
    keep.visible=false;
    const kg=new THREE.BoxGeometry(0.1,0.1,0.1);
    const J=TUNING.boil.vertexJitter;
    for (const m of [toonMaterial({jitter:J,unique:true,yreveal:true}),toonMaterial({light:'farGray',mid:'midGray',dark:'nearGray',reveal:true,unique:true,jitter:J*0.6}),dissolveVariant(toonMaterial({light:'farGray',mid:'midGray',dark:'nearGray'})),dissolveVariant(toonMaterial({light:'paper',mid:'farGray',dark:'midGray'}))]) {
        keep.add(new THREE.Mesh(kg,m));
    }
    world.add(keep);
    doors.prewarm();
    for (const type of Object.keys(ENEMIES)) {
        shardsFor(enemies.spawn(type,0,-40,{quick:true}));
    }
    warmShaders();
    enterMenu();
    if (device.native) {
        // the app's WebView allows audio without a tap, so the menu music can start right away
        audio.unlock();
    }
    if (!settings.langChosen) {
        langPick.show();
    }
    else if (!settings.tutorialSeen) {
        startGame('tutorial');
    }
    else {
        offerResume();
    }
    if (!device.fullscreen&&!device.native) {
        setTimeout(()=>popup.open2(t('fullscreen.title'),t('fullscreen.body')),(TUNING.ui.loaderMin+TUNING.ui.loaderFade)*1000);
    }
    checkForUpdate(key=>overlay.hud.toast(t(key),key));
    window.INKRAGE={ctx,guide,overlay,confirmPop,achView,chestView,buyPrompt,revivePopup,achToast,progress,langPick,levelUp,doors,npcs,minis,marks,choice,deckPick,popup,device,weaponSys,relicView,coach,audio,ultCutin,trainingMenu,trainStats,skinEditor,trainingPicker,levelView,transition,hand,deck,ink,effects,deckView,renderer,scene,fxScene,rig,player,input,game,run,reward,upgradeView,pickups,summary,codex,pauseMenu,mainMenu,settingsMenu,settings,time,applyQuality,enemies,playerBullets,enemyBullets,particles,fx};
}

boot();
