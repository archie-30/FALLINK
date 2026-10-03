import*as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {POST_VERT,POST_FRAG} from './shaders/post.js';
import {TUNING} from '../data/tuning.js';
import {pal,shared} from './materials.js';
import {tweens} from '../core/tween.js';

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
        this.fxTarget=new THREE.WebGLRenderTarget(1,1,{
            type:THREE.UnsignedByteType,
            format:THREE.RGBAFormat,
            minFilter:THREE.LinearFilter,
            magFilter:THREE.LinearFilter,
            depthBuffer:false,
            stencilBuffer:false,
            generateMipmaps:false
        });
        shared.tGBuf.value=this.target.textures[1];
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
            uLineScale:{value:1},
            uInk:{value:pal('ink').clone()},
            uPaperOff:{value:new THREE.Vector2(0,0)},
            uGrain:{value:new THREE.Vector2(P.grain,1)},
            uLineGrain:{value:TUNING.outline.lineGrain},
            uInvert:{value:0},
            tFx:{value:this.fxTarget.texture},
            uBleed:{value:0},
            uRed:{value:pal('red').clone()},
            uDarkRed:{value:pal('darkRed').clone()},
            uFlash:{value:0},
            uFlashColor:{value:pal('paper').clone()},
            uDrawIn:{value:1},
            uPaperCol:{value:pal('paper').clone()},
            uDeath:{value:new THREE.Vector2(0,0)}
        };
        this.invertFrames=0;
        this.invertHold={value:0};
        this.flashTween=null;
        this.transparent=new THREE.Color(0,0,0);
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
        this.anchor=new THREE.Vector3();
        this.anchorSet=false;
        this.camDir=new THREE.Vector3();
    }

    trackPaper(camera) {
        const res=this.uniforms.uRes.value;
        const off=this.uniforms.uPaperOff.value;
        if (this.anchorSet) {
            this.anchor.project(camera);
            off.x+=this.anchor.x*0.5*res.x;
            off.y+=this.anchor.y*0.5*res.y;
            const img=this.uniforms.tPaper.value.image;
            const tile=(img&&img.width?img.width:256)*this.uniforms.uGrain.value.y*this.uniforms.uPx.value;
            off.x=((off.x%tile)+tile)%tile;
            off.y=((off.y%tile)+tile)%tile;
        }
        camera.getWorldDirection(this.camDir);
        this.anchorSet=this.camDir.y<-0.01;
        if (this.anchorSet) {
            const k=-camera.position.y/this.camDir.y;
            this.anchor.copy(camera.position).addScaledVector(this.camDir,k);
        }
    }

    setQuality(q) {
        const d={};
        if (q.grain) {
            d.USE_GRAIN='';
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
        this.fxTarget.setSize(pw,ph);
        shared.uScreen.value.set(pw,ph);
        this.uniforms.uRes.value.set(pw,ph);
        this.uniforms.uPx.value=pr;
        this.uniforms.uGrain.value.y=1;
        const O=TUNING.outline;
        const k=Math.max(1,Math.min(O.smallMaxBoost,O.refHeight/Math.max(1,h)));
        this.uniforms.uEdge.value.set(O.depthLo*(1+(k-1)*O.depthBoost),O.depthHi*(1+(k-1)*O.depthBoost),O.normalLo*k,O.normalHi*k);
        this.uniforms.uLineScale.value=Math.max(O.smallMinWidth,Math.min(1,h/O.refHeight));
    }

    drawIn(duration=1.2,delay=0) {
        const u=this.uniforms.uDrawIn;
        tweens.killTweensOf(u);
        u.value=0;
        tweens.to(u,{value:1},{duration,delay,ease:'easeInOutQuad',unscaled:true});
    }

    death() {
        const d=this.uniforms.uDeath.value;
        tweens.killTweensOf(d);
        d.set(0,0);
        tweens.to(d,{x:1},{duration:0.05,unscaled:true}).then(d,{y:1},{duration:1.4,delay:0.9,ease:'easeInOutQuad',unscaled:true});
    }

    resetDeath() {
        const d=this.uniforms.uDeath.value;
        tweens.killTweensOf(d);
        d.set(0,0);
    }

    flash(colorKey,duration,strength) {
        if (this.flashTween) {
            this.flashTween.kill();
        }
        this.uniforms.uFlashColor.value.copy(pal(colorKey));
        this.uniforms.uFlash.value=strength;
        this.flashTween=tweens.to(this.uniforms.uFlash,{value:0},{duration,ease:'easeOutQuad',unscaled:true});
    }

    render(scene,fxScene,camera) {
        const r=this.renderer;
        r.setClearColor(this.clearColor,1);
        r.setRenderTarget(this.target);
        r.clear(true,true,false);
        r.render(scene,camera);
        r.setClearColor(this.transparent,0);
        r.setRenderTarget(this.fxTarget);
        r.clear(true,false,false);
        r.render(fxScene,camera);
        r.setRenderTarget(null);
        this.trackPaper(camera);
        this.uniforms.uInvert.value=Math.max(this.invertFrames>0?1:0,this.invertHold.value);
        if (this.invertFrames>0) {
            this.invertFrames--;
        }
        this.quad.render(r);
    }
}
