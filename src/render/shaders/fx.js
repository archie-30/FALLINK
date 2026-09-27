import {GBUF_OUT} from './common.js';

export const OCCLUDE=`
uniform sampler2D tGBuf;
uniform vec2 uScreen;
uniform float uFar;
bool occluded(float d) {
    float s=texture2D(tGBuf,gl_FragCoord.xy/uScreen).w*uFar;
    return d>s+0.12;
}
`;

export const PARTICLE_VERT=`
varying vec3 vColor;
varying vec2 vUv;
varying float vDepth;
varying float vSeed;
void main() {
    vec4 c=modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);
    float s=length(instanceMatrix[0].xyz);
    vec4 vp=viewMatrix*c;
    vp.xy+=position.xy*s;
    vDepth=-vp.z;
    vUv=uv;
    vSeed=fract(float(gl_InstanceID)*0.6180339);
    #ifdef USE_INSTANCING_COLOR
    vColor=instanceColor;
    #else
    vColor=vec3(0.0);
    #endif
    gl_Position=projectionMatrix*vp;
}
`;

export const PARTICLE_FRAG=`
${OCCLUDE}
uniform sampler2D tNoise;
uniform float uBoilSeed;
varying vec3 vColor;
varying vec2 vUv;
varying float vDepth;
varying float vSeed;
void main() {
    if (occluded(vDepth)) {
        discard;
    }
    vec2 c=vUv*2.0-1.0;
    float a=atan(c.y,c.x);
    float edge=0.78+(texture2D(tNoise,vec2(a*0.16+vSeed*7.0,uBoilSeed*0.37+vSeed)).r-0.5)*0.55;
    if (length(c)>edge) {
        discard;
    }
    gl_FragColor=vec4(vColor,1.0);
}
`;

export const TRAIL_VERT=`
attribute float aAlpha;
varying vec2 vUv;
varying float vAlpha;
varying float vDepth;
void main() {
    vUv=uv;
    vAlpha=aAlpha;
    vec4 vp=viewMatrix*modelMatrix*vec4(position,1.0);
    vDepth=-vp.z;
    gl_Position=projectionMatrix*vp;
}
`;

export const TRAIL_FRAG=`
${OCCLUDE}
uniform vec3 uColor;
uniform sampler2D tNoise;
uniform float uBoilSeed;
varying vec2 vUv;
varying float vAlpha;
varying float vDepth;
void main() {
    if (vAlpha<=0.001||occluded(vDepth)) {
        discard;
    }
    float across=abs(vUv.y*2.0-1.0);
    float grain=texture2D(tNoise,gl_FragCoord.xy*0.013+vec2(uBoilSeed*0.21,0.0)).b;
    float a=vAlpha*(1.0-smoothstep(0.45,1.0,across));
    a*=smoothstep(0.25,0.55,grain+vAlpha*0.35);
    if (a<0.02) {
        discard;
    }
    gl_FragColor=vec4(uColor,a);
}
`;

export const FLASH_VERT=`
uniform float uRot;
uniform float uScale;
varying vec2 vUv;
varying float vDepth;
void main() {
    float c=cos(uRot);
    float s=sin(uRot);
    vec2 p=vec2(position.x*c-position.y*s,position.x*s+position.y*c)*uScale;
    vec4 vp=viewMatrix*modelMatrix*vec4(0.0,0.0,0.0,1.0);
    vp.xy+=p;
    vDepth=-vp.z;
    vUv=uv;
    gl_Position=projectionMatrix*vp;
}
`;

export const FLASH_FRAG=`
${OCCLUDE}
uniform sampler2D tAtlas;
uniform float uFrame;
uniform vec3 uColor;
varying vec2 vUv;
varying float vDepth;
void main() {
    if (occluded(vDepth-1.0)) {
        discard;
    }
    float m=texture2D(tAtlas,vec2((vUv.x+uFrame)/3.0,vUv.y)).a;
    if (m<0.5) {
        discard;
    }
    gl_FragColor=vec4(uColor,1.0);
}
`;

export const LINE_VERT=`
varying vec2 vUv;
varying float vDepth;
varying vec3 vWorldPos;
void main() {
    vUv=uv;
    vec4 wp=modelMatrix*vec4(position,1.0);
    vWorldPos=wp.xyz;
    vec4 vp=viewMatrix*wp;
    vDepth=-vp.z;
    gl_Position=projectionMatrix*vp;
}
`;

export const LINE_FRAG=`
${OCCLUDE}
uniform vec3 uColor;
uniform sampler2D tNoise;
uniform float uBoilSeed;
uniform float uLength;
varying vec2 vUv;
varying float vDepth;
varying vec3 vWorldPos;
void main() {
    if (occluded(vDepth)) {
        discard;
    }
    float across=abs(vUv.y*2.0-1.0);
    float n=texture2D(tNoise,vec2(vUv.x*uLength*0.35,uBoilSeed*0.29)).r-0.5;
    float w=0.62+n*0.5;
    w*=mix(1.0,0.35,smoothstep(0.75,1.0,vUv.x));
    if (across>w) {
        discard;
    }
    float g=texture2D(tNoise,vWorldPos.xz*1.7+uBoilSeed*0.11).b;
    if (g<0.28) {
        discard;
    }
    gl_FragColor=vec4(uColor,1.0);
}
`;

