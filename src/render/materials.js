import*as THREE from 'three';
import {PALETTE} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {TOON_VERT,TOON_FRAG,HULL_VERT,HULL_FRAG,UNLIT_VERT,UNLIT_FRAG,SHADOW_VERT,SHADOW_FRAG} from './shaders/toon.js';
import {PARTICLE_VERT,PARTICLE_FRAG,TRAIL_VERT,TRAIL_FRAG,FLASH_VERT,FLASH_FRAG,LINE_VERT,LINE_FRAG,DECAL_VERT,DECAL_FRAG,DASH_FRAG,RING_FRAG,TRAP_FRAG,INK_FRAG} from './shaders/fx.js';

const colorCache={};

export function pal(key) {
    if (!colorCache[key]) {
        colorCache[key]=new THREE.Color(PALETTE[key]);
    }
    return colorCache[key];
}

export const shared={
    uBoilSeed:{value:0},
    uFar:{value:TUNING.camera.far},
    uLightDir:{value:new THREE.Vector3()},
    uBands:{value:new THREE.Vector4()},
    tHatch:{value:null},
    tNoise:{value:null},
    tPaper:{value:null},
    uHatchScale:{value:TUNING.toon.hatchScale},
    uHatchJitter:{value:TUNING.boil.hatchJitter},
    uFogLift:{value:new THREE.Color()},
    uFogColor:{value:new THREE.Color()},
    uFog:{value:new THREE.Vector3()},
    uMist:{value:new THREE.Vector4(0,0,1000,1001)},
    uMistK:{value:0},
    uJitterScale:{value:1},
    tGBuf:{value:null},
    uScreen:{value:new THREE.Vector2(1,1)}
};

const cache=new Map();

export const renderFlags={hulls:true};
const jitterMaterials=[];

export function initMaterials(textures) {
    shared.tHatch.value=textures.hatch;
    shared.tNoise.value=textures.noise;
    shared.tPaper.value=textures.paper;
    const T=TUNING.toon;
    shared.uLightDir.value.set(T.lightDir[0],T.lightDir[1],T.lightDir[2]).normalize();
    shared.uBands.value.set(T.band1,T.band2,T.hatch2,T.hatch3);
    shared.uFogLift.value.copy(pal('farGray'));
    shared.uFogColor.value.copy(pal('paper'));
    shared.uFog.value.set(TUNING.fog.near,TUNING.fog.far,TUNING.fog.max);
}

export function setBoilSeed(seed) {
    shared.uBoilSeed.value=seed;
}

export function setJitterScale(s) {
    shared.uJitterScale.value=s;
    for (const m of jitterMaterials) {
        m.uniforms.uJitter.value=m.userData.baseJitter*s;
    }
}

function track(mat,jitter) {
    mat.userData.baseJitter=jitter;
    mat.uniforms.uJitter.value=jitter*shared.uJitterScale.value;
    jitterMaterials.push(mat);
    return mat;
}

