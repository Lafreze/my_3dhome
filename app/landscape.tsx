'use client';
import { useEffect, useRef } from 'react';
import * as T from 'three';
// The framed keepsakes are small real 3D scenes, matching the miniature room.
export default function Landscape({ variant }: { variant:number }) {
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!host.current)return;
    const el=host.current;const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    el.appendChild(renderer.domElement);const scene=new T.Scene();
    const colors=[['#c4d0b4','#688573','#385e4b','#e2b667'],['#e3c3a2','#b48275','#785a5c','#e39652'],['#c5d9db','#82b3bb','#4a8094','#efe4be']][variant];
    scene.background=new T.Color(colors[0]);const camera=new T.OrthographicCamera(-2,2,1.3,-1.3,.1,100);camera.position.set(0,0,10);
    const ambient=new T.AmbientLight('#ffffff',2);scene.add(ambient);
    const geometries:T.BufferGeometry[]=[];const materials:T.Material[]=[];
    function item(geometry:T.BufferGeometry,color:string,x:number,y:number,z:number){const material=new T.MeshStandardMaterial({color,roughness:1});geometries.push(geometry);materials.push(material);const m=new T.Mesh(geometry,material);m.position.set(x,y,z);scene.add(m);return m;}
    item(new T.SphereGeometry(.27,40,24),colors[3],.75,.64,0).scale.z=.2;
    if(variant===2){for(let i=0;i<3;i++){const wave=item(new T.BoxGeometry(5,1.1,.02),colors[i%2+1],Math.sin(i)*.1,-.55-i*.35,i*.08);wave.rotation.z=.025*(i-1);}}
    else for(let i=0;i<5;i++){const m=item(new T.ConeGeometry(.9,1.7+(i%3)*.25,3),colors[i%2+1],-2+i*.95,-.5-i%2*.3,i*.1);m.rotation.y=Math.PI;m.scale.z=.15;}
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.left=-1.3*w/h;camera.right=1.3*w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    return()=>{observer.disconnect();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
  },[variant]);
  return <figure className="landscape-render" ref={host} aria-label={['绿色远山与一轮暖阳','日落下的层叠山峦','宁静的蓝色海面'][variant]}/>;
}
