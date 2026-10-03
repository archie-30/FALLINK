import {GBUF_OUT,JITTER,MODEL_MATRIX} from './common.js';

export const TOON_VERT=`
${JITTER}
${MODEL_MATRIX}
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vDepth;
#ifdef USE_REVEAL
attribute float aReveal;
varying float vReveal;
#endif
void main() {
    #ifdef USE_REVEAL
    vReveal=aReveal;
    #endif
    mat4 m=getModel();
    vec3 p=position+boilJitter(position);
    vec4 wp=m*vec4(p,1.0);
    vWorldPos=wp.xyz;
    vWorldNormal=normalize(mat3(m)*normal);
    vec4 vp=viewMatrix*wp;
    vDepth=-vp.z;
    gl_Position=projectionMatrix*vp;
}
`;

export const TOON_FRAG=`
${GBUF_OUT}
uniform vec3 uColLight;
uniform vec3 uColMid;
uniform vec3 uColDark;
uniform vec3 uLightDir;
uniform vec4 uBands;
uniform float uShift;
uniform sampler2D tHatch;
uniform sampler2D tNoise;
uniform float uHatchScale;
uniform float uHatchJitter;
uniform float uBoilSeed;
uniform vec3 uFogLift;
uniform vec3 uFogColor;
uniform vec3 uFog;
uniform vec4 uMist;
uniform float uMistK;
uniform float uFar;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uAlpha;
uniform float uCalm;
uniform vec2 uHatch;
uniform vec3 uInk;
uniform float uSoftNormal;
#ifdef USE_REVEAL
uniform float uReveal;
uniform float uLen;
uniform float uCrack;
varying float vReveal;
#endif
#ifdef USE_DISSOLVE
uniform float uDissolve;
uniform vec4 uSwipe;
uniform vec3 uEdgeColor;
#endif
#ifdef USE_GHOST
uniform sampler2D tGBuf;
uniform vec2 uScreen;
#endif
#ifdef USE_YREVEAL
uniform float uRevealY;
#endif
#ifdef USE_GRID
uniform vec3 uGridColor;
uniform vec3 uGrid;
uniform vec2 uGridHalf;
#endif
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vDepth;
vec3 hatchSample(vec3 wp,vec3 wn) {
    vec3 an=abs(wn);
    vec2 uv;
    if (an.y>an.x&&an.y>an.z) {
        uv=wp.xz;
    }
    else if (an.x>an.z) {
        uv=wp.zy;
    }
    else {
        uv=wp.xy;
    }
    uv*=uHatchScale;
    vec2 j=texture2D(tNoise,uv*0.21+vec2(uBoilSeed*0.311,uBoilSeed*0.173)).rg-0.5;
    return texture2D(tHatch,uv+j*uHatchJitter).rgb;
}
void main() {
    #ifdef USE_GHOST
    if (vDepth>texture2D(tGBuf,gl_FragCoord.xy/uScreen).w*uFar+0.1) {
        discard;
    }
    #endif
    #ifdef USE_REVEAL
    if (vReveal>uReveal) {
        discard;
    }
    #endif
    #ifdef USE_YREVEAL
    if (vWorldPos.y>uRevealY) {
        discard;
    }
    #endif
    #ifdef USE_DISSOLVE
    float sw=(dot(vWorldPos.xz,uSwipe.xy)-uSwipe.z)/max(0.001,uSwipe.w-uSwipe.z);
    float dn=texture2D(tNoise,vWorldPos.xz*0.55+vWorldPos.y*0.37).b;
    float dv=sw*0.72+dn*0.28;
    float cut=uDissolve*1.35-0.2;
    if (dv<cut) {
        discard;
    }
    #endif
    vec3 n=normalize(vWorldNormal);
    if (!gl_FrontFacing) {
        n=-n;
    }
    float l=dot(n,normalize(uLightDir))+uShift;
    vec3 col;
    if (l>uBands.x) {
        col=uColLight;
    }
    else if (l>uBands.y) {
        col=uColMid;
    }
    else {
        vec3 h=hatchSample(vWorldPos,n);
        float ink=h.r;
        if (uHatch.x>0.999) {
            if (l<uBands.z) {
                ink=max(ink,h.g);
            }
            if (l<uBands.w) {
                ink=max(ink,h.b);
            }
        }
        col=mix(mix(uColMid,uColDark,uHatch.y),uColDark,ink*uHatch.x);
    }
    #ifdef USE_GRID
    vec2 g=abs(fract(vWorldPos.xz/uGrid.x+0.5)-0.5)*uGrid.x;
    vec2 w=fwidth(vWorldPos.xz);
    vec2 gg=1.0-smoothstep(vec2(uGrid.y),vec2(uGrid.y)+w*1.5,g);
    vec2 inside=step(abs(vWorldPos.xz),uGridHalf);
    float line=max(gg.x,gg.y)*inside.x*inside.y;
    col=mix(col,uGridColor,line*uGrid.z);
    #endif
    #ifdef USE_REVEAL
    if (uCrack>0.0) {
        float c1=abs(texture2D(tNoise,vec2(vReveal*uLen*0.21,vWorldPos.y*0.42+0.3)).r-0.5);
        float c2=abs(texture2D(tNoise,vec2(vReveal*uLen*0.33+0.5,vWorldPos.y*0.61+0.1)).g-0.5);
        if (min(c1,c2)<uCrack*0.018) {
            col=uInk;
        }
    }
    if (vReveal>uReveal-0.025&&uReveal<0.999) {
        col=uInk;
    }
    #endif
    #ifdef USE_DISSOLVE
    if (dv<cut+0.045) {
        col=uEdgeColor;
    }
    else if (dv<cut+0.06) {
        col=uColDark;
    }
    #endif
    #ifdef USE_YREVEAL
    if (vWorldPos.y>uRevealY-0.07) {
        col=uInk;
    }
    #endif
    #ifdef USE_GHOST
    vec3 hg=hatchSample(vWorldPos,n);
    float rim=1.0-abs(dot(normalize((viewMatrix*vec4(n,0.0)).xyz),vec3(0.0,0.0,1.0)));
    float lines=max(hg.r,hg.g*step(l,uBands.y));
    if (lines<0.45&&rim<0.55) {
        discard;
    }
    col=rim>=0.55?uInk:mix(uColMid,uColDark,lines);
    #endif
    float f=smoothstep(uFog.x,uFog.y,vDepth);
    col=mix(col,max(col,uFogLift),f);
    col=mix(col,uFogColor,f*f*uFog.z);
    col=mix(col,uFogColor,smoothstep(uMist.z,uMist.w,distance(vWorldPos.xz,uMist.xy))*uMistK);
    col=mix(col,uFlashColor,uFlash);
    vec3 vn=normalize((viewMatrix*vec4(n,0.0)).xyz);
    vn=normalize(mix(vn,vec3(0.0,0.0,1.0),uSoftNormal));
    gl_FragColor=vec4(col,uAlpha*(1.0-uCalm));
    gBuf=vec4(vn*0.5+0.5,vDepth/uFar);
}
`;

