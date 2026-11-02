/* M2D portfolio: filmstrip view ⇄ stack ⇄ scattered gallery (GSAP) */
(function(){
  const $$=(q,c=document)=>[...c.querySelectorAll(q)];
  const pf=document.querySelector('.pf'); if(!pf||!window.gsap) return;
  // coming back with the Back button restores the page mid-transition (photo centred, others gone): start fresh instead
  addEventListener('pageshow',e=>{ if(e.persisted) location.reload(); });
  const world=pf.querySelector('.pf__world'), items=[...pf.querySelectorAll('.pf__item')], sw=pf.querySelector('.pf__switch'), swLabel=pf.querySelector('.pf__sw-label');
  const bar=pf.querySelector('.pf__bar em'), cur=pf.querySelector('.pf__cur'), hint=pf.querySelector('.pf__hint');
  if(hint && matchMedia('(pointer:coarse)').matches) hint.textContent=hint.textContent.replace(/^\s*click\s*(&|and)\s*/i,'');
  const N=items.length, reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let vw=innerWidth, vh=innerHeight;
  let mode='strip', busy=false;
  // pan state (lerped)
  const pan={x:0,y:0,tx:0,ty:0}, mouse={x:0,y:0,tx:0,ty:0};
  pf.addEventListener('mousemove',e=>{ mouse.tx=(e.clientX/innerWidth-.5)*2; mouse.ty=(e.clientY/innerHeight-.5)*2; });
  let strip=[], gal=[], bounds={minX:0,maxX:0,minY:0,maxY:0};

  // deterministic pseudo-random
  function rnd(seed){ let t=seed+0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }

  /* ---------- layouts (all in world coords, screen = world + pan) ---------- */
  // two even rows: every photo the same height, same gaps, captions underneath; each photo joins the shorter row.
  // Scrolling moves the top row left and the bottom row right; both loop forever (copies fill a row that is too short).
  let rowOf=[], rowLen=[0,0], clones=[], maxW=0, sgap=0;
  function layoutStrip(){
    vw=innerWidth; vh=innerHeight;
    const hh=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'))||80;
    const top=hh+(vw<700?56:70), bottom=vw<700?96:140, cap=44, rowGap=Math.max(18,vh*.035), side=Math.max(20,vw*.05);
    sgap=Math.max(16,vw*.025);
    const room=vh-top-bottom-cap*2-rowGap, h=Math.max(110,Math.min(room/2, vw*(vw<700?.48:.24)));
    const y0=top+Math.max(0,(room-h*2)/2), ys=[y0, y0+h+cap+rowGap];
    clones.forEach(c=>c.el.remove()); clones=[];
    const ends=[0,0]; strip=[]; rowOf=[];
    items.forEach(el=>{
      const w=h*(+el.dataset.r), row=ends[0]<=ends[1]?0:1;
      strip.push({x:side+ends[row], y:ys[row], w, h, rot:0}); rowOf.push(row); ends[row]+=w+sgap;
    });
    maxW=Math.max(...strip.map(p=>p.w));
    const need=vw+maxW*2+sgap*2;
    [0,1].forEach(row=>{
      const src=items.map((_,i)=>i).filter(i=>rowOf[i]===row); if(!src.length) return;
      // repeat the whole row (never part of it) so the loop always shows the photos in the same order
      const sets=Math.max(0,Math.ceil(need/ends[row])-1);
      for(let k=0; k<sets*src.length; k++){
        const i=src[k%src.length], el=items[i].cloneNode(true);
        el.classList.add('pf__clone'); el.setAttribute('aria-hidden','true'); el.tabIndex=-1; el.dataset.src=i;
        el.addEventListener('click',e=>e.preventDefault());
        world.appendChild(el);
        const c={el, i, x:side+ends[row], y:ys[row], w:strip[i].w, h, row};
        gsap.set(el,{x:c.x,y:c.y,width:c.w,height:c.h,opacity:0}); clones.push(c); ends[row]+=c.w+sgap;
      }
    });
    rowLen=ends.slice();
    bounds={minX:-Infinity,maxX:Infinity,minY:0,maxY:0};
  }
  // where a photo sits on screen for the current scroll: top row follows the scroll, bottom row runs the other way, both wrap round
  function wrapX(p,row,px){
    const L=rowLen[row]; if(!L) return p.x;
    const start=-(maxW+sgap), off=row===0?px:-px;
    return start+((((p.x+off-start)%L)+L)%L);
  }
  const showClones=(d=.6)=>clones.forEach(c=>gsap.to(c.el,{opacity:1,duration:d,overwrite:'auto'}));
  const hideClones=()=>clones.forEach(c=>gsap.set(c.el,{opacity:0}));
  // three depth bands: [parallax factor, size scale]. Rows cycle through them.
  const DEPTH=[[.55,.74],[.78,.88],[1,1]];
  const ROW_DEPTH=[2,0,1,2,1,0,2,0,1,2];
  let galRows=[];
  function layoutGallery(){
    vw=innerWidth; vh=innerHeight;
    const small=vw<=900;
    // phones: two staggered columns of larger photos that fill the screen; desktop: six loose columns
    const cols=small?2:6, rows=Math.ceil(N/cols)+(small?.5:0);
    const cellW=small?vw*.46:vw*.3, rowH=small?vh*.29:vh*.44, W=cols*cellW, H=rows*rowH;
    gal=[]; galRows=[];
    items.forEach((el,i)=>{
      const r=+el.dataset.r, c=i%cols, rw=Math.floor(i/cols), d=ROW_DEPTH[rw%ROW_DEPTH.length], sc=DEPTH[d][1];
      // box the photo inside its cell (max 72% of the cell either way) so rows and columns can never cross
      let w=cellW*(small?(.74+rnd(i*7+1)*.18):(.5+rnd(i*7+1)*.22))*(small?(.88+sc*.12):sc), h=w/r;
      const maxH=rowH*(small?.84:.72); if(h>maxH){ h=maxH; w=h*r; }
      const x=c*cellW+(cellW-w)*(small?(.25+rnd(i*3+2)*.5):rnd(i*3+2))-W/2+vw/2;
      const stag=small&&c===1?rowH*.5:0;
      const y=rw*rowH+stag+(rowH-h)*(small?(.3+rnd(i*5+3)*.4):(.15+rnd(i*5+3)*.7))-H/2+vh/2;
      gal.push({x,y,w,h,rot:0}); galRows.push(d);
    });
    bounds={minX:-(W/2-vw/2+vw*.08), maxX:(W/2-vw/2+vw*.08), minY:-(H/2-vh/2+vh*.12), maxY:(H/2-vh/2+vh*.12)};
  }
  function apply(list){ items.forEach((el,i)=>{ const p=list[i]; gsap.set(el,{x:p.x,y:p.y,width:p.w,height:p.h,rotation:p.rot,scale:1}); }); }

  /* ---------- render loop ---------- */
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function tick(){
    pan.tx=clamp(pan.tx,bounds.minX,bounds.maxX); pan.ty=clamp(pan.ty,bounds.minY,bounds.maxY);
    pan.x+=(pan.tx-pan.x)*.085; pan.y+=(pan.ty-pan.y)*.085;
    mouse.x+=(mouse.tx-mouse.x)*.06; mouse.y+=(mouse.ty-mouse.y)*.06;
    if(mode==='gallery'&&!busy){
      gsap.set(world,{x:0,y:0});
      items.forEach((el,i)=>{ const p=gal[i], f=DEPTH[galRows[i]][0]; gsap.set(el,{x:p.x+pan.x*f+mouse.x*(f-.78)*90, y:p.y+pan.y+mouse.y*(f-.78)*50}); });
    } else if(mode==='strip'&&!busy){
      gsap.set(world,{x:0,y:0});
      // photos near the middle are full size, the ones towards the edges ease down a little (never bigger, so nothing overlaps)
      let best=0,bd=1e9;
      const place=(el,p,row,i)=>{ const x=wrapX(p,row,pan.x), d=Math.abs(x+p.w/2-vw/2), k=1-Math.min(1,d/(vw*.7)); gsap.set(el,{x,y:p.y,scale:.92+k*.08}); if(d<bd){bd=d;best=i;} };
      items.forEach((el,i)=>place(el,strip[i],rowOf[i],i));
      clones.forEach(c=>place(c.el,c,c.row,c.i));
      const L=rowLen[0]||1, prog=((((-pan.x)%L)+L)%L)/L; bar.style.width=(prog*100)+'%'; cur.textContent=String(best+1).padStart(2,'0');
    } else gsap.set(world,{x:pan.x,y:pan.y});
    requestAnimationFrame(tick);
  }

  /* ---------- input: wheel + drag ---------- */
  let drag=null, moved=0;
  pf.addEventListener('wheel',e=>{ if(busy) return; e.preventDefault(); const d=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY); if(mode==='strip') pan.tx-=d*1.1; else { pan.ty-=e.deltaY*1.1; pan.tx-=e.deltaX*1.1; } },{passive:false});
  let downItem=null;
  pf.addEventListener('pointerdown',e=>{ if(busy||e.target.closest('.pf__ui')) return; downItem=e.target.closest('.pf__item'); drag={x:e.clientX,y:e.clientY,px:pan.tx,py:pan.ty,row:rowAtY(e.clientY),lx:e.clientX,lt:performance.now(),v:0}; moved=0; pf.setPointerCapture(e.pointerId); });
  pf.addEventListener('pointermove',e=>{ if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; moved=Math.max(moved,Math.abs(dx),Math.abs(dy));
    const now=performance.now(), dt=Math.max(1,now-drag.lt); drag.v=drag.v*.6+((e.clientX-drag.lx)/dt)*.4; drag.lx=e.clientX; drag.lt=now;
    if(mode==='strip') pan.tx=drag.px+dx*1.4; else { pan.tx=drag.px+dx; pan.ty=drag.py+dy; } });

  /* ---------- phones: after a swipe, the nearest photo in the swiped row glides to the centre and stops ---------- */
  const phone=()=>matchMedia('(max-width:900px)').matches;
  function rowAtY(y){ if(!strip.length) return 0; const y1=strip[rowOf.indexOf(1)]?.y; return (y1!==undefined && y>=y1-10)?1:0; }
  function snapStrip(row,flick){
    if(mode!=='strip'||!strip.length) return;
    const T=pan.tx+flick, sign=row===0?1:-1; let best=null;
    const look=(p,r)=>{ if(r!==row) return; const c=wrapX(p,r,T)+p.w/2, d=vw/2-c; if(best===null||Math.abs(d)<Math.abs(best)) best=d; };
    strip.forEach((p,i)=>look(p,rowOf[i])); clones.forEach(c=>look(c,c.row));
    if(best!==null) pan.tx=T+sign*best;
  }
  // pointer capture keeps the click on the canvas, so open the photo's project ourselves on a clean tap
  pf.addEventListener('pointerup',e=>{ const it=downItem, d=drag; drag=null; downItem=null;
    if(it&&moved<=6&&!busy&&e.button===0){ openProject(it); return; }
    if(d&&moved>6&&!busy&&phone()) snapStrip(d.row, Math.max(-1,Math.min(1,d.v))*260); });

  /* ---------- click: the photo comes to the centre, its siblings burst out, then the project opens ---------- */
  function openProject(it){
    if(it.classList.contains('pf__clone')){
      const orig=items[+it.dataset.src];
      gsap.set(orig,{x:gsap.getProperty(it,'x'),y:gsap.getProperty(it,'y'),width:it.offsetWidth,height:it.offsetHeight,scale:gsap.getProperty(it,'scale')});
      it=orig;
    }
    // phones: open the home straight away, no zoom
    if(phone()){ location.href=it.href; return; }
    busy=true; pf.classList.add('pf--busy');
    clones.forEach(c=>gsap.to(c.el,{opacity:0,duration:.35}));
    const href=it.href;
    if(reduce){ location.href=href; return; }
    const wx=gsap.getProperty(world,'x'), wy=gsap.getProperty(world,'y');
    items.forEach(el=>gsap.set(el,{x:gsap.getProperty(el,'x')+wx,y:gsap.getProperty(el,'y')+wy,width:el.offsetWidth,height:el.offsetHeight,scale:1}));
    gsap.set(world,{x:0,y:0}); pan.x=pan.tx=0; pan.y=pan.ty=0; bounds={minX:0,maxX:0,minY:0,maxY:0};
    const same=items.filter(e=>e!==it&&e.href===href).slice(0,6), others=items.filter(e=>e!==it&&!same.includes(e));
    const r=+it.dataset.r, W=Math.min(vw*.46,vh*.62*r), H=W/r, cx=vw/2, cy=vh/2;
    it.style.zIndex=1000; same.forEach((e,i)=>e.style.zIndex=900-i);
    const corners=[{x:-vw*.1,y:-vh*.15},{x:vw*.95,y:-vh*.1},{x:-vw*.12,y:vh*.75},{x:vw*.92,y:vh*.7},{x:vw*.4,y:-vh*.4},{x:vw*.45,y:vh*1.1}];
    const dark=document.body.classList.contains('pf-dark');
    const veil=document.createElement('div'); veil.style.cssText='position:fixed;inset:0;z-index:999;background:#fff;opacity:0;pointer-events:none'; document.body.appendChild(veil);
    const tl=gsap.timeline({onComplete:()=>{
      try{ sessionStorage.setItem('m2d-opened',JSON.stringify({left:cx-W/2,top:cy-H/2,width:W,height:H,src:it.querySelector('img').currentSrc||it.querySelector('img').src})); }catch(e){}
      location.href=href;
    }});
    tl.to(others,{opacity:0,scale:.92,duration:.45,ease:'power2.out'},0)
      // the chosen photo moves to the middle; its siblings gather in behind it
      .to(it,{x:cx-W/2,y:cy-H/2,width:W,height:H,duration:.85,ease:'power3.inOut'},0)
      .to(same,{x:cx-W*.42,y:cy-H*.42,width:W*.84,height:H*.84,opacity:1,duration:.75,ease:'power3.inOut',stagger:.04},.1);
    // explode: siblings fly off-screen and fade; the middle photo stays put
    same.forEach((e,i)=>{ const c=corners[i%corners.length]; tl.to(e,{x:c.x,y:c.y,opacity:0,duration:.9,ease:'power3.in'},.95+i*.05); });
    // page chrome fades to white underneath (the photo stays on top), so the next page continues from here
    tl.to($$('.pf__ui,.pf__hint'),{opacity:0,duration:.4},1.1);
    if(dark) tl.to(veil,{opacity:1,duration:.5},1.2);
    tl.to({},{duration:.25});
  }  pf.addEventListener('pointercancel',()=>{ drag=null; downItem=null; });
  items.forEach(el=>el.addEventListener('click',e=>e.preventDefault()));

  /* ---------- the switch: strip → stack → gallery (and back) ---------- */
  function stackTargets(){
    const w=Math.min(vw*.3, vh*.5); return items.map((el,i)=>{ const r=+el.dataset.r; const h=w/r; return {x:vw/2-w/2+(rnd(i*11)-.5)*18, y:vh/2-h/2+(rnd(i*13)-.5)*18, w, h, rot:(rnd(i*17)-.5)*10}; });
  }
  function toScreen(list){ return list.map(p=>({x:p.x+pan.x,y:p.y+pan.y,w:p.w,h:p.h,rot:p.rot})); }
  function animateTo(list,opts){
    return new Promise(res=>{
      const tl=gsap.timeline({onComplete:res});
      items.forEach((el,i)=>{ const p=list[i]; tl.to(el,{x:p.x,y:p.y,width:p.w,height:p.h,rotation:p.rot,scale:1,duration:opts.dur,ease:opts.ease},opts.stagger(i)); });
    });
  }
  async function switchMode(){
    if(busy) return; busy=true; pf.classList.add('pf--busy'); sw.disabled=true;
    const toGallery=mode==='strip';
    hideClones();
    // bake the current pan into item positions so the world can sit at 0 during the move
    const wx=gsap.getProperty(world,'x'), wy=gsap.getProperty(world,'y');
    const current=items.map(el=>({x:gsap.getProperty(el,'x')+wx, y:gsap.getProperty(el,'y')+wy, w:el.offsetWidth, h:el.offsetHeight, rot:0}));
    pan.x=pan.tx=0; pan.y=pan.ty=0; gsap.set(world,{x:0,y:0}); bounds={minX:0,maxX:0,minY:0,maxY:0};
    apply(current);
    // 1. everything gathers into one stack in the middle
    const stack=stackTargets();
    const order=items.map((_,i)=>i).sort((a,b)=>Math.abs(current[a].x+current[a].w/2-vw/2)-Math.abs(current[b].x+current[b].w/2-vw/2));
    items.forEach((el,i)=>el.style.zIndex=N-order.indexOf(i));
    await animateTo(stack,{dur:reduce?.01:.9,ease:'power3.inOut',stagger:i=>order.indexOf(i)*.012});
    if(toGallery){ document.body.classList.add('pf-dark'); pf.classList.add('pf--gallery'); mode='gallery'; swLabel.textContent=swLabel.dataset.gallery; sw.setAttribute('aria-pressed','true'); }
    else { document.body.classList.remove('pf-dark'); pf.classList.remove('pf--gallery'); mode='strip'; swLabel.textContent=swLabel.dataset.strip; sw.setAttribute('aria-pressed','false'); }
    await new Promise(r=>setTimeout(r,reduce?0:260));
    // 2. boom: burst out into the new layout
    if(toGallery) layoutGallery(); else layoutStrip();
    const target=toGallery?gal:strip.map((p,i)=>({...p,x:wrapX(p,rowOf[i],0)}));
    items.forEach((el,i)=>el.style.zIndex=1);
    await animateTo(target,{dur:reduce?.01:1.15,ease:'expo.out',stagger:i=>rnd(i*19)*.18});
    if(toGallery){ hint.classList.add('is-on'); setTimeout(()=>hint.classList.remove('is-on'),2200); clones.forEach(c=>c.el.remove()); clones=[]; }
    else showClones();
    busy=false; pf.classList.remove('pf--busy'); sw.disabled=false;
  }
  sw.addEventListener('click',switchMode);

  /* ---------- init ---------- */
  layoutStrip(); apply(strip);
  // start with both rows at their beginning
  const p0=0; pan.x=pan.tx=p0; gsap.set(world,{x:0});
  const stripAt0=strip.map((p,i)=>({...p,x:wrapX(p,rowOf[i],0)}));
  // intro: every photo small in one level row across the middle → zooms into the strip
  if(!reduce){
    busy=true; pf.classList.add('pf--busy');
    const gap=8; let hm=vh*.085; let total=items.reduce((t,el)=>t+hm*(+el.dataset.r),0)+gap*(N-1);
    if(total>vw*.94){ const k=vw*.94/total; hm*=k; total=items.reduce((t,el)=>t+hm*(+el.dataset.r),0)+gap*(N-1); }
    let x=(vw-total)/2-p0; const row=items.map(el=>{ const w=hm*(+el.dataset.r); const p={x,y:vh/2-hm/2,w,h:hm}; x+=w+gap; return p; });
    items.forEach((el,i)=>gsap.set(el,{x:row[i].x,y:row[i].y,width:row[i].w,height:row[i].h,scale:1,opacity:0}));
    const tl=gsap.timeline({delay:.2,onComplete:()=>{ busy=false; pf.classList.remove('pf--busy'); showClones(); }});
    tl.to(items,{opacity:1,duration:.5,ease:'power2.out',stagger:.012})
      .to(items,{x:i=>stripAt0[i].x,y:i=>stripAt0[i].y,width:i=>stripAt0[i].w,height:i=>stripAt0[i].h,duration:1.3,ease:'expo.inOut'},'+=.35');
  } else showClones(0);
  addEventListener('resize',()=>{ if(busy) return; if(mode==='strip'){ layoutStrip(); apply(strip); showClones(0); } else { layoutGallery(); apply(gal); } });
  requestAnimationFrame(tick);
})();
