// Keeps the Android version in step with the game version shown in the main menu
// (src/data/version.js is the single source of truth).
//   versionName = "0.9.21"
//   versionCode = (major*10000 + minor*100 + patch) * 10 + androidBuild   -> 9210
// Play requires versionCode to go up on every upload. If you need to upload the SAME game
// version again (e.g. a packaging-only fix), bump "androidBuild" in package.json (0-9).
import {readFileSync,writeFileSync} from 'node:fs';

const src=readFileSync('src/data/version.js','utf8');
const m=/number:\s*'v(\d+)\.(\d+)\.(\d+)'/.exec(src);
if (!m) {
    throw new Error('cannot read the version from src/data/version.js');
}
const [major,minor,patch]=[+m[1],+m[2],+m[3]];
if (minor>99||patch>99) {
    throw new Error('minor/patch must stay below 100 for the versionCode formula');
}
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const build=pkg.androidBuild??0;
if (!Number.isInteger(build)||build<0||build>9) {
    throw new Error('androidBuild in package.json must be an integer from 0 to 9');
}
const name=`${major}.${minor}.${patch}`;
const code=(major*10000+minor*100+patch)*10+build;

const gradlePath='android/app/build.gradle';
let g=readFileSync(gradlePath,'utf8');
const before=g;
g=g.replace(/versionCode\s+\d+/,`versionCode ${code}`).replace(/versionName\s+"[^"]*"/,`versionName "${name}"`);
if (g!==before) {
    writeFileSync(gradlePath,g);
}
if (pkg.version!==name) {
    pkg.version=name;
    writeFileSync('package.json',JSON.stringify(pkg,null,4)+'\n');
}
console.log(`Android version ${name} (versionCode ${code})`);
