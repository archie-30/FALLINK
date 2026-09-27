import*as THREE from 'three';
import {PALETTE} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {TOON_VERT,TOON_FRAG,HULL_VERT,HULL_FRAG,UNLIT_VERT,UNLIT_FRAG,SHADOW_VERT,SHADOW_FRAG} from './shaders/toon.js';

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
    uJitterScale:{value:1}
};

const cache=new Map();
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
    const key='toon|'+light+'|'+mid+'|'+dark+'|'+jitter+'|'+shift+'|'+(grid?grid.join(','):'')+'|'+(opts.unique?Math.random():'');
    if (cache.has(key)) {
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
        uColLight:{value:pal(light).clone()},
        uColMid:{value:pal(mid).clone()},
        uColDark:{value:pal(dark).clone()},
        uShift:{value:shift},
        uJitter:{value:0},
        uFlash:{value:0},
        uFlashColor:{value:pal('ink').clone()}
    };
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
        side:opts.side??THREE.FrontSide
    });
    track(mat,jitter);
    cache.set(key,mat);
    return mat;
}

export function hullMaterial(opts={}) {
    const color=opts.color||'ink';
    const width=opts.width??TUNING.outline.hullWidth;
    const jitter=opts.jitter??0;
    const key='hull|'+color+'|'+width+'|'+jitter;
    if (cache.has(key)) {
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
            uColor:{value:pal(color).clone()}
        },
        side:THREE.BackSide
    });
    track(mat,jitter);
    cache.set(key,mat);
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
