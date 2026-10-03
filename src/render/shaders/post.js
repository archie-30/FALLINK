export const POST_VERT=`
varying vec2 vUv;
void main() {
    vUv=uv;
    gl_Position=vec4(position.xy,0.0,1.0);
}
`;

export const POST_FRAG=`
uniform sampler2D tColor;
uniform sampler2D tGBuf;
uniform sampler2D tPaper;
uniform sampler2D tNoise;
uniform vec2 uRes;
uniform float uPx;
uniform float uFar;
uniform float uBoilSeed;
uniform vec3 uBoil;
uniform vec3 uLine;
uniform vec2 uLineFade;
uniform vec4 uEdge;
uniform float uLineScale;
uniform vec3 uInk;
uniform vec2 uPaperOff;
uniform vec2 uGrain;
uniform float uLineGrain;
uniform float uInvert;
uniform sampler2D tFx;
uniform float uBleed;
uniform vec3 uRed;
uniform vec3 uDarkRed;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uDrawIn;
uniform vec3 uPaperCol;
uniform vec2 uDeath;
varying vec2 vUv;
float edgeAt(vec2 uv,vec2 px) {
    vec4 a=texture2D(tGBuf,uv+vec2(-px.x,px.y));
    vec4 b=texture2D(tGBuf,uv+vec2(0.0,px.y));
    vec4 c=texture2D(tGBuf,uv+vec2(px.x,px.y));
    vec4 d=texture2D(tGBuf,uv+vec2(-px.x,0.0));
    vec4 e=texture2D(tGBuf,uv);
    vec4 f=texture2D(tGBuf,uv+vec2(px.x,0.0));
    vec4 g=texture2D(tGBuf,uv+vec2(-px.x,-px.y));
    vec4 h=texture2D(tGBuf,uv+vec2(0.0,-px.y));
    vec4 i=texture2D(tGBuf,uv+vec2(px.x,-px.y));
    vec4 gx=(c+2.0*f+i)-(a+2.0*d+g);
    vec4 gy=(a+2.0*b+c)-(g+2.0*h+i);
    float de=length(vec2(gx.w,gy.w))/max(e.w,0.0001);
    float ne=length(gx.xyz)+length(gy.xyz);
    return max(smoothstep(uEdge.x,uEdge.y,de),smoothstep(uEdge.z,uEdge.w,ne));
}
void main() {
    vec2 uv=vUv;
    float depth=texture2D(tGBuf,uv).w*uFar;
    float fade=smoothstep(uLineFade.x,uLineFade.y,depth);
    vec2 nuv=uv*uBoil.z*vec2(uRes.x/uRes.y,1.0)+uBoilSeed*vec2(0.37,0.61);
    vec2 n=texture2D(tNoise,nuv).rg-0.5;
    vec2 off=n*2.0*mix(uBoil.x,uBoil.y,fade)*uPx/uRes;
    vec2 px=mix(uLine.x,uLine.y,fade)*uPx*uLineScale/uRes;
    float edge=edgeAt(uv+off,px);
    float grain=texture2D(tPaper,(gl_FragCoord.xy-uPaperOff)/(uGrain.y*uPx)).r;
    edge*=mix(1.0,uLine.z,fade)*(1.0-uLineGrain+uLineGrain*grain);
    vec3 col=texture2D(tColor,uv).rgb;
    float fillMask=1.0;
    if (uDrawIn<1.0) {
        float sw=uv.x*0.65+(1.0-uv.y)*0.35+(texture2D(tNoise,uv*2.3).r-0.5)*0.16;
        float lk=uDrawIn*1.75-0.1;
        float fk=uDrawIn*1.75-0.65;
        edge*=smoothstep(sw,sw+0.03,lk);
        float fo=smoothstep(sw,sw+0.18,fk);
        float dth=texture2D(tNoise,gl_FragCoord.xy*0.021).b;
        fillMask=step(1.0-fo,dth+fo*0.3);
        col=mix(uPaperCol,col,fillMask);
        float tip=smoothstep(0.012,0.0,abs(sw-lk))*step(0.0,lk);
        edge=max(edge,tip*0.6*step(0.5,texture2D(tNoise,gl_FragCoord.xy*0.08).b));
    }
    col=mix(col,uInk,clamp(edge,0.0,1.0));
    vec4 fxc=texture2D(tFx,uv)*fillMask;
    col=col*(1.0-fxc.a)+fxc.rgb;
    if (uBleed>0.001) {
        vec2 q=uv-0.5;
        q.x*=uRes.x/uRes.y;
        float bn=texture2D(tNoise,uv*vec2(uRes.x/uRes.y,1.0)*1.1+uBoilSeed*vec2(0.13,0.07)).r;
        float bn2=texture2D(tNoise,uv*6.0+uBoilSeed*0.31).b;
        float v=length(q)*1.25+(bn-0.5)*0.45+(bn2-0.5)*0.08;
        float t=mix(1.45,0.62,clamp(uBleed,0.0,1.0));
        float m=smoothstep(t,t+0.035,v);
        vec3 rc=mix(uRed,uDarkRed,smoothstep(t+0.08,t+0.45,v));
        col=mix(col,rc,m);
    }
    #ifdef USE_GRAIN
    col*=mix(1.0,grain/0.9,uGrain.x);
    #endif
    float sat=max(col.r,max(col.g,col.b))-min(col.r,min(col.g,col.b));
    vec3 inv=mix(1.0-col,col,smoothstep(0.12,0.3,sat));
    col=mix(col,inv,uInvert);
    if (uDeath.x>0.0) {
        float red=smoothstep(0.12,0.3,sat);
        col=mix(col,mix(uInk,col,red),uDeath.x);
        float lum=dot(col,vec3(0.299,0.587,0.114));
        vec3 gray=mix(uInk,uPaperCol,0.55)+vec3(lum*0.08);
        col=mix(col,gray,uDeath.y);
    }
    col=mix(col,uFlashColor,uFlash);
    gl_FragColor=vec4(col,1.0);
}
`;