export function toonMaterial(opts={}) {
    const light=opts.light||'paper';
    const mid=opts.mid||'midGray';
    const dark=opts.dark||'nearGray';
    const jitter=opts.jitter??0;
    const shift=opts.shift??0;
    const grid=opts.grid||null;
    const fxKey=(opts.reveal?'r':'')+(opts.dissolve?'d':'')+(opts.ghost?'g':'')+(opts.yreveal?'y':'');
    const key='toon|'+light+'|'+mid+'|'+dark+'|'+jitter+'|'+shift+'|'+(grid?grid.join(','):'')+'|'+fxKey+'|'+(opts.side??0);
    if (!opts.unique&&cache.has(key)) {
        return cache.get(key);
    }
    const defines={};
    const uniforms={
        uBoilSeed:shared.uBoilSeed,
        uFar:shared.uFar,
        uLightDir:shared.uLightDir,
        uBands:shared.uBands,
        tHatch:shared.tHatch,
        tNoise:shared.tNoise,
        uHatchScale:shared.uHatchScale,
        uHatchJitter:shared.uHatchJitter,
        uFogLift:shared.uFogLift,
        uFogColor:shared.uFogColor,
        uFog:shared.uFog,
        uMist:shared.uMist,
        uMistK:shared.uMistK,
        uColLight:{value:pal(light).clone()},
        uColMid:{value:pal(mid).clone()},
        uColDark:{value:pal(dark).clone()},
        uShift:{value:shift},
        uJitter:{value:0},
        uFlash:{value:0},
        uFlashColor:{value:pal('ink').clone()},
        uAlpha:{value:opts.alpha??1},
        uInk:{value:pal('ink').clone()}
    };
    if (opts.reveal) {
        defines.USE_REVEAL='';
        uniforms.uReveal={value:1};
        uniforms.uLen={value:1};
        uniforms.uCrack={value:0};
    }
    if (opts.dissolve) {
        defines.USE_DISSOLVE='';
        uniforms.uDissolve={value:0};
        uniforms.uSwipe={value:new THREE.Vector4(1,0,-1,1)};
        uniforms.uEdgeColor={value:pal('paper').clone()};
    }
    if (opts.yreveal) {
        defines.USE_YREVEAL='';
        uniforms.uRevealY={value:100};
    }
    if (opts.ghost) {
        defines.USE_GHOST='';
        uniforms.tGBuf=shared.tGBuf;
        uniforms.uScreen=shared.uScreen;
    }
    if (grid) {
        defines.USE_GRID='';
        uniforms.uGridColor={value:pal('farGray').clone()};
        uniforms.uGrid={value:new THREE.Vector3(TUNING.grid.size,TUNING.grid.width,TUNING.grid.alpha)};
        uniforms.uGridHalf={value:new THREE.Vector2(grid[0],grid[1])};
    }
    const mat=new THREE.ShaderMaterial({
        vertexShader:TOON_VERT,
        fragmentShader:TOON_FRAG,
        uniforms,
        defines,
        side:opts.side??THREE.FrontSide,
        transparent:!!opts.ghost,
        depthTest:!opts.ghost,
        depthWrite:!opts.ghost
    });
    mat.userData.opts={light,mid,dark,jitter,shift,side:opts.side};
    track(mat,jitter);
    if (!opts.unique) {
        cache.set(key,mat);
    }
    return mat;
}

export function hullMaterial(opts={}) {
    const color=opts.color||'ink';
    const width=opts.width??TUNING.outline.hullWidth;
    const jitter=opts.jitter??0;
    const key='hull|'+color+'|'+width+'|'+jitter;
    if (!opts.unique&&cache.has(key)) {
        return cache.get(key);
    }
    const mat=new THREE.ShaderMaterial({
        vertexShader:HULL_VERT,
        fragmentShader:HULL_FRAG,
        uniforms:{
            uBoilSeed:shared.uBoilSeed,
            uFar:shared.uFar,
            uJitter:{value:0},
            uWidth:{value:width},
            uMist:shared.uMist,
            uMistK:shared.uMistK,
            uFogColor:shared.uFogColor,
            uColor:{value:pal(color).clone()}
        },
        side:THREE.BackSide
    });
    track(mat,jitter);
    if (!opts.unique) {
        cache.set(key,mat);
    }
    return mat;
}

export function unlitMaterial(opts={}) {
    const color=opts.color||'red';
    const jitter=opts.jitter??0;
    const key='unlit|'+color+'|'+jitter;
    if (cache.has(key)) {
        return cache.get(key);
    }
    const mat=new THREE.ShaderMaterial({
        vertexShader:UNLIT_VERT,
        fragmentShader:UNLIT_FRAG,
        uniforms:{
            uBoilSeed:shared.uBoilSeed,
            uFar:shared.uFar,
            uJitter:{value:0},
            uColor:{value:pal(color).clone()}
        }
    });
    track(mat,jitter);
    cache.set(key,mat);
    return mat;
}

export function shadowMaterial(hatched) {
    const key='shadow|'+hatched;
    if (cache.has(key)) {
        return cache.get(key);
    }
    const mat=new THREE.ShaderMaterial({
        vertexShader:SHADOW_VERT,
        fragmentShader:SHADOW_FRAG,
        uniforms:{
            uBoilSeed:shared.uBoilSeed,
            uFar:shared.uFar,
            tHatch:shared.tHatch,
            tNoise:shared.tNoise,
            uHatchScale:{value:TUNING.shadow.hatchScale},
            uRadius:{value:1},
            uColor:{value:pal(hatched?'nearGray':'midGray').clone()}
        },
        defines:hatched?{USE_HATCH:''}:{},
        polygonOffset:true,
        polygonOffsetFactor:-2,
        polygonOffsetUnits:-2
    });
    cache.set(key,mat);
    return mat;
}

const shadowMeshes=new Set();
let shadowHatched=true;

export function registerShadow(mesh) {
    shadowMeshes.add(mesh);
    mesh.material=shadowMaterial(shadowHatched);
}

export function unregisterShadow(mesh) {
    shadowMeshes.delete(mesh);
}

