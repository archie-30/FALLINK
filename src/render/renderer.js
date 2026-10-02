import*as THREE from 'three';
import {PostFX} from './postfx.js';
import {pixelRatio,qualityConfig} from '../core/settings.js';

export class Renderer {
    constructor(canvas) {
        THREE.ColorManagement.enabled=false;
        this.gl=new THREE.WebGLRenderer({
            canvas,
            antialias:false,
            alpha:false,
            stencil:false,
            depth:true,
            powerPreference:'high-performance'
        });
        this.gl.outputColorSpace=THREE.LinearSRGBColorSpace;
        this.gl.debug.checkShaderErrors=new URLSearchParams(location.search).has('debug');
        this.gl.autoClear=false;
        this.gl.info.autoReset=false;
        this.post=new PostFX(this.gl);
        this.width=1;
        this.height=1;
        this.pixelRatio=1;
    }

    applyQuality() {
        this.post.setQuality(qualityConfig());
        this.resize(this.width,this.height);
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
        this.pixelRatio=pixelRatio();
        this.gl.setPixelRatio(this.pixelRatio);
        this.gl.setSize(w,h,false);
        this.post.setSize(w,h,this.pixelRatio);
    }

    render(scene,fxScene,camera) {
        this.gl.info.reset();
        this.post.render(scene,fxScene,camera);
    }

    stats() {
        const i=this.gl.info.render;
        return {calls:i.calls,triangles:i.triangles};
    }
}
