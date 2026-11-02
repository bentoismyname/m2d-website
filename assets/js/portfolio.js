/* M2D portfolio: filmstrip view ⇄ stack ⇄ scattered gallery (GSAP) */
(function(){
  const $$=(q,c=document)=>[...c.querySelectorAll(q)];
  const pf=document.querySelector('.pf'); if(!pf||!window.gsap) return;
  // coming back with the Back button restores the page mid-transition (photo centred, others gone): start fresh instead
  addEventListener('pageshow',e=>{ if(e.persisted) location.reload(); });
  const world=pf.querySelector('.pf__world'), items=[...pf.querySelectorAll('.pf__item')], sw=pf.querySelector('.pf__switch'), swLabel=pf.querySelector('.pf__sw-label');
  const bar=pf.querySelector('.pf__bar em'), cur=pf.querySelector('.pf__cur'), hint=pf.querySelector('.pf__hint');
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
  function layoutStrip(){
    vw=innerWidth; vh=innerHeight;
    const base=Math.min(vh*.32, vw*.26), gap=vw*.03, rhythm=[1,.72,1.18,.8,1,.66,1.1,.86];
    let x=vw*.5; strip=[];
    items.forEach((el,i)=>{
      const r=+el.dataset.r, h=base*rhythm[i%rhythm.length], w=h*r;
      strip.push({x:x-w/2, y:vh*.47-h/2, w, h, rot:0}); x+=w+gap;
    });
    bounds={minX:-(x-gap-vw*.5), maxX:0, minY:0, maxY:0};
  }
  // three depth bands: [parallax factor, size scale]. Rows cycle through them.
  const DEPTH=[[.55,.74],[.78,.88],[1,1]];
  const ROW_DEPTH=[2,0,1,2,1,0,2,0,1,2];
  let galRows=[];
  function layoutGallery(){
    vw=innerWidth; vh=innerHeight;
    const cols=6, rows=Math.ceil(N/cols);
    const cellW=vw*.3, rowH=vh*.44, W=cols*cellW, H=rows*rowH;
    gal=[]; galRows=[];
    items.forEach((el,i)=>{
      const r=+el.dataset.r, c=i%cols, rw=Math.floor(i/cols), d=ROW_DEPTH[rw%ROW_DEPTH.length], sc=DEPTH[d][1];
      // box the photo inside its cell (max 72% of the cell either way) so rows and columns can never cross
      let w=cellW*(.5+rnd(i*7+1)*.22)*sc, h=w/r;
      const maxH=rowH*.72; if(h>maxH){ h=maxH; w=h*r; }
      const x=c*cellW+(cellW-w)*rnd(i*3+2)-W/2+vw/2;
      const y=rw*rowH+(rowH-h)*(.15+rnd(i*5+3)*.7)-H/2+vh/2;
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
    } else gsap.set(world,{x:pan.x,y:pan.y});
    if(mode==='strip'&&!busy){
      // centre-weighted scale + progress + counter
      let best=0,bd=1e9;
      items.forEach((el,i)=>{ const p=strip[i]; const cx=p.x+p.w/2+pan.x; const d=Math.abs(cx-vw/2); const k=1-Math.min(1,d/(vw*.6)); gsap.set(el,{scale:.82+k*.36}); el.style.zIndex=Math.round(k*100); if(d<bd){bd=d;best=i;} });
      const prog=bounds.minX?pan.x/bounds.minX:0; bar.style.width=(prog*100)+'%'; cur.textContent=String(best+1).padStart(2,'0');
    }
    requestAnimationFrame(tick);
  }

  /* ---------- input: wheel + drag ---------- */
  let drag=null, moved=0;
  pf.addEventListener('wheel',e=>{ if(busy) return; e.preventDefault(); const d=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY); if(mode==='strip') pan.tx-=d*1.1; else { pan.ty-=e.deltaY*1.1; pan.tx-=e.deltaX*1.1; } },{passive:false});
  let downItem=null;
  pf.addEventListener('pointerdown',e=>{ if(busy||e.target.closest('.pf__ui')) return; downItem=e.target.closest('.pf__item'); drag={x:e.clientX,y:e.clientY,px:pan.tx,py:pan.ty}; moved=0; pf.setPointerCapture(e.pointerId); });
  pf.addEventListener('pointermove',e=>{ if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; moved=Math.max(moved,Math.abs(dx),Math.abs(dy)); if(mode==='strip') pan.tx=drag.px+dx*1.4; else { pan.tx=drag.px+dx; pan.ty=drag.py+dy; } });
  // pointer capture keeps the click on the canvas, so open the photo's project ourselves on a clean tap
  pf.addEventListener('pointerup',e=>{ const it=downItem; drag=null; downItem=null; if(it&&moved<=6&&!busy&&e.button===0){ openProject(it); } });

  /* ---------- click: the photo comes to the centre, its siblings burst out, then the project opens ---------- */
  function openProject(it){
    busy=true; pf.classList.add('pf--busy');
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
    const target=toGallery?gal:strip;
    items.forEach((el,i)=>el.style.zIndex=1);
    await animateTo(target,{dur:reduce?.01:1.15,ease:'expo.out',stagger:i=>rnd(i*19)*.18});
    if(toGallery){ hint.classList.add('is-on'); setTimeout(()=>hint.classList.remove('is-on'),2200); }
    busy=false; pf.classList.remove('pf--busy'); sw.disabled=false;
  }
  sw.addEventListener('click',switchMode);

  /* ---------- init ---------- */
  layoutStrip(); apply(strip);
  // start with the second photo centred so three are in view
  const p0=-(strip[1].x+strip[1].w/2-vw/2); pan.x=pan.tx=p0; gsap.set(world,{x:p0});
  // intro: every photo small in one level row across the middle → zooms into the strip
  if(!reduce){
    busy=true; pf.classList.add('pf--busy');
    const gap=8; let hm=vh*.085; let total=items.reduce((t,el)=>t+hm*(+el.dataset.r),0)+gap*(N-1);
    if(total>vw*.94){ const k=vw*.94/total; hm*=k; total=items.reduce((t,el)=>t+hm*(+el.dataset.r),0)+gap*(N-1); }
    let x=(vw-total)/2-p0; const row=items.map(el=>{ const w=hm*(+el.dataset.r); const p={x,y:vh/2-hm/2,w,h:hm}; x+=w+gap; return p; });
    items.forEach((el,i)=>gsap.set(el,{x:row[i].x,y:row[i].y,width:row[i].w,height:row[i].h,scale:1,opacity:0}));
    const tl=gsap.timeline({delay:.2,onComplete:()=>{ busy=false; pf.classList.remove('pf--busy'); }});
    tl.to(items,{opacity:1,duration:.5,ease:'power2.out',stagger:.012})
      .to(items,{x:i=>strip[i].x,y:i=>strip[i].y,width:i=>strip[i].w,height:i=>strip[i].h,duration:1.3,ease:'expo.inOut'},'+=.35');
  }
  addEventListener('resize',()=>{ if(busy) return; if(mode==='strip'){ layoutStrip(); apply(strip); } else { layoutGallery(); apply(gal); } });
  requestAnimationFrame(tick);
})();