export const HULL_VERT=`
${JITTER}
${MODEL_MATRIX}
uniform float uWidth;
uniform vec4 uMist;
varying float vDepth;
varying float vMist;
void main() {
    mat4 m=getModel();
    vec3 p=position+boilJitter(position)+normalize(normal)*uWidth;
    vec4 wp=m*vec4(p,1.0);
    vMist=smoothstep(uMist.z,uMist.w,distance(wp.xz,uMist.xy));
    vec4 vp=viewMatrix*wp;
    vDepth=-vp.z;
    gl_Position=projectionMatrix*vp;
}
`;

export const HULL_FRAG=`
${GBUF_OUT}
uniform vec3 uColor;
uniform vec3 uFogColor;
uniform float uMistK;
uniform float uFar;
varying float vDepth;
varying float vMist;
void main() {
    gl_FragColor=vec4(mix(uColor,uFogColor,vMist*uMistK),1.0);
    gBuf=vec4(0.5,0.5,1.0,vDepth/uFar);
}
`;

export const UNLIT_VERT=`
${JITTER}
${MODEL_MATRIX}
varying vec3 vViewNormal;
varying float vDepth;
void main() {
    mat4 m=getModel();
    vec3 p=position+boilJitter(position);
    vec4 vp=viewMatrix*m*vec4(p,1.0);
    vViewNormal=normalize(mat3(viewMatrix)*mat3(m)*normal);
    vDepth=-vp.z;
    gl_Position=projectionMatrix*vp;
}
`;

export const UNLIT_FRAG=`
${GBUF_OUT}
uniform vec3 uColor;
uniform float uFar;
varying vec3 vViewNormal;
varying float vDepth;
void main() {
    gl_FragColor=vec4(uColor,1.0);
    gBuf=vec4(normalize(vViewNormal)*0.5+0.5,vDepth/uFar);
}
`;

export const SHADOW_VERT=`
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vViewNormal;
varying float vDepth;
void main() {
    vUv=uv;
    vec4 wp=modelMatrix*vec4(position,1.0);
    vWorldPos=wp.xyz;
    vec4 vp=viewMatrix*wp;
    vViewNormal=normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0));
    vDepth=-vp.z;
    gl_Position=projectionMatrix*vp;
}
`;

export const SHADOW_FRAG=`
${GBUF_OUT}
uniform vec3 uColor;
uniform sampler2D tHatch;
uniform sampler2D tNoise;
uniform float uHatchScale;
uniform float uBoilSeed;
uniform float uFar;
uniform float uRadius;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vViewNormal;
varying float vDepth;
void main() {
    vec2 c=vUv*2.0-1.0;
    float r=length(c);
    float a=atan(c.y,c.x);
    float edge=0.86+(texture2D(tNoise,vec2(a*0.16,uBoilSeed*0.37)).r-0.5)*0.35;
    if (r>edge*uRadius) {
        discard;
    }
    #ifdef USE_HATCH
    vec2 j=texture2D(tNoise,vWorldPos.xz*0.3+uBoilSeed*0.23).rg-0.5;
    vec3 h=texture2D(tHatch,vWorldPos.xz*uHatchScale+j*0.06).rgb;
    float th=mix(0.3,0.85,r/(edge*uRadius));
    if (max(h.r,h.g)<th) {
        discard;
    }
    #endif
    gl_FragColor=vec4(uColor,1.0);
    gBuf=vec4(normalize(vViewNormal)*0.5+0.5,vDepth/uFar);
}
`;
