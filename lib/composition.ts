import type {BiomeId} from './biomes';

export type SceneBox={x:number,y:number,width:number,height:number};
export type SceneCamera={position:{x:number,y:number,z:number},target:{x:number,y:number,z:number},fov:number};
export type SceneView={ranking:SceneBox,pix:SceneBox,camera?:SceneCamera};
export type SceneComposition={version:1,views:Record<string,SceneView>};

const finite=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
export const compositionKey=(biome:BiomeId|string,orientation:string)=>`${biome==='minecraft'?'minecraft':'fantasy'}:${orientation==='portrait'?'portrait':'landscape'}`;

export function defaultSceneView(orientation:string):SceneView {
 const portrait=orientation==='portrait';
 return portrait
  ?{ranking:{x:.54,y:.04,width:.41,height:.21},pix:{x:.04,y:.67,width:.28,height:.28}}
  :{ranking:{x:.70,y:.04,width:.27,height:.25},pix:{x:.03,y:.60,width:.17,height:.34}};
}

function normaliseBox(value:unknown,fallback:SceneBox):SceneBox {
 const box=value&&typeof value==='object'?value as Partial<SceneBox>:{};
 const width=clamp(finite(box.width,fallback.width),.1,.8);
 const height=clamp(finite(box.height,fallback.height),.08,.8);
 return {x:clamp(finite(box.x,fallback.x),0,1-width),y:clamp(finite(box.y,fallback.y),0,1-height),width,height};
}

function normaliseCamera(value:unknown):SceneCamera|undefined {
 if(!value||typeof value!=='object')return undefined;
 const camera=value as Partial<SceneCamera>,position=camera.position as any,target=camera.target as any;
 if(!position||!target)return undefined;
 const safe=(v:unknown)=>clamp(finite(v,0),-200,200);
 return {position:{x:safe(position.x),y:safe(position.y),z:safe(position.z)},target:{x:safe(target.x),y:safe(target.y),z:safe(target.z)},fov:clamp(finite(camera.fov,45),20,85)};
}

export function normaliseSceneView(value:unknown,orientation:string):SceneView {
 const fallback=defaultSceneView(orientation),view=value&&typeof value==='object'?value as Partial<SceneView>:{};
 const camera=normaliseCamera(view.camera);
 return {ranking:normaliseBox(view.ranking,fallback.ranking),pix:normaliseBox(view.pix,fallback.pix),...(camera?{camera}:{})};
}

export function normaliseSceneComposition(value:unknown):SceneComposition {
 let raw:any=value;
 if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch{raw={}}}
 const source=raw&&typeof raw==='object'&&raw.views&&typeof raw.views==='object'?raw.views:{};
 const views:Record<string,SceneView>={};
 for(const biome of ['fantasy','minecraft'] as const)for(const orientation of ['landscape','portrait'] as const){
  const key=compositionKey(biome,orientation);views[key]=normaliseSceneView(source[key],orientation);
 }
 return {version:1,views};
}
