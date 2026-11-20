// restore runner state after Firefly tab reload
(async()=>{
const R='https://raw.githubusercontent.com/dzpspzoo/roboguardian-english-quest-/claude/project-thread-m6rc0s/film-src/';
const ld=async f=>(0,eval)(await (await fetch(R+'_tools/'+f+'?t='+Date.now())).text());
await ld('helpers.js'); await ld('helpers3.js'); await ld('fqREST.js');
const toPng=async b=>{const im=await createImageBitmap(b);const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return await new Promise(r=>c.toBlob(r,'image/png'))};
const map={'E08.png':'E08_v2.webp','E12.png':'E12.webp','B02.png':'B02.webp','B04.png':'B04_v2.webp','F01.png':'F01b.webp','F03.png':'F03b.webp'};
for(const [k,f] of Object.entries(map)){window.FFR[k]=await toPng(await (await fetch(R+'nowe/'+f)).blob())}
const done=window.RESTORE_DONE||[];
for(const k of done) window.FV[k]={done:1};
const suf=' Smooth cinematic camera, realistic weight, characters keep their exact look, no morphing, no text.';
const g=k=>FQREST.find(q=>q.k===k);
const extra=[
 {...g('E01'),k:'E01c',els:['Aegis'],p:'Peaceful hangar, no light beams and no lasers anywhere: the robot parts float gently into place on the frame and click together like puzzle pieces, the core in the chest glows, the visor lights up turquoise, and the complete navy-blue and orange robot takes one calm step forward out of the frame. Workers in orange suits clap in the background.'+suf},
 {...g('E02'),k:'E02c',start:'<E01c',els:['Aegis'],p:'Close-up of the same robot standing still: the camera slowly moves up from his glowing chest core to his visor, where a small blinking turquoise dot appears like a map marker. Only this one robot, no other robots, no beams.'+suf},
 {...g('E07'),k:'E07c'}];
window.FQALL=FQREST.concat(extra); window.FQ=window.FQALL;
let s=runQ.toString(); s=s.replace("if(d>25){log(q.k+' WRONGFRAME?');FRUN=false;break}","if(d>25){log(q.k+' WRONGFRAME? (continuing)');(window.WF=window.WF||[]).push(q.k)}"); window.runQ=(0,eval)('('+s+')');
window.RESTORED=FQALL.filter(q=>!FV[q.k]).map(q=>q.k);
})();
'restore started';
