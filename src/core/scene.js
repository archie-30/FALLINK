import*as THREE from 'three';

export function createScene() {
    const scene=new THREE.Scene();
    const world=new THREE.Group();
    world.name='world';
    const actors=new THREE.Group();
    actors.name='actors';
    const fx=new THREE.Group();
    fx.name='fx';
    scene.add(world,actors,fx);
    return {scene,world,actors,fx};
}
