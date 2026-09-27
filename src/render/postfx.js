import*as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {POST_VERT,POST_FRAG} from './shaders/post.js';
import {TUNING} from '../data/tuning.js';
import {pal,shared} from './materials.js';

export class PostFX {
    constructor(renderer) {
        this.renderer=renderer;
        this.target=new THREE.WebGLRenderTarget(1,1,{
            count:2,
            type:THREE.HalfFloatType,
            format:THREE.RGBAFormat,
            minFilter:THREE.LinearFilter,
            magFilter:THREE.LinearFilter,
            depthBuffer:true,
            stencilBuffer:false,
            generateMipmaps:false
        });
        const O=TUNING.outline;
        const B=TUNING.boil;
        const P=TUNING.paper;
        this.uniforms={
            tColor:{value:this.target.textures[0]},
            tGBuf:{value:this.target.textures[1]},
            tPaper:shared.tPaper,
            tNoise:shared.tNoise,
            uRes:{value:new THREE.Vector2(1,1)},
            uPx:{value:1},
            uFar:shared.uFar,
            uBoilSeed:shared.uBoilSeed,
            uBoil:{value:new THREE.Vector3(B.nearAmp,B.farAmp,B.noiseScale)},
            uLine:{value:new THREE.Vector3(O.nearWidth,O.farWidth,O.farAlpha)},
            uLineFade:{value:new THREE.Vector2(O.fadeNear,O.fadeFar)},
            uEdge:{value:new THREE.Vector4(O.depthLo,O.depthHi,O.normalLo,O.normalHi)},
            uInk:{value:pal('ink').clone()},
            uRuleColor:{value:pal('farGray').clone()},
            uRule:{value:new THREE.Vector4(P.ruleSpacing,P.ruleAlpha,P.marginX,P.marginAlpha)},
            uGrain:{value:new THREE.Vector2(P.grain,1)},
            uInvert:{value:0}
        };
        this.material=new THREE.ShaderMaterial({
            vertexShader:POST_VERT,
            fragmentShader:POST_FRAG,
            uniforms:this.uniforms,
            defines:{},
            depthTest:false,
            depthWrite:false
        });
        this.quad=new FullScreenQuad(this.material);
        this.clearColor=pal('paper').clone();
        this.boilScale=1;
    }

    setQuality(q) {
        const d={};
        if (q.grain) {
            d.USE_GRAIN='';
        }
        if (q.rules) {
            d.USE_RULES='';
        }
        this.material.defines=d;
        this.material.needsUpdate=true;
    }

    setBoilScale(s) {
        const B=TUNING.boil;
        this.boilScale=s;
        this.uniforms.uBoil.value.set(B.nearAmp*s,B.farAmp*s,B.noiseScale);
    }

    setSize(w,h,pr) {
        const pw=Math.max(1,Math.floor(w*pr));
        const ph=Math.max(1,Math.floor(h*pr));
        this.target.setSize(pw,ph);
        this.uniforms.uRes.value.set(pw,ph);
        this.uniforms.uPx.value=pr;
        this.uniforms.uGrain.value.y=1;
    }

    render(scene,camera) {
        const r=this.renderer;
        r.setClearColor(this.clearColor,1);
        r.setRenderTarget(this.target);
        r.clear(true,true,false);
        r.render(scene,camera);
        r.setRenderTarget(null);
        this.quad.render(r);
    }
}
