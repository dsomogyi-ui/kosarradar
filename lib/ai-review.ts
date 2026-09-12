import {parseNeed} from './shopping-text.ts';
export function reviewInput(value:unknown):string[]|null {
 if(!value||typeof value!=='object')return null;
 const lines=(value as {lines?:unknown}).lines;
 return Array.isArray(lines)&&lines.length>0&&lines.length<=24&&lines.every(l=>typeof l==='string'&&l.trim().length>0&&l.length<=200)?lines as string[]:null;
}
export function reviewOutput(value:unknown,length:number):{interpretation:string;note:string}[]|null{
 try{const rows=(value as {lines:unknown[]}).lines;if(!Array.isArray(rows)||rows.length!==length)return null;
  return rows.map((v:any)=>{if(!v||typeof v.query!=='string'||v.query.length>100||typeof v.amount!=='number'||!Number.isFinite(v.amount)||!['db','l','ml','kg','g','csomag'].includes(v.unit)||typeof v.note!=='string'||v.note.length>300)throw Error();
   const interpretation=`${v.query}, ${v.amount} ${v.unit}`;if(parseNeed(interpretation).error)throw Error();return {interpretation,note:v.note};});
 }catch{return null;}
}
