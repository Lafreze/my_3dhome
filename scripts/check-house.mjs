import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { rooms, houseFurniture, livingMediaDetails } from '../app/house-data.ts';
import { parseVideoSource } from '../app/video-source.ts';
const bounds = f => ({ x0:f.x-f.width/2,x1:f.x+f.width/2,z0:f.z-f.depth/2,z1:f.z+f.depth/2 });
const overlap=(a,b)=>a.x0<b.x1-.001&&a.x1>b.x0+.001&&a.z0<b.z1-.001&&a.z1>b.z0+.001;
const checks=[];
for(const [room,items] of Object.entries(houseFurniture)){
  const entries=Object.entries(items);
  for(const [id,item]of entries){const r=bounds(item);assert(r.x0>=-3.94&&r.x1<=3.94&&r.z0>=-3.3&&r.z1<=3.3,`${room}/${id} outside room`);}
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)assert(!overlap(bounds(entries[i][1]),bounds(entries[j][1])),`${room}: ${entries[i][0]} overlaps ${entries[j][0]}`);
  checks.push({room,furniture:entries.length,overlaps:0});
}
assert.equal(rooms.living.x-rooms.study.x,8);assert.equal(rooms.bedroom.z-rooms.study.z,6.8);
assert.equal(rooms.gallery.x,rooms.living.x);assert.equal(rooms.gallery.z,rooms.bedroom.z);
const living=houseFurniture.living;
const media = livingMediaDetails;
assert(media.speakerOffset-media.speakerWidth/2 >= media.tvWidth/2+.04, 'Speakers intersect the TV bezel or image');
assert(media.speakerOffset+media.speakerWidth/2 <= living.media.width/2-.04, 'Speaker extends beyond cabinet');
assert(Math.abs(media.speakerBase-.014-(.86+.085/2))<.001, 'Speaker feet must rest on cabinet');
assert(Math.abs(media.speakerZ)+media.speakerDepth/2 < living.media.depth/2, 'Speaker depth must fit countertop');
assert(living.sofa.facing[1]<0&&living.media.z<living.sofa.z,'Sofa must face TV');
assert(Math.abs(living.sofa.x-living.media.x)<.2,'TV aligned with sofa');
const openWardrobe={...bounds(houseFurniture.bedroom.wardrobe),x0:houseFurniture.bedroom.wardrobe.x-1.65};
assert(!overlap(openWardrobe,bounds(houseFurniture.bedroom.bed)),'Wardrobe doors hit bed');
const paths={
 living:[[[-4,1.75],[-2.4,1.75],[-2.4,3.4]],[[-2.4,1.75],[-2.4,-1.7],[-.8,-1.7]]],
 bedroom:[[[2.65,-3.4],[2.5,-2.75],[2.5,-1.4],[1.85,-.4],[1.85,1.85],[4,1.85]]],
 gallery:[[[-4,1.85],[-1.7,1.5],[-1.7,-2.5],[-2.4,-3.4]],[[1.6,3.4],[1.6,1.6],[1.25,-1.7]]],
};
for(const [room,routes]of Object.entries(paths))for(const route of routes)for(let i=1;i<route.length;i++){
 const a=route[i-1],b=route[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*100);
 for(let j=0;j<=steps;j++){
   const x=a[0]+(b[0]-a[0])*j/steps,z=a[1]+(b[1]-a[1])*j/steps;
   for(const [id,f]of Object.entries(houseFurniture[room])){const r=bounds(f);const dx=Math.max(r.x0-x,0,x-r.x1),dz=Math.max(r.z0-z,0,z-r.z1);assert(Math.hypot(dx,dz)>=.42,`${room} route blocked by ${id} at ${x},${z}`);}
 }
}
const valid=[['https://www.youtube.com/watch?v=M7lc1UVf-VE&t=1m20s','youtube',80],['https://youtu.be/M7lc1UVf-VE?t=9','youtube',9],['https://www.youtube.com/shorts/M7lc1UVf-VE','youtube',0],['https://www.youtube-nocookie.com/embed/M7lc1UVf-VE','youtube',0],['https://example.com/movie.mp4?token=abc','video',undefined],['https://example.com/','website',undefined],['https://youtube.com.evil.test/watch?v=M7lc1UVf-VE','website',undefined]];
for(const [url,kind,start]of valid){const source=parseVideoSource(url);assert.equal(source?.kind,kind);if(kind==='youtube')assert.equal(source.start,start);}
for(const url of ['javascript:alert(1)','https://youtube.com/watch?v=bad','file:///private/video.mp4','https://user:pass@example.com/video.mp4'])assert.equal(parseVideoSource(url),null);
await mkdir('output/playwright',{recursive:true});
await writeFile('output/playwright/house-layout-check.json',JSON.stringify({grid:'2x2',checks,doorWidthMetres:.875,minRouteRadiusMetres:.2625,wardrobeDoors:'clear',tvSofa:'aligned',videoParsing:'11 cases passed'},null,2));
console.log('2×2 house: furniture bounds, collisions, walking routes, wardrobe swing and 11 video URL cases passed.');
