export const GBUF_OUT=`
layout(location=1) out highp vec4 gBuf;
`;

export const JITTER=`
uniform float uBoilSeed;
uniform float uJitter;
vec3 boilJitter(vec3 p) {
    vec3 s=vec3(12.9898,78.233,37.719)*(uBoilSeed+1.0);
    return sin(p*vec3(5.3,6.1,4.7)+s)*uJitter;
}
`;

export const MODEL_MATRIX=`
mat4 getModel() {
    #ifdef USE_INSTANCING
    return modelMatrix*instanceMatrix;
    #else
    return modelMatrix;
    #endif
}
`;
