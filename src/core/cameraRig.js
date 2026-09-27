import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {noise1} from './rng.js';
import {tweens} from './tween.js';
import {shakeScale} from './settings.js';

const _v=new THREE.Vector3();
const _d=new THREE.Vector3();

export class CameraRig {
    constructor(aspect) {
        const C=TUNING.camera;
        this.camera=new THREE.PerspectiveCamera(C.fov,aspect,C.near,C.far);
        this.focus=new THREE.Vector3();
        this.target=new THREE.Vector3();
        this.look=new THREE.Vector3();
        this.offset=new THREE.Vector3();
        this.bounds=null;
        this.trauma=0;
        this.fovKick=0;
        this.shakeTime=0;
        this.transition=null;
        this.setPitch(C.pitch,C.distance);
    }

    setPitch(deg,dist) {
        const p=THREE.MathUtils.degToRad(deg);
        this.offset.set(0,Math.sin(p)*dist,Math.cos(p)*dist);
    }

    setBounds(b) {
        const m=TUNING.camera.boundsMargin;
        this.bounds={
            minX:Math.min(0,b.minX+m[0]),
            maxX:Math.max(0,b.maxX-m[0]),
            minZ:Math.min(0,b.minZ+m[1]),
            maxZ:Math.max(0,b.maxZ-m[2])
        };
    }

    setAspect(a) {
        this.camera.aspect=a;
        this.camera.updateProjectionMatrix();
    }

    follow(pos,lookX,lookZ) {
        this.target.set(pos.x+lookX,0,pos.z+lookZ);
        if (this.bounds) {
            const b=this.bounds;
            this.target.x=Math.max(b.minX,Math.min(b.maxX,this.target.x));
            this.target.z=Math.max(b.minZ,Math.min(b.maxZ,this.target.z));
        }
    }

    snap() {
        this.focus.copy(this.target);
    }

    addTrauma(a) {
        this.trauma=Math.min(1,this.trauma+a*shakeScale());
    }

    fovPunch(a) {
        this.fovKick+=a*Math.min(1,shakeScale()+0.3);
    }

    moveTo(pos,duration=1.0,ease='easeInOutCubic') {
        const done=()=>{
            this.transition=null;
        };
        this.transition=tweens.to(this.focus,{x:pos.x,z:pos.z},{duration,ease,unscaled:true,onComplete:done});
        return this.transition;
    }

    update(dt) {
        const C=TUNING.camera;
        if (!this.transition) {
            const k=1-Math.exp(-C.follow*dt);
            this.focus.x+=(this.target.x-this.focus.x)*k;
            this.focus.z+=(this.target.z-this.focus.z)*k;
        }
        this.trauma=Math.max(0,this.trauma-C.traumaDecay*dt);
        this.fovKick*=Math.exp(-C.fovPunchDecay*dt);
        this.shakeTime+=dt;
        const cam=this.camera;
        cam.position.copy(this.focus).add(this.offset);
        cam.lookAt(this.focus);
        const s=this.trauma*this.trauma;
        if (s>0.0001) {
            const t=this.shakeTime*C.shakeFreq;
            cam.position.x+=noise1(t,1)*C.maxOffset*s;
            cam.position.y+=noise1(t,2)*C.maxOffset*s*0.5;
            cam.position.z+=noise1(t,3)*C.maxOffset*s;
            cam.rotateZ(noise1(t,4)*C.maxRoll*s);
        }
        const fov=C.fov-this.fovKick;
        if (Math.abs(cam.fov-fov)>0.001) {
            cam.fov=fov;
            cam.updateProjectionMatrix();
        }
        cam.updateMatrixWorld();
    }

    screenToGround(sx,sy,w,h,y,out) {
        const cam=this.camera;
        _v.set((sx/w)*2-1,-(sy/h)*2+1,0.5).unproject(cam);
        _d.copy(_v).sub(cam.position).normalize();
        if (Math.abs(_d.y)<1e-5) {
            return false;
        }
        const t=(y-cam.position.y)/_d.y;
        if (t<0) {
            return false;
        }
        out.copy(cam.position).addScaledVector(_d,t);
        return true;
    }

    worldToScreen(p,w,h,out) {
        _v.copy(p).project(this.camera);
        out.x=(_v.x*0.5+0.5)*w;
        out.y=(-_v.y*0.5+0.5)*h;
        return out;
    }
}
