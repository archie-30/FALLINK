import*as THREE from 'three';
import {hullMaterial} from './materials.js';

export function addHull(mesh,opts={}) {
    const hull=new THREE.Mesh(mesh.geometry,hullMaterial(opts));
    hull.name='hull';
    hull.renderOrder=mesh.renderOrder;
    mesh.add(hull);
    return hull;
}
