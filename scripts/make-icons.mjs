// Regenerates every app icon / splash from the "E" design (ink drop + splatters).
// Needs playwright-core (devDependency) and a Chromium: set CHROMIUM_PATH if not auto-found.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const P='#F2F0EB',K='#1A1A1A',R='#D62828';
const RES='android/app/src/main/res';

const dropPath='M256 72 C256 72 120 240 120 320 A136 136 0 0 0 392 320 C392 240 256 72 256 72 Z';
const art=(sc)=>`<g transform="translate(256 256) scale(${sc}) translate(-256 -256)">
<g fill="${K}"><circle cx="110" cy="130" r="18"/><circle cx="410" cy="110" r="12"/><circle cx="440" cy="250" r="9"/><circle cx="70" cy="300" r="10"/><circle cx="150" cy="60" r="7"/></g>
<g transform="translate(256 276) scale(0.8) translate(-256 -256)"><path d="${dropPath}" fill="${K}"/><path d="M192 328 A64 64 0 0 0 240 384" fill="none" stroke="${P}" stroke-width="22" stroke-linecap="round"/><circle cx="376" cy="416" r="32" fill="${R}"/></g></g>`;
const svg=(inner,bg=null,clip=null)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">${clip?`<defs><clipPath id="c">${clip}</clipPath></defs>`:''}<g ${clip?'clip-path="url(#c)"':''}>${bg?`<rect width="512" height="512" fill="${bg}"/>`:''}${inner}</g></svg>`;

const rounded='<rect width="512" height="512" rx="112"/>';
const circle='<circle cx="256" cy="256" r="256"/>';
const SQUARE=svg(art(1),P,rounded);
const ROUND=svg(art(0.88),P,circle);
const FOREGROUND=svg(art(0.8));
const FULL=svg(art(1),P);

const jobs=[];
for (const [d,s] of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})) {
    jobs.push([`${RES}/mipmap-${d}/ic_launcher.png`,s,s,SQUARE,true]);
    jobs.push([`${RES}/mipmap-${d}/ic_launcher_round.png`,s,s,ROUND,true]);
}
for (const [d,s] of Object.entries({mdpi:108,hdpi:162,xhdpi:216,xxhdpi:324,xxxhdpi:432})) {
    jobs.push([`${RES}/mipmap-${d}/ic_launcher_foreground.png`,s,s,FOREGROUND,true]);
}
jobs.push(['store/icon-512.png',512,512,FULL,false]);
jobs.push(['icon-192.png',192,192,SQUARE,true]);
jobs.push(['icon-512.png',512,512,SQUARE,true]);

const splash=(w,h)=>`<div style="width:${w}px;height:${h}px;background:${P};display:flex;align-items:center;justify-content:center"><div style="width:${Math.round(Math.min(w,h)*0.42)}px;height:${Math.round(Math.min(w,h)*0.42)}px">${svg(art(1))}</div></div>`;
const splashSizes={
    'drawable/splash.png':[480,320],
    'drawable-land-mdpi/splash.png':[480,320],'drawable-land-hdpi/splash.png':[800,480],'drawable-land-xhdpi/splash.png':[1280,720],
    'drawable-land-xxhdpi/splash.png':[1600,960],'drawable-land-xxxhdpi/splash.png':[1920,1280],
    'drawable-port-mdpi/splash.png':[320,480],'drawable-port-hdpi/splash.png':[480,800],'drawable-port-xhdpi/splash.png':[720,1280],
    'drawable-port-xxhdpi/splash.png':[960,1600],'drawable-port-xxxhdpi/splash.png':[1280,1920]
};

const exe=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b=await chromium.launch({executablePath:exe});
const pg=await b.newPage();
const shot=async(file,w,h,html,transparent)=>{
    await pg.setViewportSize({width:w,height:h});
    await pg.setContent(`<html><body style="margin:0;background:transparent;overflow:hidden"><div style="width:${w}px;height:${h}px">${html}</div></body></html>`);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    await pg.screenshot({path:file,omitBackground:transparent,clip:{x:0,y:0,width:w,height:h}});
};
for (const [f,w,h,s,t] of jobs) await shot(f,w,h,s,t);
for (const [f,[w,h]] of Object.entries(splashSizes)) await shot(`${RES}/${f}`,w,h,splash(w,h),false);
await b.close();

fs.writeFileSync('favicon.svg',SQUARE.replace('width="100%" height="100%"','width="64" height="64"'));
fs.writeFileSync(`${RES}/values/ic_launcher_background.xml`,`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${P}</color>\n</resources>\n`);
console.log('icons done');
