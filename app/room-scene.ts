import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ObjectId, RoomApi } from './room-data';

type Options = { onSelect: (id: ObjectId) => void; onHover: (id: ObjectId | null, x: number, y: number) => void; onReady: () => void };
export function createRoom(host: HTMLElement, options: Options): RoomApi {
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '可互动的三维小屋。拖动旋转，滚轮缩放，也可以使用探索物件列表。');
  const camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
  const initial = new T.Vector3(11.4, 10.2, 13.5);
  const target = new T.Vector3(0, 1.0, 0);
  camera.position.copy(initial);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 26;
  controls.minPolarAngle = Math.PI / 9;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.minAzimuthAngle = -Math.PI / 2.4;
  controls.maxAzimuthAngle = Math.PI / 2.1;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.65;
  const root = new T.Group(); scene.add(root);
  const groups = new Map<ObjectId, T.Group>();
  const interactables: T.Object3D[] = [];
  function group(id: ObjectId, x=0, y=0, z=0) {
    const g = new T.Group(); g.position.set(x,y,z); g.userData.id=id; root.add(g);
    if (!groups.has(id)) groups.set(id,g);
    interactables.push(g); return g;
  }
  const materials: T.Material[] = [];
  const mat = (color: T.ColorRepresentation, roughness=0.8) => { const m=new T.MeshStandardMaterial({color,roughness}); materials.push(m); return m; };
  const oak=mat('#ac7851'), edge=mat('#d1a078'), paleWood=mat('#cfaa7c'), darkWood=mat('#6c4934');
  const cream=mat('#eee6d5'), white=mat('#fffae9'), green=mat('#536953'), darkGreen=mat('#254f43');
  const terra=mat('#b76947'), brass=mat('#b59a57',0.35), charcoal=mat('#343c36');
  function mesh(geometry:T.BufferGeometry, material:T.Material, parent:T.Object3D, x:number,y:number,z:number) {
    const m = new T.Mesh(geometry,material); m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function box(parent:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,material:T.Material,r=0.025) {
    return mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),material,parent,x,y,z);
  }
  function cylinder(parent:T.Object3D,rt:number,rb:number,h:number,x:number,y:number,z:number,material:T.Material) {
    return mesh(new T.CylinderGeometry(rt,rb,h,32),material,parent,x,y,z);
  }
  function sphere(parent:T.Object3D,r:number,x:number,y:number,z:number,material:T.Material,sx=1,sy=1,sz=1) {
    const m=mesh(new T.SphereGeometry(r,24,16),material,parent,x,y,z);m.scale.set(sx,sy,sz);return m;
  }
  function rod(parent:T.Object3D,a:T.Vector3,b:T.Vector3,r:number,material:T.Material) {
    const mid=a.clone().add(b).multiplyScalar(0.5);const o=cylinder(parent,r,r,a.distanceTo(b),mid.x,mid.y,mid.z,material);
    o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return o;
  }
  const hemi=new T.HemisphereLight('#eef5f0','#a3886a',2.4);scene.add(hemi);
  const sun=new T.DirectionalLight('#fff0cf',4.2);sun.position.set(2.5,8,-4);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;
  sun.shadow.normalBias=0.03;sun.shadow.bias=-0.0001;sun.shadow.radius=4;scene.add(sun);
  const fill=new T.DirectionalLight('#f7eedf',1.3);fill.position.set(4,6,8);scene.add(fill);
  const lampLight=new T.PointLight('#ffb75b',7,5,2);lampLight.position.set(-0.6,1.82,-1.9);scene.add(lampLight);
  const screenLight=new T.PointLight('#9dcce3',0.1,3);screenLight.position.set(1.2,1.8,-1.6);scene.add(screenLight);
  const shadowMat=new T.ShadowMaterial({opacity:0.12});materials.push(shadowMat);
  const ground=mesh(new T.PlaneGeometry(200,200),shadowMat,scene,0,-0.48,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  const floor=group('floor');
  box(floor,8,0.4,6.8,0,-0.23,0,edge,0.1);
  box(floor,7.95,0.09,6.75,0,-0.015,0,paleWood,0.03);
  for(let row=0;row<16;row++) {
    const z=-3.17+row*0.417;
    for(let col=0;col<4;col++) {
      const shade=['#b78658','#bc9065','#c6986b','#c7a079','#ba8b62'][(row*3+col)%5];
      const plank=box(floor,1.961,0.04,0.405,-2.955+col*1.97,0.049,z,mat(shade),0.006);
      // Fine, irregular wood grain stays geometry-based and lightweight.
      for(let k=0;k<2;k++) box(plank,1.15+(row%3)*0.14,0.001,0.004,(k-.5)*.2,0.021,(k-.5)*.16,oak,0);
    }
  }
  const wall=group('wall');
  box(wall,0.17,3.65,6.8,-3.91,1.83,0,cream,0.035);
  // Build the back wall around a real opening, so sunlight can enter.
  box(wall,3.5,3.65,.17,-2.25,1.83,-3.31,darkGreen);
  box(wall,1.17,3.65,.17,3.4,1.83,-3.31,darkGreen);
  box(wall,3.29,0.91,.17,1.13,.46,-3.31,darkGreen);
  box(wall,3.29,.61,.17,1.13,3.35,-3.31,darkGreen);
  box(wall,.2,.13,6.7,-3.8,.15,0,paleWood);
  box(wall,7.7,.13,.13,0,.15,-3.18,paleWood);
  box(wall,.24,.09,6.88,-3.91,3.68,0,white);
  box(wall,8,.09,.23,0,3.68,-3.31,darkGreen);
  const win=group('window',1.12,1.98,-3.28);
  const skyMat=mat('#b8d9d4');(skyMat as T.MeshStandardMaterial).emissive.set('#86bcb2');(skyMat as T.MeshStandardMaterial).emissiveIntensity=.25;
  const sky=box(win,3.22,2.12,.04,0,0,-.13,skyMat);sky.castShadow=false;
  const mountainMat=mat('#718e79');
  for(let i=0;i<5;i++) {const hill=mesh(new T.ConeGeometry(.7+(i%2)*.2,1.0+(i%3)*.3,4),mountainMat,win,-1.32+i*.68,-.7,-.085);hill.scale.z=.015;hill.castShadow=false;}
  for(const x of [-1.67,1.67]) box(win,.14,2.35,.23,x,0,.04,edge);
  for(const y of [-1.13,1.13]) box(win,3.5,.14,.25,0,y,.04,edge);
  box(win,.075,2.2,.1,0,0,.1,white);
  box(win,3.25,.075,.1,0,-.05,.1,white);
  box(win,3.65,.12,.45,0,-1.18,.13,paleWood);
  const curtain=mat('#dfd7c2');
  rod(win,new T.Vector3(-1.94,1.32,.14),new T.Vector3(1.94,1.32,.14),.035,brass);
  for(const side of [-1,1]) for(let i=0;i<5;i++) {
    const m=cylinder(win,.085,.1,2.45,side*(1.65+i*.075),-.0,.15+Math.sin(i*1.5)*.055,curtain);m.scale.z=.7;
  }
  const stars=new T.Group();win.add(stars);stars.visible=false;
  const starMat=new T.MeshBasicMaterial({color:'#ffefd1'});materials.push(starMat);
  for(let i=0;i<15;i++) sphere(stars,.014+(i%3)*.006,Math.sin(i*13.3)*1.48,.1+((i*37)%80)/100,-.085,starMat,1,1,.15);
  sphere(stars,.15,1.06,.66,-.08,starMat,1,1,.1);
  const bed=group('bed',-2.23,0,.25);
  for(const x of [-.86,.86]) for(const z of [-1.27,1.27]) cylinder(bed,.07,.065,.32,x,.21,z,darkWood);
  box(bed,2.13,.27,3.25,0,.4,0,oak,.08);
  box(bed,2.22,1.14,.19,0,.8,-1.54,paleWood,.09);
  box(bed,2.04,.3,3.1,0,.67,0,white,.14);
  const bedding=mat('#74856b');
  box(bed,2.06,.19,2.06,0,.88,.43,bedding,.12);
  box(bed,2.08,.18,.3,0,.95,-.53,bedding,.065);
  for(let i=0;i<14;i++) box(bed,.018,.008,1.78,-.94+i*.145,.98,.54,bedding,.005);
  const blanket=mat('#e1c49b');
  box(bed,2.08,.07,.65,0,1.00,1.06,blanket,.03);
  box(bed,.09,.48,.65,1.015,.79,1.06,blanket,.02);
  for(let i=0;i<12;i++) box(bed,.02,.025,.12,-.96+i*.17,.97,1.44,cream,.003);
  for(const x of [-.51,.51]) { const p=box(bed,.88,.21,.57,x,.95,-1.02,cream,.1);p.rotation.x=.08; }
  box(bed,.43,.21,.43,.29,1.05,-.68,mat('#c08b54'),.09).rotation.y=.15;
  const lamp=group('lamp',-.62,0,-1.98);
  box(lamp,.79,.09,.74,0,.65,0,paleWood,.035);
  for(const x of [-.28,.28]) for(const z of [-.23,.23]) box(lamp,.055,.6,.055,x,.33,z,oak);
  box(lamp,.63,.12,.52,0,.27,0,cream);
  cylinder(lamp,.19,.22,.08,0,.76,0,terra);
  cylinder(lamp,.045,.06,.43,0,1.0,0,terra);
  const shade=mat('#e6ab6c');shade.emissive.set('#ffad50');shade.emissiveIntensity=.45;
  const cap=mesh(new T.SphereGeometry(.35,32,16,0,Math.PI*2,0,Math.PI/2),shade,lamp,0,1.19,0);cap.scale.y=.73;
  cylinder(lamp,.35,.35,.035,0,1.19,0,shade);
  lampLight.position.set(-.62,1.25,-1.98);
  const desk=group('desk',1.27,0,-2.1);
  box(desk,2.65,.13,1.02,0,1.22,0,paleWood,.045);
  for(const x of [-1.15,1.15]) for(const z of [-.35,.35]) box(desk,.075,1.15,.075,x,.6,z,oak);
  box(desk,.6,.7,.76,.9,.8,0,cream,.04);
  for(let i=0;i<3;i++) {box(desk,.55,.19,.02,.9,.57+i*.22,.39,white);box(desk,.16,.02,.04,.9,.57+i*.22,.41,brass);}
  const pc=group('computer',1.05,1.3,-2.25);
  box(pc,.6,.035,.3,0,0,.05,charcoal);
  box(pc,.065,.24,.075,0,.13,-.08,charcoal);
  box(pc,1.23,.78,.065,0,.6,-.08,charcoal,.04);
  const screenMat=new T.MeshStandardMaterial({color:'#d2dfcc',emissive:'#9daea3',emissiveIntensity:.5,roughness:.4});materials.push(screenMat);
  box(pc,1.13,.67,.009,0,.61,-.039,screenMat,.01);
  // A little three-dimensional landscape behind the computer's clock.
  const screenArt=new T.Group();pc.add(screenArt);
  const mountain=mesh(new T.ConeGeometry(.32,.38,3),green,screenArt,-.25,.5,-.03);mountain.scale.z=.005;mountain.castShadow=false;
  const mountain2=mesh(new T.ConeGeometry(.26,.29,3),darkGreen,screenArt,.1,.45,-.023);mountain2.scale.z=.005;mountain2.castShadow=false;
  sphere(screenArt,.07,.32,.78,-.02,white,1,1,.1);
  box(pc,.79,.038,.27,-.06,.025,.48,cream,.022);
  for(let r=0;r<4;r++) for(let c=0;c<12;c++) box(pc,.049,.01,.04,-.41+c*.061,.05,.39+r*.056,white,.003);
  sphere(pc,.09,.56,.065,.46,cream,.7,.32,1.2);
  const stool=group('stool',1.1,0,-.98);
  cylinder(stool,.39,.4,.15,0,.64,0,green);
  for(let i=0;i<4;i++) {const a=Math.PI/4+i*Math.PI/2;rod(stool,new T.Vector3(Math.cos(a)*.25,.6,Math.sin(a)*.25),new T.Vector3(Math.cos(a)*.35,.07,Math.sin(a)*.35),.034,oak);}
  box(stool,.73,.38,.1,0,.99,.32,paleWood,.065);
  for(const x of [-.28,.28]) box(stool,.04,.38,.04,x,.79,.31,oak);
  const rug=group('rug',.52,.089,1.13);
  const rugMat=mat('#e5d8b8');const rugBase=cylinder(rug,1.72,1.72,.025,0,0,0,rugMat);rugBase.scale.set(1.2,1,.86);
  for(let i=0;i<7;i++) { const ring=mesh(new T.TorusGeometry(1.72-i*.035,.009,4,100),cream,rug,0,.017,0);ring.rotation.x=-Math.PI/2;ring.scale.set(1.2,.86,1); }
  const coffee=group('coffee',.06,0,1.07);
  for(let i=0;i<3;i++) {const a=i*Math.PI*2/3;rod(coffee,new T.Vector3(Math.cos(a)*.4,.57,Math.sin(a)*.4),new T.Vector3(Math.cos(a)*.51,.13,Math.sin(a)*.51),.055,oak);}
  const top=cylinder(coffee,.72,.72,.11,0,.67,0,paleWood);top.scale.x=1.16;
  box(coffee,.37,.048,.47,-.2,.752,-.05,darkGreen).rotation.y=.2;
  box(coffee,.33,.025,.43,-.2,.784,-.05,cream).rotation.y=.2;
  cylinder(coffee,.095,.072,.16,.3,.82,.15,white);
  cylinder(coffee,.082,.082,.008,.3,.905,.15,darkWood);
  const handle=mesh(new T.TorusGeometry(.067,.02,8,20),white,coffee,.4,.83,.15);handle.rotation.y=Math.PI/2;
  const steamMat=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0});materials.push(steamMat);
  const steam=new T.Group();coffee.add(steam);
  for(let i=0;i<4;i++) sphere(steam,.03,.3+Math.sin(i)*.025,1.02+i*.07,.15,steamMat,.6,1.7,.6);
  const chair=group('chair',2.55,0,1.58);chair.rotation.y=-.4;
  for(const x of [-.44,.44]) for(const z of [-.36,.36]) cylinder(chair,.045,.065,.38,x,.29,z,oak);
  const chairMat=mat('#cf966a');
  box(chair,1.2,.28,1.05,0,.58,0,chairMat,.12);
  box(chair,1.17,.85,.25,0,1.02,-.46,chairMat,.12).rotation.x=-.1;
  for(const x of [-.54,.54]) box(chair,.23,.46,1.01,x,.85,0,chairMat,.11);
  box(chair,.77,.18,.78,0,.78,.05,cream,.08);
  box(chair,.52,.43,.18,.13,1.1,-.27,mat('#677966'),.07).rotation.z=-.15;
  const shelf=group('shelf',-3.47,0,-1.52);
  for(const y of [.34,1.22,2.12,3.02]) box(shelf,.61,.085,1.78,0,y,0,paleWood);
  for(const z of [-.84,.84]) box(shelf,.055,2.82,.055,-.21,1.65,z,oak);
  const bookMats=['#797657','#d4b37f','#9b583d','#e4d8b8','#456b60'].map(c=>mat(c));
  for(let level=0;level<3;level++) for(let i=0;i<7;i++) {const h=.35+(i*7%4)*.08;const book=box(shelf,.36,h,.105,.05,.4+level*.9+h/2,-.64+i*.17,bookMats[(i+level)%5],.006);if(i===6)book.rotation.x=.14;box(book,.003,.018,.08,.181,0,0,cream,.001);}
  function plant(x:number,y:number,z:number,size=1) {
    const p=group('plant',x,y,z);p.scale.setScalar(size);
    cylinder(p,.22,.16,.38,0,.21,0,terra);cylinder(p,.23,.23,.065,0,.39,0,terra);cylinder(p,.2,.2,.02,0,.42,0,darkWood);
    for(let i=0;i<9;i++) {
      const a=i*2.399, h=.55+(i%4)*.18;const end=new T.Vector3(Math.cos(a)*.35,h,Math.sin(a)*.35);
      rod(p,new T.Vector3(0,.39,0),end,.012,darkGreen);
      const leaf=sphere(p,.19,end.x,end.y,end.z,i%2?green:darkGreen,.58,1.6,.16);leaf.rotation.set(Math.sin(a)*.5, -a, -.6*Math.cos(a));
    } return p;
  }
  const bigPlant=plant(3.2,.1,-2.45,1.48);
  plant(-3.45,3.08,-1.65,.51);
  plant(2.3,1.3,-2.22,.43);
  const record=group('record',-2.72,0,2.55);
  box(record,1.24,.09,.65,0,.76,0,paleWood);
  for(const x of [-.49,.49]) for(const z of [-.21,.21]) box(record,.05,.65,.05,x,.4,z,oak);
  box(record,1.05,.16,.57,0,.89,0,terra,.035);
  const vinyl=cylinder(record,.22,.22,.018,-.12,.988,0,charcoal);
  cylinder(record,.066,.066,.021,-.12,1,0,cream);
  box(vinyl,.012,.003,.18,0,.012,0,brass,.001);
  rod(record,new T.Vector3(.4,1.01,-.18),new T.Vector3(.2,1.01,.13),.013,brass);
  box(record,.9,.03,.4,0,.27,0,darkGreen);
  const frame=group('frame',-1.82,2.45,-3.18);
  box(frame,1.1,.99,.085,0,0,0,paleWood,.02);
  box(frame,.93,.82,.015,0,0,.049,cream,.001);
  const art=box(frame,.75,.59,.012,0,0,.06,mat('#c4d0b2'),.001);art.castShadow=false;
  sphere(frame,.095,.19,.14,.073,mat('#d4a461'),1,1,.05);
  for(let i=0;i<3;i++) {const m=mesh(new T.ConeGeometry(.25,.35+i*.055,3),i%2?green:darkGreen,frame,-.2+i*.19,-.115,.081+i*.004);m.scale.z=.01;m.castShadow=false;}
  // A small wall clock is part of the room shell and can also be focused.
  const clockFace=cylinder(wall,.23,.23,.05,-3.79,2.75,.76,paleWood);clockFace.rotation.z=Math.PI/2;
  const face=cylinder(wall,.2,.2,.055,-3.77,2.75,.76,white);face.rotation.z=Math.PI/2;
  box(wall,.02,.12,.017,-3.73,2.8,.76,charcoal);
  box(wall,.02,.017,.1,-3.72,2.75,.8,charcoal);

  // Soft contact patches anchor furniture while avoiding expensive postprocessing.
  const contactTexture=(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const ctx=c.getContext('2d')!;const gradient=ctx.createRadialGradient(32,32,3,32,32,32);gradient.addColorStop(0,'rgba(40,29,16,0.24)');gradient.addColorStop(1,'rgba(40,29,16,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);return new T.CanvasTexture(c);})();
  const contactMat=new T.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false});materials.push(contactMat);
  for(const [x,z,w,d] of [[-2.23,.25,2.65,3.7],[2.55,1.58,1.7,1.7],[1.27,-2.1,3.2,1.6],[.06,1.07,1.8,1.8]]) {const s=mesh(new T.PlaneGeometry(w,d),contactMat,root,x,.079,z);s.rotation.x=-Math.PI/2;s.castShadow=false;}
  const raycaster=new T.Raycaster();const mouse=new T.Vector2();let downX=0,downY=0;
  
  const pick=(e:PointerEvent)=>{
    const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);
    const hit=raycaster.intersectObjects(interactables,true)[0];if(!hit)return null;
    let o:T.Object3D|null=hit.object;while(o&&!o.userData.id)o=o.parent;return (o?.userData.id as ObjectId)||null;
  };
  const pointerDown=(e:PointerEvent)=>{downX=e.clientX;downY=e.clientY;};
  const pointerMove=(e:PointerEvent)=>{const id=pick(e);renderer.domElement.style.cursor=id?'pointer':'grab';options.onHover(id,e.clientX,e.clientY);};
  const pointerLeave=()=>{options.onHover(null,0,0);};
  const pointerUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-downX,e.clientY-downY)>6)return;const id=pick(e);if(id){api.focus(id);options.onSelect(id);}};
  renderer.domElement.addEventListener('pointerdown',pointerDown);
  renderer.domElement.addEventListener('pointermove',pointerMove);
  renderer.domElement.addEventListener('pointerleave',pointerLeave);
  renderer.domElement.addEventListener('pointerup',pointerUp);
  let tween:{from:T.Vector3;to:T.Vector3;targetFrom:T.Vector3;targetTo:T.Vector3;start:number}|null=null;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function moveTo(to:T.Vector3,look:T.Vector3) {if(reduced){camera.position.copy(to);controls.target.copy(look);return;}tween={from:camera.position.clone(),to,targetFrom:controls.target.clone(),targetTo:look,start:performance.now()};}
  const stopTween=()=>{tween=null;};controls.addEventListener('start',stopTween);
  let night=false,lit=true,music=false,bedColor=0,chairColor=0,rugColor=0;let wateringUntil=0,steamUntil=0;
  const droplets=new T.Group();bigPlant.add(droplets);droplets.visible=false;
  const waterMat=mat('#9ecee5');
  for(let i=0;i<8;i++) sphere(droplets,.025,Math.sin(i*3)*.25,1.1+i*.1,Math.cos(i*3)*.25,waterMat,.7,1.7,.7);
  const selectedRing=mesh(new T.TorusGeometry(.26,.012,8,40),brass,root,0,.12,0);selectedRing.rotation.x=-Math.PI/2;selectedRing.visible=false;selectedRing.castShadow=false;
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=w<640?45:34;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let frameId=0;const start=performance.now();let last=performance.now();
  function animate(now:number) {
    frameId=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;const t=(now-start)/1000;
    if(tween){const p=Math.min((now-tween.start)/850,1),s=1-Math.pow(1-p,3);camera.position.lerpVectors(tween.from,tween.to,s);controls.target.lerpVectors(tween.targetFrom,tween.targetTo,s);if(p===1)tween=null;}
    const a=1-Math.exp(-dt*3);
    hemi.intensity=T.MathUtils.lerp(hemi.intensity,night?.58:2.4,a);sun.intensity=T.MathUtils.lerp(sun.intensity,night?.55:4.2,a);fill.intensity=T.MathUtils.lerp(fill.intensity,night?.45:1.3,a);
    sun.color.lerp(new T.Color(night?'#92acfb':'#fff0cf'),a);
    skyMat.color.lerp(new T.Color(night?'#223754':'#b8d9d4'),a);skyMat.emissive.lerp(new T.Color(night?'#243553':'#86bcb2'),a);
    lampLight.intensity=T.MathUtils.lerp(lampLight.intensity,lit?(night?12:5):0,a);shade.emissiveIntensity=T.MathUtils.lerp(shade.emissiveIntensity,lit?.75:0,a);
    screenLight.intensity=T.MathUtils.lerp(screenLight.intensity,night?1.8:.1,a);stars.visible=night;
    if(music)vinyl.rotation.y+=dt*1.5;
    if(!reduced)bigPlant.rotation.z=Math.sin(t*.7)*.01;
    droplets.visible=now<wateringUntil;droplets.children.forEach((drop,i)=>{drop.position.y=1.4-((t*.7+i*.11)%1);});
    steamMat.opacity=now<steamUntil?.3:0;steam.position.y=Math.sin(t*2)*.03;
    controls.update();renderer.render(scene,camera);
  }
  const api:RoomApi={
    reset(){moveTo(initial.clone(),target.clone());selectedRing.visible=false;},
    zoom(direction){const delta=camera.position.clone().sub(controls.target);delta.multiplyScalar(direction>0?.83:1.2);delta.clampLength(controls.minDistance,controls.maxDistance);moveTo(controls.target.clone().add(delta),controls.target.clone());},
    focus(id){const g=groups.get(id);if(!g)return;if(id==='floor'||id==='wall'){this.reset();return;}const bounds=new T.Box3().setFromObject(g);const center=bounds.getCenter(new T.Vector3());const dir=camera.position.clone().sub(controls.target).normalize();const distance=Math.max(5.3,bounds.getSize(new T.Vector3()).length()*1.7);moveTo(center.clone().add(dir.multiplyScalar(distance)),center);selectedRing.position.set(center.x,.12,center.z);selectedRing.visible=true;},
    setNight(value){night=value;},setLamp(value){lit=value;},setMusic(value){music=value;},
    interact(id){if(id==='bed')bedding.color.set(['#74856b','#b8816b','#7b91a2'][++bedColor%3]);if(id==='chair')chairMat.color.set(['#cf966a','#7f9479','#9d8287'][++chairColor%3]);if(id==='rug')rugMat.color.set(['#e5d8b8','#b1bdac','#d7bda4'][++rugColor%3]);if(id==='plant')wateringUntil=performance.now()+3200;if(id==='coffee')steamUntil=performance.now()+6000;if(id==='stool')stool.rotation.y+=Math.PI/4;},
    dispose(){cancelAnimationFrame(frameId);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerleave',pointerLeave);renderer.domElement.removeEventListener('pointerup',pointerUp);const geometries=new Set<T.BufferGeometry>();scene.traverse(o=>{if(o instanceof T.Mesh)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());contactTexture.dispose();renderer.dispose();renderer.domElement.remove();}
  };
  controls.update();renderer.render(scene,camera);frameId=requestAnimationFrame(animate);options.onReady();return api;
}
