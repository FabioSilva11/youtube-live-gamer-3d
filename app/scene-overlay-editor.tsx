'use client';
import {useRef,type PointerEvent as ReactPointerEvent} from 'react';
import type {SceneBox,SceneView} from '@/lib/composition';

type Kind='ranking'|'pix';
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

export default function SceneOverlayEditor({view,onPreview,onCommit}:{view:SceneView,onPreview:(view:SceneView)=>void,onCommit:(view:SceneView)=>void}){
 const active=useRef<{kind:Kind,mode:'move'|'resize',startX:number,startY:number,box:SceneBox,bounds:DOMRect}|null>(null);
 const viewRef=useRef(view);viewRef.current=view;
 function begin(kind:Kind,mode:'move'|'resize',event:ReactPointerEvent<HTMLDivElement>){
  event.preventDefault();event.stopPropagation();
  const guide=event.currentTarget.closest('.studio-frame-guide') as HTMLElement|null;if(!guide)return;
  active.current={kind,mode,startX:event.clientX,startY:event.clientY,box:{...view[kind]},bounds:guide.getBoundingClientRect()};
  event.currentTarget.setPointerCapture(event.pointerId);
 }
 function move(event:ReactPointerEvent<HTMLDivElement>){
  const drag=active.current;if(!drag)return;
  const dx=(event.clientX-drag.startX)/drag.bounds.width,dy=(event.clientY-drag.startY)/drag.bounds.height;
  let box:SceneBox;
  if(drag.mode==='resize'){
   const width=clamp(drag.box.width+dx,.1,.8),height=clamp(drag.box.height+dy,.08,.8);
   box={...drag.box,width:Math.min(width,1-drag.box.x),height:Math.min(height,1-drag.box.y)};
  }else box={...drag.box,x:clamp(drag.box.x+dx,0,1-drag.box.width),y:clamp(drag.box.y+dy,0,1-drag.box.height)};
  onPreview({...view,[drag.kind]:box});
 }
 function finish(_event:ReactPointerEvent<HTMLDivElement>){
  if(!active.current)return;active.current=null;onCommit(viewRef.current);
 }
 return <>
  {(['ranking','pix'] as Kind[]).map(kind=><div key={kind} className={'scene-overlay-item is-'+kind} style={{left:`${view[kind].x*100}%`,top:`${view[kind].y*100}%`,width:`${view[kind].width*100}%`,height:`${view[kind].height*100}%`}} onPointerDown={event=>begin(kind,'move',event)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
   <b>{kind==='ranking'?'Ranking':'Pix'}</b><div className="scene-overlay-resize" title={'Redimensionar '+(kind==='ranking'?'ranking':'Pix')} onPointerDown={event=>begin(kind,'resize',event)}/>
  </div>)}
 </>;
}
