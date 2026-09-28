import*as THREE from 'three';
import {unlitMaterial,toonMaterial} from '../render/materials.js';

export class Pickups {
    constructor(parent) {
        this.items=[];
        const dropGeo=new THREE.SphereGeometry(0.26,10,8);
        const tipGeo=new THREE.ConeGeometry(0.18,0.34,8);
        const crossA=new THREE.BoxGeometry(0.6,0.18,0.18);
        const crossB=new THREE.BoxGeometry(0.18,0.6,0.18);
        const ink=unlitMaterial({color:'ink'});
        const paper=toonMaterial({light:'paper',mid:'farGray',dark:'midGray'});
        for (let i=0;i<8;i++) {
            const g=new THREE.Group();
            const drop=new THREE.Group();
            const a=new THREE.Mesh(dropGeo,ink);
            const b=new THREE.Mesh(tipGeo,ink);
            b.position.y=0.28;
            drop.add(a,b);
            const heal=new THREE.Group();
            heal.add(new THREE.Mesh(crossA,paper),new THREE.Mesh(crossB,paper));
            g.add(drop,heal);
            g.visible=false;
            parent.add(g);
            this.items.push({mesh:g,drop,heal,active:false,type:'ink',x:0,z:0,t:0});
        }
    }

    spawn(type,x,z) {
        const it=this.items.find(q=>!q.active)||this.items[0];
        it.active=true;
        it.type=type;
        it.x=x;
        it.z=z;
        it.t=0;
        it.mesh.visible=true;
        it.drop.visible=type==='ink';
        it.heal.visible=type==='heal';
        it.mesh.position.set(x,0.8,z);
    }

    clear() {
        for (const it of this.items) {
            it.active=false;
            it.mesh.visible=false;
        }
    }

    update(dt,player,onPick) {
        for (const it of this.items) {
            if (!it.active) {
                continue;
            }
            it.t+=dt;
            it.mesh.position.y=0.8+Math.sin(it.t*4)*0.15;
            it.mesh.rotation.y=it.t*2;
            if (it.t>12) {
                it.active=false;
                it.mesh.visible=false;
                continue;
            }
            if (it.t>0.4&&Math.hypot(player.pos.x-it.x,player.pos.z-it.z)<1.2) {
                it.active=false;
                it.mesh.visible=false;
                onPick(it.type,it.x,it.z);
            }
        }
    }
}
