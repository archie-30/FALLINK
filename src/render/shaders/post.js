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
uniform vec3 uInk;
uniform vec3 uRuleColor;
uniform vec4 uRule;
uniform vec2 uGrain;
uniform float uInvert;
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
    vec2 px=mix(uLine.x,uLine.y,fade)*uPx/uRes;
    float edge=edgeAt(uv+off,px);
    float grain=texture2D(tPaper,gl_FragCoord.xy/(uGrain.y*uPx)).r;
    edge*=mix(1.0,uLine.z,fade)*(0.55+0.45*grain);
    vec3 col=texture2D(tColor,uv).rgb;
    col=mix(col,uInk,clamp(edge,0.0,1.0));
    #ifdef USE_RULES
    float sp=uRule.x*uPx;
    float ry=abs(mod(gl_FragCoord.y,sp)-sp*0.5);
    float rl=1.0-smoothstep(0.35*uPx,1.1*uPx,ry);
    float mx=abs(gl_FragCoord.x-uRule.z*uPx);
    float ml=1.0-smoothstep(0.5*uPx,1.4*uPx,mx);
    col*=mix(vec3(1.0),uRuleColor,rl*uRule.y);
    col*=mix(vec3(1.0),uRuleColor,ml*uRule.w);
    #endif
    #ifdef USE_GRAIN
    col*=mix(1.0,grain/0.9,uGrain.x);
    #endif
    col=mix(col,1.0-col,uInvert);
    gl_FragColor=vec4(col,1.0);
}
`;
