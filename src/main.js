import*as THREE from 'three';
import {PALETTE} from './data/palette.js';
import {TUNING} from './data/tuning.js';
import {LEVELS} from './data/levels.js';
import {t} from './data/strings.js';
import {createLoop,time} from './core/loop.js';
import {Input} from './core/input.js';
import {CameraRig} from './core/cameraRig.js';
import {createScene} from './core/scene.js';
import {tweens} from './core/tween.js';
import {detectDevice,loadSettings,saveSettings,settings,qualityConfig,boilScale,device} from './core/settings.js';
import {Renderer} from './render/renderer.js';
import {initMaterials,setBoilSeed,setJitterScale,setShadowQuality} from './render/materials.js';
import {createPaperTexture,createNoiseTexture} from './render/paperTexture.js';
import {createHatchTexture} from './render/hatching.js';
import {Overlay} from './ui2d/overlay.js';
import {buildRoom} from './game/terrain.js';
import {Player} from './game/player.js';

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
    const {scene,world,actors}=createScene();
    const room=buildRoom(LEVELS.test,world);
    const player=new Player(actors);
    player.spawn(room.spawn);
    const rig=new CameraRig(1);
    rig.setBounds(room.bounds);
    rig.follow(player.pos,0,0);
    rig.snap();
    player.events.onDash=()=>{
        rig.fovPunch(TUNING.player.dashFovPunch);
        rig.addTrauma(TUNING.player.dashTrauma);
    };
    const input=new Input(container);
    const overlay=new Overlay(document.getElementById('ui'));
    const aim={mode:'none',point:new THREE.Vector3(),dx:0,dz:-1,sx:0,sy:0};
    const look={x:0,z:0};
    function applyQuality() {
        const q=qualityConfig();
        textures.hatch.anisotropy=Math.min(q.anisotropy,renderer.gl.capabilities.getMaxAnisotropy());
        textures.hatch.needsUpdate=true;
        setShadowQuality(q.hatchedShadow);
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
    function update(dt) {
        player.update(dt,input,room,aim);
    }
    function render(dt,alpha) {
        tweens.update(dt*time.timeScale,dt);
        setBoilSeed(time.boilIndex);
        player.sync(alpha);
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
        renderer.render(scene,rig.camera);
        const st=renderer.stats();
        overlay.draw(input,player,{
            fps:time.fps,
            calls:st.calls,
            triangles:st.triangles,
            quality:settings.quality,
            pixelRatio:renderer.pixelRatio,
            resolution:renderer.post.target.width+'×'+renderer.post.target.height
        });
    }
    const loop=createLoop(update,render);
    loop.start();
    window.INKFALL={renderer,scene,rig,player,input,room,settings,time,applyQuality};
}

boot();
