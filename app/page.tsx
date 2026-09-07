'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp, Compass, Focus, Headphones, House, Leaf, Lightbulb, Maximize2, Minus, Moon, Mouse, Move, Plus, RotateCcw, Sun, Volume2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { objects, type ObjectId, type RoomApi } from './room-data';
import Landscape from './landscape';
import Link from 'next/link';

export default function Home(){
  const host=useRef<HTMLDivElement>(null);const api=useRef<RoomApi|null>(null);
  const [ready,setReady]=useState(false);const [error,setError]=useState(false);
  const [night,setNight]=useState(false);const [lamp,setLamp]=useState(true);const [music,setMusic]=useState(false);
  const [selected,setSelected]=useState<ObjectId|null>(null);const [hover,setHover]=useState<{id:ObjectId,x:number,y:number}|null>(null);
  const [modal,setModal]=useState<'computer'|'frame'|'book'|'help'|'explore'|null>(null);
  const [toast,setToast]=useState('');const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [note,setNote]=useState('今天的灵感：\n给生活留一点空白。');const [noteLoaded,setNoteLoaded]=useState(false);
  const [photo,setPhoto]=useState(0);const [bookPage,setBookPage]=useState(0);
  const audio=useRef<{ctx:AudioContext;gain:GainNode;timer:ReturnType<typeof setInterval>}|null>(null);
  const notify=useCallback((message:string)=>{setToast(message);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),3200);},[]);
  useEffect(()=>{let disposed=false;import('./room-scene').then(({createRoom})=>{if(disposed||!host.current)return;try{api.current=createRoom(host.current,{onSelect:setSelected,onHover:(id,x,y)=>setHover(id?{id,x,y}:null),onReady:()=>setReady(true)});}catch(e){console.error(e);setError(true);}}).catch(()=>setError(true));return()=>{disposed=true;api.current?.dispose();api.current=null;if(toastTimer.current)clearTimeout(toastTimer.current);};},[]);
  useEffect(()=>{api.current?.setNight(night);},[night,ready]);
  useEffect(()=>{api.current?.setLamp(lamp);},[lamp,ready]);
  useEffect(()=>{api.current?.setMusic(music);},[music,ready]);
  useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(!active)return;try{const saved=localStorage.getItem('komori-note');if(saved!==null)setNote(saved);}catch{}setNoteLoaded(true);});return()=>{active=false;};},[]);
  useEffect(()=>{if(noteLoaded)try{localStorage.setItem('komori-note',note);}catch{}},[note,noteLoaded]);
  useEffect(()=>()=>{if(audio.current){clearInterval(audio.current.timer);void audio.current.ctx.close();}},[]);
  const toggleMusic=async()=>{
    if(music){if(audio.current){clearInterval(audio.current.timer);void audio.current.ctx.close();audio.current=null;}setMusic(false);return;}
    try{
      const ctx=new AudioContext();await ctx.resume();const gain=ctx.createGain();gain.gain.value=.09;gain.connect(ctx.destination);
      const notes=[261.63,329.63,392,493.88,440,392,329.63,293.66];let step=0;
      const play=()=>{const t=ctx.currentTime;const osc=ctx.createOscillator();const env=ctx.createGain();osc.type='sine';osc.frequency.value=notes[step++%notes.length];env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(.4,t+.08);env.gain.exponentialRampToValueAtTime(.001,t+2.5);osc.connect(env);env.connect(gain);osc.start(t);osc.stop(t+2.6);osc.onended=()=>{osc.disconnect();env.disconnect();};};
      play();audio.current={ctx,gain,timer:setInterval(play,780)};setMusic(true);
    }catch{notify('浏览器暂时无法播放声音，请再试一次。');}
  };
  const reset=()=>{api.current?.reset();setSelected(null);setHover(null);};
  const choose=(id:ObjectId)=>{setSelected(id);api.current?.focus(id);setModal(null);};
  const action=(id:ObjectId)=>{
    if(id==='lamp'){setLamp(v=>!v);return;}
    if(id==='window'){setNight(v=>!v);return;}
    if(id==='computer'||id==='desk'){setModal('computer');return;}
    if(id==='frame'){setModal('frame');return;}
    if(id==='shelf'){setModal('book');return;}
    if(id==='record'){void toggleMusic();return;}
    if(id==='floor'||id==='wall'){reset();return;}
    api.current?.interact(id);
    notify(({bed:'换上新床品，换一个好心情。',chair:'阅读角，有了新的颜色。',rug:'柔软的地毯，换一份心情。',plant:'喝饱水啦，慢慢长大吧。',coffee:'咖啡续好了，享受这一刻。',stool:'给小木凳换个方向。'} as Partial<Record<ObjectId,string>>)[id]||'');
  };
  const fullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notify('当前浏览器不支持全屏，可横屏体验小屋。');}catch{notify('当前浏览器暂时无法进入全屏。');}};
  useEffect(()=>{
    type Tool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>Promise<unknown>};
    const context=(document as Document & {modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tool:Tool={name:'configure_komori_room',description:'Set the room to day or night, turn the lamp on or off, or focus one of its interactive objects.',inputSchema:{type:'object',properties:{night:{type:'boolean'},lamp:{type:'boolean'},focus:{type:'string',enum:Object.keys(objects)}},additionalProperties:false},annotations:{readOnlyHint:false},async execute(input){
      if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected an object');
      const value=input as Record<string,unknown>;
      if(Object.keys(value).some(k=>!['night','lamp','focus'].includes(k)))throw new Error('Unknown option');
      if('night' in value&&typeof value.night!=='boolean')throw new Error('night must be boolean');
      if('lamp' in value&&typeof value.lamp!=='boolean')throw new Error('lamp must be boolean');
      if('focus' in value&&(typeof value.focus!=='string'||!Object.hasOwn(objects,value.focus)))throw new Error('Unknown object');
      if(!api.current)throw new Error('Room is still loading');
      if(typeof value.night==='boolean'){setNight(value.night);api.current.setNight(value.night);}
      if(typeof value.lamp==='boolean'){setLamp(value.lamp);api.current.setLamp(value.lamp);}
      if(typeof value.focus==='string'){setSelected(value.focus as ObjectId);api.current.focus(value.focus as ObjectId);}
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      return {applied:value};
    }};
    try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
    return()=>lifecycle.abort();
  },[]);
  const photos=[{title:'山间来信',sub:'山有自己的节奏，我也是。',palette:'mountain'},{title:'日落之前',sub:'把一天里最温柔的光，留在这里。',palette:'sunset'},{title:'蓝色的远方',sub:'下一次旅行，去海边吧。',palette:'ocean'}];
  return <main className={`app ${night?'night':''}`}>
    <header className="header">
      <Link className="brand" href="/" aria-label="小森居首页"><span className="brand-symbol"><House size={21}/><span/></span><span>小森居<span className="brand-en">KOMORI</span></span></Link>
      <div className="header-caption"><span className="tiny-dot"/> A LITTLE SPACE, ALL YOURS</div>
      <div className="header-actions"><ToggleGroup className="day-toggle" value={[night?'night':'day']} onValueChange={value=>{if(value.length)setNight(value[0]==='night');}} aria-label="昼夜模式"><ToggleGroupItem value="day" aria-label="白昼"><Sun size={15}/><span>白昼</span></ToggleGroupItem><ToggleGroupItem value="night" aria-label="夜晚"><Moon size={15}/><span>夜晚</span></ToggleGroupItem></ToggleGroup><button className="icon-button help" onClick={()=>setModal('help')} aria-label="操作帮助"><CircleHelp size={19}/></button></div>
    </header>
    <div className="scene" ref={host}/>
    <div className="intro"><div className="eyebrow"><span className="line"/> YOUR SLOW LITTLE WORLD</div><h1>把日子，<br/>过成喜欢的样子<span>。</span></h1><p>不用赶路，<br/>在自己的小世界里，待一会儿。</p><div className="scene-label"><span className="tiny-dot"/>{night?'月色正好 · 适合放空':'午后微风 · 适合发呆'}</div></div>
    <div className="room-tag"><span>01</span><div>林间小屋<small>THE WOODLAND ROOM</small></div><Leaf size={17}/></div>
    <div className="scene-tools"><button className="icon-button" aria-label="放大" title="放大" onClick={()=>api.current?.zoom(1)} disabled={!ready}><Plus size={19}/></button><span/><button className="icon-button" aria-label="缩小" title="缩小" onClick={()=>api.current?.zoom(-1)} disabled={!ready}><Minus size={19}/></button><div className="tools-divider"/><button className="icon-button" aria-label="回到初始视角" title="回到初始视角" onClick={reset} disabled={!ready}><RotateCcw size={18}/></button><button className="icon-button" aria-label="全屏" title="全屏" onClick={fullscreen}><Maximize2 size={18}/></button></div>
    {!ready&&<div className="loading"><Leaf size={28} className={error?'':'loading-leaf'}/><p>{error?'小屋暂时无法显示':'正在打开你的小世界…'}</p>{error&&<><small>请使用支持 WebGL 的浏览器，并启用硬件加速。</small><button onClick={()=>location.reload()}>重新打开</button></>}</div>}
    {hover&&!selected&&<div className="hover-label" style={{left:Math.min(hover.x+15,typeof window!=='undefined'?window.innerWidth-180:1000),top:hover.y-42}}>{objects[hover.id].name}<ArrowUpRight size={14}/></div>}
    {selected&&<aside className="object-card" aria-live="polite"><button className="close-card" onClick={()=>setSelected(null)} aria-label="关闭物件详情"><X size={17}/></button><span className="object-kind">{objects[selected].kind}</span><h2>{objects[selected].name}</h2><p>{objects[selected].description}</p><button className="object-action" onClick={()=>action(selected)}>{selected==='lamp'?(lamp?'关掉台灯':'打开台灯'):selected==='record'?(music?'暂停音乐':'播放音乐'):objects[selected].action}<ArrowUpRight size={16}/></button><button className="back-overview" onClick={reset}><ArrowLeft size={13}/>回到小屋全景</button></aside>}
    <div className="lower-left"><span className="handwritten">a place to just be.</span><p><span className="tiny-dot"/> {music?'此刻，音乐正轻轻播放':'此刻，留一点时间给自己'}</p></div>
    <div className="bottom-controls"><div className="control-hint"><Mouse size={14}/><span>拖动旋转</span><span className="hint-dot">·</span><span>滚轮缩放</span><span className="hint-dot">·</span><span>点击探索</span></div><nav className="dock" aria-label="小屋操作"><button className={!selected?'dock-item active':'dock-item'} onClick={reset} disabled={!ready}><House size={19}/><span>小屋全景</span></button><button className="dock-item" onClick={()=>setModal('explore')} disabled={!ready}><Compass size={20}/><span>探索物件</span></button><span className="dock-separator"/><button className={`dock-item ${lamp?'is-on':''}`} onClick={()=>setLamp(v=>!v)} aria-pressed={lamp} disabled={!ready}><Lightbulb size={19}/><span>暖光台灯</span><i className="status-dot"/></button><button className={`dock-item ${music?'is-on':''}`} onClick={toggleMusic} aria-pressed={music} disabled={!ready}>{music?<Volume2 size={19}/>:<Headphones size={19}/>}<span>背景音乐</span>{music&&<i className="sound-bars"><i/><i/><i/></i>}</button></nav></div>
    <div className="lower-right"><span className="compass-mark">N<ArrowDownLeft size={22}/></span><span>慢下来，好好生活<Leaf size={13}/></span></div>
    {toast&&<output className="toast"><Check size={16}/>{toast}</output>}
    <Dialog open={modal!==null} onOpenChange={open=>{if(!open)setModal(null);}}><DialogContent className={`room-dialog ${modal==='computer'?'computer-dialog':''}`}>
      <DialogTitle>{modal==='computer'?'窗边工作站':modal==='frame'?photos[photo].title:modal==='book'?'一本慢生活手记':modal==='explore'?'小屋里的日常':'欢迎来到小森居'}</DialogTitle>
      <DialogDescription>{modal==='computer'?'把此刻的灵感，留在这里。':modal==='frame'?'一张小画，装下一段远方。':modal==='book'?'翻几页，也是一种休息。':modal==='explore'?'选一件喜欢的物件，靠近看看。':'按照自己的节奏，探索这间小屋。'}</DialogDescription>
      {modal==='computer'&&<div className="computer-content"><div className="computer-topbar"><span><i/><i/><i/></span><span>KOMORI NOTES</span><Leaf size={15}/></div><div className="note-heading"><BookOpen size={21}/><h3>灵感便签</h3><span>仅保存在此浏览器</span></div><label className="sr-only" htmlFor="note">灵感便签</label><textarea id="note" value={note} onChange={e=>setNote(e.target.value)} maxLength={5000} spellCheck={false}/><div className="note-bottom"><span>{note.length} / 5000</span><span><Check size={13}/> 自动保存</span></div></div>}
      {modal==='frame'&&<div className="gallery"><div className={`landscape ${photos[photo].palette}`}><Landscape variant={photo}/><span className="print-caption">{['INTO THE WOODS','GOLDEN HOUR','SOMEWHERE BLUE'][photo]}</span></div><p>{photos[photo].sub}</p><div className="gallery-controls">{photos.map((p,i)=><button key={p.title} aria-label={`查看${p.title}`} aria-pressed={photo===i} onClick={()=>setPhoto(i)} className={photo===i?'current':''}/>)}<span>{String(photo+1).padStart(2,'0')} / 03</span></div></div>}
      {modal==='book'&&<div className="book"><span className="eyebrow">NOTES ON SLOW LIVING</span><h3>{['让生活有一点留白','把注意力交给当下','平凡，也值得收藏'][bookPage]}</h3><p>{['早晨的光落在桌上，杯子里还有一点温热的咖啡。\n\n不必把每一分钟都填满。打开窗，让风进来；翻开书，停在喜欢的一页。\n\n那些看起来什么也没做的时刻，或许正让心慢慢恢复原来的形状。','为窗边的植物浇一次水，认真听完一首歌，感受脚下地毯的柔软。\n\n不用同时做很多事。此刻正在发生的小事，就值得你完整的注意力。\n\n今天，也试着对自己温柔一点。','记住一束下午的光，一个好看的影子，一顿简单的晚餐。\n\n生活里的美好，常常没有宏大的开场。它们安静地出现，等我们慢下来。\n\n愿你的每一天，都有一处可以安心停留的角落。'][bookPage]}</p><div><button aria-label="上一页" disabled={bookPage===0} onClick={()=>setBookPage(v=>v-1)}><ArrowLeft size={16}/></button><span>{bookPage+1} / 3</span><button aria-label="下一页" disabled={bookPage===2} onClick={()=>setBookPage(v=>v+1)}><ChevronRight size={18}/></button></div></div>}
      {modal==='explore'&&<div className="explore-grid">{(Object.keys(objects) as ObjectId[]).map((id,i)=><button key={id} onClick={()=>choose(id)}><span className="explore-number">{String(i+1).padStart(2,'0')}</span><span>{objects[id].name}<small>{objects[id].kind}</small></span><ArrowUpRight size={16}/></button>)}</div>}
      {modal==='help'&&<div className="help-content"><div><Move/><span><b>换个角度</b>拖动空白处旋转，手机上用单指拖动。</span></div><div><Focus/><span><b>靠近一点</b>滚轮或双指缩放；点击家具，镜头自动靠近。</span></div><div><Lightbulb/><span><b>让日常发生</b>在物件详情中开灯、浇水、换床品，或打开电脑和相框。</span></div><div><Sun/><span><b>从午后到深夜</b>右上角切换昼夜，底部按钮回到全景、开灯或播放音乐。</span></div><p>也可通过「探索物件」用键盘选择家具。弹窗按 Esc 关闭。</p></div>}
    </DialogContent></Dialog>
  </main>;
}
