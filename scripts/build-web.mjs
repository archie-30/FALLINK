// Copies only the files the game needs into www/ (Capacitor's webDir).
import {rmSync,mkdirSync,cpSync,existsSync} from 'node:fs';

const FILES=['index.html','style.css','manifest.webmanifest','favicon.svg','icon-192.png'];
const DIRS=['src','lib'];

rmSync('www',{recursive:true,force:true});
mkdirSync('www',{recursive:true});
for(const f of FILES){
    if(!existsSync(f))throw new Error('missing '+f);
    cpSync(f,'www/'+f);
}
for(const d of DIRS)cpSync(d,'www/'+d,{recursive:true});
console.log('www/ ready');