export const DECAL_VERT=`
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

export const DECAL_FRAG=`
${GBUF_OUT}
uniform sampler2D tSplat;
uniform sampler2D tNoise;
uniform float uVariant;
uniform float uAge;
uniform float uSeed;
uniform vec3 uColor;
uniform vec3 uColorOld;
uniform float uFar;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vViewNormal;
varying float vDepth;
void main() {
    float m=texture2D(tSplat,vec2((vUv.x+uVariant)/3.0,vUv.y)).r;
    float n=texture2D(tNoise,vUv*1.3+vec2(uSeed,uSeed*0.7)).b;
    float cut=0.5+smoothstep(0.35,1.0,uAge)*0.55-n*0.35*smoothstep(0.35,1.0,uAge);
    if (m<cut) {
        discard;
    }
    vec3 col=mix(uColor,uColorOld,smoothstep(0.05,0.4,uAge));
    gl_FragColor=vec4(col,1.0);
    gBuf=vec4(normalize(vViewNormal)*0.5+0.5,vDepth/uFar);
}
`;

export const DASH_FRAG=`
${OCCLUDE}
uniform vec3 uColor;
uniform float uLength;
uniform float uDash;
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
varying float vDepth;
varying vec3 vWorldPos;
void main() {
    if (occluded(vDepth)) {
        discard;
    }
    float d=fract(vUv.x*uLength/uDash-uTime);
    if (d>0.55) {
        discard;
    }
    float across=abs(vUv.y*2.0-1.0);
    if (across>0.8) {
        discard;
    }
    gl_FragColor=vec4(uColor,uAlpha);
}
`;

export const RING_FRAG=`
${OCCLUDE}
uniform vec3 uColor;
uniform float uAlpha;
uniform float uWidth;
uniform float uDash;
uniform float uTime;
uniform sampler2D tNoise;
uniform float uBoilSeed;
varying vec2 vUv;
varying float vDepth;
varying vec3 vWorldPos;
void main() {
    if (occluded(vDepth)) {
        discard;
    }
    vec2 c=vUv*2.0-1.0;
    float r=length(c);
    float a=atan(c.y,c.x);
    float n=(texture2D(tNoise,vec2(a*0.3+0.5,uBoilSeed*0.31)).r-0.5)*0.08;
    if (abs(r-(1.0-uWidth*0.5)+n)>uWidth*0.5) {
        discard;
    }
    if (uDash>0.0&&fract(a/6.2831853*uDash-uTime)>0.55) {
        discard;
    }
    gl_FragColor=vec4(uColor,uAlpha);
}
`;

export const TRAP_FRAG=`
${OCCLUDE}
uniform vec3 uColor;
uniform float uProgress;
uniform float uAlpha;
uniform sampler2D tNoise;
uniform float uBoilSeed;
varying vec2 vUv;
varying float vDepth;
varying vec3 vWorldPos;
void main() {
    if (occluded(vDepth)) {
        discard;
    }
    vec2 c=vUv*2.0-1.0;
    float r=length(c);
    if (r>1.0) {
        discard;
    }
    float a=atan(c.y,c.x)/6.2831853+0.5;
    float n=(texture2D(tNoise,vec2(a*2.0,uBoilSeed*0.3)).r-0.5)*0.06;
    float ring=abs(r-0.92+n);
    if (ring<0.04&&a<uProgress) {
        gl_FragColor=vec4(uColor,uAlpha);
        return;
    }
    #ifndef NO_FILL
    float ring2=abs(r-0.8-n*0.5);
    if (ring2<0.012&&a<uProgress*0.9&&fract(a*40.0)<0.5) {
        gl_FragColor=vec4(uColor,uAlpha*0.8);
        return;
    }
    float h=fract((vWorldPos.x+vWorldPos.z)*1.6+n*2.0);
    if (r<0.78&&h<0.14&&a<uProgress) {
        gl_FragColor=vec4(uColor,uAlpha*0.45);
        return;
    }
    #endif
    discard;
}
`;

export const INK_FRAG=`
${OCCLUDE}
uniform vec3 uColor;
uniform float uAlpha;
uniform float uLength;
uniform sampler2D tNoise;
uniform float uBoilSeed;
varying vec2 vUv;
varying float vDepth;
varying vec3 vWorldPos;
void main() {
    if (occluded(vDepth)) {
        discard;
    }
    float across=abs(vUv.y*2.0-1.0);
    float n=texture2D(tNoise,vec2(vUv.x*uLength*0.3,uBoilSeed*0.21)).r;
    float w=0.55+n*0.45;
    if (across>w) {
        discard;
    }
    float g=texture2D(tNoise,vWorldPos.xz*1.3).b;
    if (g<1.0-uAlpha*0.9) {
        discard;
    }
    gl_FragColor=vec4(uColor,0.92);
}
`;