export function setShadowQuality(hatched) {
    shadowHatched=hatched;
    for (const m of shadowMeshes) {
        m.material=shadowMaterial(hatched);
    }
}

function fxUniforms(extra) {
    return Object.assign({
        tGBuf:shared.tGBuf,
        uScreen:shared.uScreen,
        uFar:shared.uFar,
        tNoise:shared.tNoise,
        uBoilSeed:shared.uBoilSeed
    },extra);
}

export function particleMaterial() {
    return new THREE.ShaderMaterial({
        vertexShader:PARTICLE_VERT,
        fragmentShader:PARTICLE_FRAG,
        uniforms:fxUniforms({}),
        depthTest:false,
        depthWrite:false
    });
}

export function trailMaterial(color) {
    return new THREE.ShaderMaterial({
        vertexShader:TRAIL_VERT,
        fragmentShader:TRAIL_FRAG,
        uniforms:fxUniforms({uColor:{value:pal(color).clone()}}),
        transparent:true,
        depthTest:false,
        depthWrite:false,
        side:THREE.DoubleSide
    });
}

export function flashMaterial(atlas) {
    const extra={
        tAtlas:{value:atlas},
        uFrame:{value:0},
        uRot:{value:0},
        uScale:{value:1},
        uColor:{value:pal('ink').clone()}
    };
    return new THREE.ShaderMaterial({
        vertexShader:FLASH_VERT,
        fragmentShader:FLASH_FRAG,
        uniforms:fxUniforms(extra),
        depthTest:false,
        depthWrite:false
    });
}

export function lineMaterial(color) {
    const extra={
        uColor:{value:pal(color).clone()},
        uLength:{value:1}
    };
    return new THREE.ShaderMaterial({
        vertexShader:LINE_VERT,
        fragmentShader:LINE_FRAG,
        uniforms:fxUniforms(extra),
        depthTest:false,
        depthWrite:false
    });
}

export function decalMaterial(atlas) {
    return new THREE.ShaderMaterial({
        vertexShader:DECAL_VERT,
        fragmentShader:DECAL_FRAG,
        uniforms:{
            tSplat:{value:atlas},
            tNoise:shared.tNoise,
            uFar:shared.uFar,
            uVariant:{value:0},
            uAge:{value:0},
            uSeed:{value:0},
            uColor:{value:pal('red').clone()},
            uColorOld:{value:pal('darkRed').clone()}
        },
        polygonOffset:true,
        polygonOffsetFactor:-3,
        polygonOffsetUnits:-3
    });
}

export function dashMaterial(color) {
    const extra={
        uColor:{value:pal(color).clone()},
        uLength:{value:1},
        uDash:{value:0.5},
        uTime:{value:0},
        uAlpha:{value:0.85}
    };
    return new THREE.ShaderMaterial({
        vertexShader:LINE_VERT,
        fragmentShader:DASH_FRAG,
        uniforms:fxUniforms(extra),
        transparent:true,
        depthTest:false,
        depthWrite:false,
        side:THREE.DoubleSide
    });
}

export function ringMaterial(color) {
    const extra={
        uColor:{value:pal(color).clone()},
        uAlpha:{value:1},
        uWidth:{value:0.12},
        uDash:{value:0},
        uTime:{value:0}
    };
    return new THREE.ShaderMaterial({
        vertexShader:LINE_VERT,
        fragmentShader:RING_FRAG,
        uniforms:fxUniforms(extra),
        transparent:true,
        depthTest:false,
        depthWrite:false,
        side:THREE.DoubleSide
    });
}

export function dissolveVariant(mat) {
    const o=mat.userData.opts;
    if (!o) {
        return null;
    }
    return toonMaterial({...o,dissolve:true,unique:true});
}

export function trapMaterial(color,noFill=false) {
    const extra={
        uColor:{value:pal(color).clone()},
        uProgress:{value:0},
        uAlpha:{value:1}
    };
    return new THREE.ShaderMaterial({
        vertexShader:LINE_VERT,
        fragmentShader:TRAP_FRAG,
        uniforms:fxUniforms(extra),
        defines:noFill?{NO_FILL:''}:{},
        transparent:true,
        depthTest:false,
        depthWrite:false
    });
}

export function inkMaterial(color) {
    const extra={
        uColor:{value:pal(color).clone()},
        uAlpha:{value:1},
        uLength:{value:1}
    };
    return new THREE.ShaderMaterial({
        vertexShader:LINE_VERT,
        fragmentShader:INK_FRAG,
        uniforms:fxUniforms(extra),
        transparent:true,
        depthTest:false,
        depthWrite:false,
        side:THREE.DoubleSide
    });
}
