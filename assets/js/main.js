/* M2D — site scripts (vanilla + GSAP for pinned story scroll) */
(function(){
  const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const isStatic=/[?&]static/.test(location.search); if(isStatic) document.documentElement.classList.add('static');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches||isStatic;

  /* ---------- Header ---------- */
  const header=$('.header');
  let lastY=0;
  function onScroll(){
    const y=scrollY;
    if(header){
      header.classList.toggle('is-solid',y>60);
      // the header stays put through the About opener (video expanding, then the text panel)
      const keep=document.querySelector('.about-open'), inKeep=keep&&y<keep.offsetTop+keep.offsetHeight-innerHeight*.5;
      if(inKeep) header.classList.remove('is-hidden');
      else if(y>400 && y>lastY+6) header.classList.add('is-hidden'); else if(y<lastY-6||y<400) header.classList.remove('is-hidden');
    }
    lastY=y;
  }
  addEventListener('scroll',onScroll,{passive:true}); onScroll();

  /* mobile menu */
  const menu=$('.menu'), burger=$('.burger');
  function toggleMenu(open){
    const o=open??!menu.classList.contains('is-open');
    menu.classList.toggle('is-open',o); document.body.classList.toggle('menu-open',o); document.body.classList.toggle('no-scroll',o);
  }
  burger&&burger.addEventListener('click',()=>toggleMenu());
  $('.menu__close')&&$('.menu__close').addEventListener('click',()=>toggleMenu(false));
  $$('.menu__links a').forEach(a=>a.addEventListener('click',()=>toggleMenu(false)));

  /* ---------- Preloader + hero sequence (home only) ---------- */
  const pre=$('.preloader'), hero=$('.hero');
  const video=hero&&$('video',hero);
  let wordsShown=false;
  function heroWords(){
    if(!hero||wordsShown) return; wordsShown=true;
    const shade=$('.hero__shade',hero);
    shade&&shade.classList.add('is-on');
    setTimeout(()=>{hero.classList.add('is-ready'); header&&header.classList.add('is-prelude-done');},500);
  }
  // Video plays ONCE, stops on its last frame, then the overlay darkens and the words come in.
  function playOnce(){
    if(!video){ heroWords(); return; }
    video.loop=false; video.pause(); video.playbackRate=1; // speed is baked into hero.mp4 (4s)
    try{ video.currentTime=0; }catch(e){}
    const p=video.play(); if(p&&p.catch) p.catch(()=>setTimeout(heroWords,800));
    video.addEventListener('ended',()=>heroWords(),{once:true});
    setTimeout(heroWords,9000); // safety net if the video never fires 'ended'
  }
  if(video){ video.pause(); }
  // the loading screen and opening video play once per browser tab; coming back to Home in the same tab goes straight to the finished hero
  let introSeen=false;
  if(hero){ try{ introSeen=sessionStorage.getItem('m2d-intro')==='1'; sessionStorage.setItem('m2d-intro','1'); }catch(e){} }
  if(/[?&]intro/.test(location.search)) introSeen=false;
  if(pre&&hero&&!reduce&&!introSeen){
    header&&header.classList.add('is-prelude');
    document.body.classList.add('no-scroll');
    const pieces=$$('.pl__piece img',pre), tag=$('.pl__tag',pre);
    const logo=$('.pl__logo',pre), ghosts=$$('.pl__ghost',pre).sort((x,y)=>x.dataset.n-y.dataset.n); // nearest first
    const layer=$('.pl__layer--orange',pre);
    const ease='cubic-bezier(.22,1,.36,1)', easeIO='cubic-bezier(.76,0,.24,1)';
    // 1. logo pieces stack in (M from below, 2 from above, D from below)
    requestAnimationFrame(()=>{
      pieces.forEach((im,i)=>{ im.style.transition=`transform .9s ${ease} ${i*.14}s`; im.style.transform='translateY(0)'; });
      setTimeout(()=>{ tag.style.transition=`opacity .7s ${ease}, transform .7s ${ease}`; tag.style.opacity=1; tag.style.transform='none'; },650);
    });
    // progress 00 → 100 with bar
    // 2. logo slides up-left; copies trail out behind it in a straight diagonal (no curve), then fold back
    const N=ghosts.length, DX=11, DY=26; // % of logo box per step — wide enough to read each colour
    const fan=()=>{
      logo.style.transition=`transform .8s ${easeIO}`; logo.style.transform=`translate(${-DX*N/2}%,${-DY*N/2}%)`;
      ghosts.forEach((g,i)=>{ const n=i+1; g.style.transition=`transform .85s ${easeIO} ${i*.07}s, opacity .35s ${ease} ${i*.07}s`; g.style.opacity='1'; g.style.transform=`translate(${-DX*N/2+n*DX}%,${-DY*N/2+n*DY}%)`; });
    };
    const fold=()=>{
      logo.style.transition=`transform .7s ${easeIO}`; logo.style.transform='translate(0,0)';
      ghosts.slice().reverse().forEach((g,i)=>{ g.style.transition=`transform .7s ${easeIO} ${i*.05}s, opacity .35s ${ease} ${i*.05+.3}s`; g.style.transform='translate(0,0)'; g.style.opacity='0'; });
    };
    // 3. the orange panel lifts straight up to reveal the hero
    const openUp=()=>{
      layer.style.transition=`transform 1.1s ${easeIO}`; layer.style.transform='translateY(-101%)';
      document.body.classList.remove('no-scroll');
      setTimeout(playOnce,450);
      setTimeout(()=>pre.remove(),1300);
    };
    let started=false;
    const go=()=>{ if(started) return; started=true; setTimeout(fan,1250); setTimeout(fold,2300); setTimeout(openUp,3150); };
    if(video){ if(video.readyState>=3) go(); else { video.addEventListener('canplay',go,{once:true}); setTimeout(go,2200); } } else go();
  } else {
    pre&&pre.remove();
    if(hero){
      header&&header.classList.add('is-prelude-done');
      if(reduce||introSeen){
        hero.classList.add('no-pre'); hero.classList.add('is-ready'); wordsShown=true;
        if(video){ // rest on the video's last frame, as if it had just finished playing
          video.removeAttribute('autoplay'); video.pause();
          const toEnd=()=>{ try{ video.currentTime=Math.max(0,(video.duration||0)-0.05); }catch(e){} };
          if(video.readyState>=1) toEnd(); else video.addEventListener('loadedmetadata',toEnd,{once:true});
        }
      } else playOnce();
    }
  }

  /* ---------- Give every heading / paragraph an entrance (except inside animated stages) ---------- */
  /* team photo section: text waits until the photo has risen ~75% of the screen */
  const th=$('.team-hero');
  if(th && window.gsap && window.ScrollTrigger && !reduce && !isStatic){
    gsap.registerPlugin(ScrollTrigger);
    const parts=$$('.team-hero .container > .eyebrow, .team-hero .container > h2, .team-hero .mv__item',th);
    parts.forEach(e=>e.removeAttribute('data-reveal'));
    gsap.set(parts,{opacity:0,y:34});
    const tl=gsap.timeline({paused:true}).to(parts,{opacity:1,y:0,duration:.9,ease:'power3.out',stagger:.14});
    ScrollTrigger.create({trigger:th,start:'top 25%',onEnter:()=>tl.play(),onLeaveBack:()=>tl.reverse()});
  }
  /* blog cards: each row drops in left → right (1, 2, 3) */
  const postCards=$$('.posts .post');
  if(postCards.length){
    postCards.forEach(c=>c.setAttribute('data-reveal','drop'));
    const rowDelays=()=>{ const seen={}; postCards.forEach(c=>{ if(c.offsetParent===null) return; const k=c.offsetTop; seen[k]=(seen[k]||0); c.style.transitionDelay=(seen[k]*.16)+'s'; seen[k]++; }); };
    rowDelays(); addEventListener('resize',rowDelays); addEventListener('load',rowDelays);
    document.addEventListener('click',e=>{ if(e.target.closest('.filters button')) setTimeout(rowDelays,0); });
  }
  const SKIP='.hero,.preloader,.pa,.hs,.pf,.spread,.about-open,.menu,.header,.footer,.svc,.marquee,.ig,.team-hero';
  $$('h1,h2,h3,h4,.eyebrow,.lede,.body,.statement,.credits,p,li,.stat,.link,.btn,figcaption,blockquote,dt,dd').forEach(el=>{
    if(el.closest(SKIP)||el.closest('[data-reveal]')||el.hasAttribute('data-reveal')||el.closest('[data-clip]')) return;
    if(el.matches('li,dt,dd,p')&&el.closest('.body,.article__body,.faq,.step,.credits,.spread__page,.form')) return;
    el.setAttribute('data-reveal','words');
    const sibs=[...el.parentElement.children].filter(c=>c.hasAttribute('data-reveal')); el.style.transitionDelay=(sibs.indexOf(el)*.09)+'s';
  });

  /* process steps: stagger 1,2,3,4 */
  $$('.steps').forEach(g=>[...g.querySelectorAll('.step')].forEach((st,i)=>{ st.setAttribute('data-reveal',''); st.style.transitionDelay=(i*.18)+'s'; }));

  /* instagram tiles: stagger left → right */
  $$('.ig__track .ig__item').forEach((it,i)=>{ it.style.transitionDelay=(Math.min(i,12)*.11)+'s'; });

  /* ---------- Reveal on scroll ---------- */
  // threshold 0: clip-path'd elements report a 0 intersection ratio, so a higher threshold never fires
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting || e.boundingClientRect.bottom<0){ e.target.classList.add('in'); io.unobserve(e.target);} }),{threshold:0,rootMargin:'0px 0px -8% 0px'});
  $$('[data-reveal],[data-clip]').forEach(el=>io.observe(el));

  /* counters */
  const cio=new IntersectionObserver(es=>es.forEach(e=>{
    if(!e.isIntersecting) return; cio.unobserve(e.target);
    const el=e.target, end=parseFloat(el.dataset.count), dur=2200, idx=[...document.querySelectorAll('[data-count]')].indexOf(el), t0=performance.now()+idx*180;
    const step=t=>{const k=Math.max(0,Math.min(1,(t-t0)/dur)), v=Math.round(end*(1-Math.pow(1-k,3))); el.textContent=v; if(k<1) requestAnimationFrame(step);};
    requestAnimationFrame(step);
  }),{threshold:.5});
  $$('[data-count]').forEach(el=>{ if(isStatic) el.textContent=el.dataset.count; else cio.observe(el); });

  /* ---------- Testimonial / generic sliders ---------- */
  $$('.slider').forEach(sl=>{
    const slides=$$('.slide',sl), dots=$('.slider__dots',sl); let i=0, timer;
    slides.forEach((s,k)=>{const b=document.createElement('button'); b.setAttribute('aria-label','Slide '+(k+1)); b.addEventListener('click',()=>show(k,true)); dots.appendChild(b);});
    const ds=$$('button',dots);
    function show(k,user){ i=(k+slides.length)%slides.length; slides.forEach((s,n)=>s.classList.toggle('is-active',n===i)); ds.forEach((d,n)=>d.classList.toggle('is-active',n===i)); if(user) restart(); }
    function restart(){ clearInterval(timer); timer=setInterval(()=>show(i+1),6500); }
    $('.slider__prev',sl)&&$('.slider__prev',sl).addEventListener('click',()=>show(i-1,true));
    $('.slider__next',sl)&&$('.slider__next',sl).addEventListener('click',()=>show(i+1,true));
    show(0); restart();
  });

  /* ---------- Center carousel (generic) ---------- */
  $$('.carousel').forEach(c=>{
    const track=$('.carousel__track',c), cards=$$('.tcard',c); if(!cards.length) return;
    let i=Math.min(1,cards.length-1), timer;
    const cnt=$('.carousel__count',c);
    function layout(){
      const w=cards[0].offsetWidth, gap=parseFloat(getComputedStyle(track).gap)||0;
      const center=c.offsetWidth/2 - w/2;
      track.style.transform=`translateX(${center - i*(w+gap)}px)`;
      cards.forEach((k,n)=>k.classList.toggle('is-active',n===i));
      cnt&&(cnt.textContent=String(i+1).padStart(2,'0')+' / '+String(cards.length).padStart(2,'0'));
    }
    function go(n,user){ i=(n+cards.length)%cards.length; layout(); if(user) restart(); }
    function restart(){ clearInterval(timer); if(c.dataset.auto!=='false') timer=setInterval(()=>go(i+1),4500); }
    cards.forEach((k,n)=>k.addEventListener('click',()=>{ if(n!==i) go(n,true); }));
    $('.carousel__prev',c)&&$('.carousel__prev',c).addEventListener('click',()=>go(i-1,true));
    $('.carousel__next',c)&&$('.carousel__next',c).addEventListener('click',()=>go(i+1,true));
    addEventListener('resize',layout); layout(); restart();
    c.addEventListener('mouseenter',()=>clearInterval(timer)); c.addEventListener('mouseleave',restart);
  });

  /* ---------- Team editorial: index + magazine spread ---------- */
  const teamEd=$('.team-ed');
  if(teamEd){
    const people=$$('.tp',teamEd), idx=$$('.team-ed__index span',teamEd), spread=$('.spread');
    const which=$('.team-ed__which',teamEd); let curGroup='';
    function setGroup(g){ if(g===curGroup||!which) return; curGroup=g; which.classList.add('is-swap'); setTimeout(()=>{ which.textContent=g==='core'?'core team':'creative team'; which.classList.remove('is-swap'); },260); }
    const pio=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ const n=people.indexOf(e.target); idx.forEach((s,k)=>s.classList.toggle('is-on',k===n)); setGroup(e.target.dataset.group==='core'?'core':'creative'); } }),{rootMargin:'-40% 0px -40% 0px'});
    people.forEach(p=>pio.observe(p));
    idx.forEach((s,k)=>s.addEventListener('click',()=>people[k].scrollIntoView({behavior:'smooth',block:'center'})));
    if(spread){
      const img=$('.spread__photo img',spread), t1=$('.spread__title span',spread), t2=$('.spread__title b',spread), role=$('.spread__role',spread), lede=$('.spread__lede',spread), body=$('.spread__body',spread), pg=$('.spread__foot b',spread), sig=$('.spread__photo .sig',spread);
      let cur=0, flyer=null, origin=null, busy=false;
      const easeIO='cubic-bezier(.76,0,.24,1)';
      function fill(n){
        cur=(n+people.length)%people.length; const p=people[cur], d=p.dataset;
        img.src=$('img',p).src; img.alt=d.name;
        const parts=d.name.split(' '); t1.textContent=parts[0]; t2.textContent=parts.slice(1).join(' ');
        role.innerHTML=d.role.replace(' / ','<br>'); lede.textContent=d.lede; body.innerHTML=d.bio.split('|').map(x=>'<p>'+x+'</p>').join('');
        sig.textContent=d.name+' — '+d.role;
        if(pg){ pg.textContent=String(cur+1).padStart(2,'0'); const tot=$('.spread__foot small',spread); if(tot) tot.textContent='/ '+String(people.length).padStart(2,'0'); }
        $('.spread__page',spread).scrollTop=0;
      }
      function photoBox(){ return $('.spread__photo',spread).getBoundingClientRect(); }
      // click: the portrait flies out and grows to the left half, then the page text comes in
      function open(n){
        if(busy) return; busy=true;
        fill(n);
        const src=$('img',people[cur]); origin=src.getBoundingClientRect();
        flyer=src.cloneNode(); flyer.className='spread__flyer';
        Object.assign(flyer.style,{left:origin.left+'px',top:origin.top+'px',width:origin.width+'px',height:origin.height+'px'});
        document.body.appendChild(flyer); document.body.classList.add('no-scroll');
        spread.classList.add('is-open','is-flying');
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          const t=photoBox();
          flyer.style.transition=`left 1s ${easeIO}, top 1s ${easeIO}, width 1s ${easeIO}, height 1s ${easeIO}, filter 1s`;
          Object.assign(flyer.style,{left:t.left+'px',top:t.top+'px',width:t.width+'px',height:t.height+'px',filter:'grayscale(0)'});
          setTimeout(()=>{ spread.classList.remove('is-flying'); spread.classList.add('is-in'); flyer&&flyer.remove(); flyer=null; busy=false; },1000);
        }));
      }
      // switch person inside the spread (no fly)
      function jump(n){ if(busy) return; spread.classList.remove('is-in'); setTimeout(()=>{ fill(n); spread.classList.add('is-in'); },250); }
      // close: text fades, the photo flies back to its portrait
      function close(){
        if(busy||!spread.classList.contains('is-open')) return; busy=true;
        const src=$('img',people[cur]); const o=src.getBoundingClientRect(); const t=photoBox();
        flyer=img.cloneNode(); flyer.className='spread__flyer';
        Object.assign(flyer.style,{left:t.left+'px',top:t.top+'px',width:t.width+'px',height:t.height+'px',filter:'grayscale(0)'});
        document.body.appendChild(flyer);
        spread.classList.remove('is-in'); spread.classList.add('is-flying');
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          flyer.style.transition=`left .85s ${easeIO}, top .85s ${easeIO}, width .85s ${easeIO}, height .85s ${easeIO}, filter .85s`;
          Object.assign(flyer.style,{left:o.left+'px',top:o.top+'px',width:o.width+'px',height:o.height+'px',filter:'grayscale(1)'});
          setTimeout(()=>{ spread.classList.remove('is-open','is-flying'); document.body.classList.remove('no-scroll'); flyer&&flyer.remove(); flyer=null; busy=false; },850);
        }));
      }
      people.forEach((p,n)=>{ p.addEventListener('click',()=>open(n)); p.addEventListener('keydown',e=>{ if(e.key==='Enter') open(n); }); });
      $('.spread__close',spread).addEventListener('click',close);
      $('.spread__prev',spread).addEventListener('click',()=>jump(cur-1));
      $('.spread__next',spread).addEventListener('click',()=>jump(cur+1));
      addEventListener('keydown',e=>{ if(!spread.classList.contains('is-open')) return; if(e.key==='Escape') close(); if(e.key==='ArrowRight') jump(cur+1); if(e.key==='ArrowLeft') jump(cur-1); });
    }
  }


  /* ---------- About "How we work": endless photo strip — drifts slowly, drag or swipe to move it ---------- */
  $$('[data-wk]').forEach(wk=>{
    const track=$('.wk__track',wk), orig=[...track.children]; if(!orig.length) return;
    // repeat the photos until one set is wider than the screen, then add one more full set so the loop has no seam
    for(let g=0; track.scrollWidth<innerWidth*1.3 && g<20; g++) orig.forEach(n=>{ const c=n.cloneNode(true); c.setAttribute('aria-hidden','true'); track.appendChild(c); });
    [...track.children].forEach(n=>{ const c=n.cloneNode(true); c.setAttribute('aria-hidden','true'); track.appendChild(c); });
    const gapPx=()=>parseFloat(getComputedStyle(track).columnGap)||0;
    let period=0; const measure=()=>{ const kids=track.children, half=kids.length/2; period=kids[half].offsetLeft-kids[0].offsetLeft; };
    measure(); addEventListener('resize',measure);
    let x=0, vel=0, drag=null, hover=false, inView=true, last=performance.now();
    const speed=reduce?0:.045;   // px per ms
    new IntersectionObserver(es=>{ inView=es[0].isIntersecting; },{rootMargin:'100px'}).observe(wk);
    wk.addEventListener('mouseenter',()=>hover=true); wk.addEventListener('mouseleave',()=>hover=false);
    wk.addEventListener('pointerdown',e=>{ drag={x:e.clientX,y:e.clientY,start:x,lx:e.clientX,lt:performance.now(),axis:null}; vel=0; });
    addEventListener('pointermove',e=>{
      if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      if(!drag.axis){ if(Math.abs(dx)<6&&Math.abs(dy)<6) return; drag.axis=Math.abs(dx)>Math.abs(dy)?'x':'y'; if(drag.axis==='x'){ wk.classList.add('is-drag'); try{wk.setPointerCapture(e.pointerId);}catch(_){} } }
      if(drag.axis!=='x') return;
      const now=performance.now(); vel=(e.clientX-drag.lx)/Math.max(1,now-drag.lt); drag.lx=e.clientX; drag.lt=now; x=drag.start+dx;
    });
    let dragged=false;
    const end=()=>{ if(!drag) return; dragged=drag.axis==='x'; drag=null; wk.classList.remove('is-drag'); setTimeout(()=>dragged=false,0); };
    // a drag is not a click (so swiping the videos never starts one)
    wk.addEventListener('click',e=>{ if(dragged){ e.preventDefault(); e.stopPropagation(); } },true);
    addEventListener('pointerup',end); addEventListener('pointercancel',end);
    (function loop(now){
      const dt=Math.min(50,now-last); last=now;
      if(inView&&period){
        if(!drag){ x+=vel*dt; vel*=Math.pow(.94,dt/16); if(Math.abs(vel)<.01) vel=0; if(!hover&&!wk.classList.contains('is-playing')) x-=speed*dt; }
        if(x<=-period) { x+=period; if(drag) drag.start+=period; }
        if(x>0) { x-=period; if(drag) drag.start-=period; }
        track.style.transform=`translate3d(${x}px,0,0)`;
      }
      requestAnimationFrame(loop);
    })(last);
  });

  /* ---------- About: scroll-open sequence ---------- */
  const ao=$('.about-open');
  // About opener video runs with the scroll: first frame while small, last frame the moment it has fully expanded; scrolling back rewinds it
  const aoVid=ao&&$('.ao__video',ao);
  if(aoVid){ aoVid.pause(); const prime=()=>{ const p=aoVid.play(); if(p) p.then(()=>{ aoVid.pause(); aoVid.currentTime=0; }).catch(()=>{}); }; aoVid.readyState>0?prime():aoVid.addEventListener('loadedmetadata',prime,{once:true}); }
  let aoWant=0, aoRaf=0;
  const aoSeek=()=>{ aoRaf=0; const d=aoVid.duration; if(!d||!isFinite(d)) return; const t=Math.min(d-0.04,Math.max(0,aoWant*d)); if(Math.abs(aoVid.currentTime-t)>1/60) aoVid.currentTime=t; };
  // tl: the opener timeline; expand: how long its expanding step lasts (the first step)
  const aoScrub=(tl,expand)=>{ if(!aoVid) return; tl.eventCallback('onUpdate',()=>{ aoWant=Math.min(1,Math.max(0,tl.time()/expand)); if(!aoRaf) aoRaf=requestAnimationFrame(aoSeek); }); };
  if(ao && window.gsap && window.ScrollTrigger && !reduce && !isStatic && innerWidth>900){
    gsap.registerPlugin(ScrollTrigger);
    const img=$('.ao__img',ao), panel=$('.ao__panel',ao), hints=$$('.ao__corner',ao), items=$$('.ao__panel > *',ao).filter(e=>!e.classList.contains('dots')&&!e.classList.contains('ao__hint')&&!e.classList.contains('ao__inset')), inset=$('.ao__inset',ao), label=$('.ao__label',ao);
    gsap.set(panel,{x:0,xPercent:0,y:0,yPercent:100});
    // corner words rise in on load, then fade the moment you start scrolling
    // "About us" sits on the video's bottom-right corner from the start and grows out with it; the small words fade as you scroll
    const about=$('.ao__corner--about',ao);
    gsap.to($$('.ao__corner--tag',ao),{opacity:0,y:-30,ease:'power1.out',scrollTrigger:{trigger:ao,start:'top top',end:'+=320',scrub:true}});
    const tl=gsap.timeline({scrollTrigger:{trigger:ao,start:'top top',end:()=>'bottom-='+innerHeight+' bottom',scrub:.9}});
    aoScrub(tl,1.2);
    // when the text panel comes in from the right, "About us" slides across to the left edge (mirror of its 4% right margin)
    // the small photos around the video drift out to the corners and fade as it expands
    const phs=$$('.ao__ph',ao), out=[[-1,-1],[1,-1],[-1,1],[1,1]];
    tl.to(img,{left:'0vw',top:'0vh',width:'100vw',height:'100vh',ease:'power2.inOut',duration:1.2})
      .to(phs,{x:i=>out[i%4][0]*innerWidth*.12,y:i=>out[i%4][1]*innerHeight*.12,scale:.92,opacity:0,ease:'power2.in',duration:.9},0)
      .to({},{duration:.5})
      .to(panel,{yPercent:0,ease:'power2.inOut',duration:1.1},'half')
      .to(about,{x:()=>about.offsetWidth-innerWidth*.92,ease:'power2.inOut',duration:1.1},'half')
      .from(items,{y:28,opacity:0,stagger:.08,duration:.6},'half+=.6')
      .from(inset,{y:40,duration:.6},'half+=.7')
      .to({},{duration:.4});
  }
  // phone: the same idea, zoomed in. The photo starts small in the centre, grows to fill the screen, then the text slides up over it
  else if(ao && window.gsap && window.ScrollTrigger && !reduce && !isStatic){
    gsap.registerPlugin(ScrollTrigger);
    ao.classList.add('ao--m');
    const stage=$('.ao__stage',ao), img=$('.ao__img',ao), panel=$('.ao__panel',ao), mlabel=$('.ao__label',ao), corners=$$('.ao__corner',ao), items=$$('.ao__panel > *',ao).filter(e=>!e.classList.contains('dots')&&!e.classList.contains('ao__hint'));
    gsap.set(panel,{yPercent:100});
    gsap.to($$('.ao__corner--tag',ao),{opacity:0,y:-24,ease:'power1.out',scrollTrigger:{trigger:ao,start:'top top',end:'+=220',scrub:true}});
    const tl=gsap.timeline({scrollTrigger:{trigger:ao,start:'top top',end:'bottom bottom',scrub:.8,invalidateOnRefresh:true}});
    aoScrub(tl,1.2);
    // explicit start and end values, so a resize (phone address bar) never records a half-way state as the start
    const W=()=>stage.clientWidth, H=()=>stage.clientHeight, hh=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'))||70;
    tl.fromTo(img,{left:()=>W()*.14,top:()=>H()*.25+hh()/2,width:()=>W()*.72,height:()=>H()*.5},{left:0,top:0,width:W,height:H,ease:'power2.inOut',duration:1.2})
      .to({},{duration:.35})
      .fromTo(panel,{yPercent:100},{yPercent:0,ease:'power2.inOut',duration:1},'txt')
      .fromTo(items,{y:24,opacity:0},{y:0,opacity:1,stagger:.07,duration:.5},'txt+=.45')
      .to({},{duration:.4});
  }

  /* ---------- Home: Real homes scene — centre photo grows on scroll, CTA appears, press to zoom into the portfolio ---------- */
  const rh=$('.rh');
  if(rh && window.gsap && window.ScrollTrigger && !reduce && !isStatic && innerWidth>900){
    gsap.registerPlugin(ScrollTrigger);
    const main=$('.rh__main',rh), cta=$('.rh__cta',rh), head=$('.rh__head',rh), sats=$$('.rh__sat',rh);
    gsap.from(sats,{opacity:0,y:40,duration:1.1,ease:'power3.out',stagger:.08,scrollTrigger:{trigger:rh,start:'top 70%'}});
    const tl=gsap.timeline({scrollTrigger:{trigger:rh,start:'top top',end:'bottom bottom',scrub:.8}});
    tl.to(main,{width:'100vw',height:'100vh',ease:'power2.inOut',duration:1},0)
      .to(sats,{x:i=>(i%2?1:-1)*innerWidth*.45,y:i=>(i<3?-1:1)*innerHeight*.5,opacity:0,ease:'power2.in',duration:.7,stagger:.03},0)
      .to(head,{opacity:0,y:-30,duration:.4},0)
      .to(cta,{opacity:1,duration:.3},.75);
    main.addEventListener('click',e=>{
      e.preventDefault();
      const img=$('img',main); const veil=document.createElement('div'); veil.style.cssText='position:fixed;inset:0;z-index:2000;background:#fff;opacity:0;pointer-events:none'; document.body.appendChild(veil);
      gsap.timeline({onComplete:()=>{ location.href=main.href; }})
        .to(cta,{opacity:0,duration:.3},0)
        .to(img,{scale:1.35,duration:1.1,ease:'power3.in'},0)
        .to(veil,{opacity:1,duration:.5},.65);
    });
  }

  /* ---------- Project layout A: photos spread out from behind the title card ---------- */
  // handed over from the portfolio? the chosen photo is already on screen: keep it there and slide the page in around it
  let handoff=null; try{ const v=sessionStorage.getItem('m2d-opened'); if(v){ handoff=JSON.parse(v); sessionStorage.removeItem('m2d-opened'); } }catch(e){}
  const pa=$('.pa');
  function continueFrom(target, extra){
    if(!handoff||!target||!window.gsap) return false;
    const img=target.querySelector('img')||target; if(handoff.src) img.src=handoff.src;
    const clone=document.createElement('img'); clone.src=img.src; clone.style.cssText=`position:fixed;left:${handoff.left}px;top:${handoff.top}px;width:${handoff.width}px;height:${handoff.height}px;object-fit:cover;z-index:1500;pointer-events:none`;
    document.body.appendChild(clone); gsap.set(target,{opacity:0});
    gsap.set(extra,{opacity:0});
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const t=img.getBoundingClientRect();
      gsap.timeline({onComplete:()=>{ gsap.set(target,{opacity:1}); clone.remove(); }})
        .to(clone,{left:t.left,top:t.top,width:t.width,height:t.height,duration:1,ease:'power3.inOut'},0)
        .to(extra,{opacity:1,duration:.8,ease:'power2.out',stagger:.06},.35);
    }));
    return true;
  }
  if(pa && window.gsap){
    const main=$('.pa__main',pa), side=$('.pa__side',pa), phs=$$('.pa__ph',pa);
    if(continueFrom(main,[...side.children,$('.pa__main figcaption',pa)].filter(Boolean))){
      pa.classList.add('is-in'); gsap.from(phs,{opacity:0,y:24,duration:.9,ease:'power3.out',stagger:.08,delay:.5});
    }
    else if(reduce||isStatic){ pa.classList.add('is-in'); }
    else {
      // direct open: main photo grows in the middle, the four corner photos spread out from behind it, title slides in beside
      gsap.set(side.children,{x:-30,opacity:0});
      const m=main.getBoundingClientRect(), cx=m.left+m.width/2, cy=m.top+m.height/2;
      const tl=gsap.timeline({delay:.2,onComplete:()=>pa.classList.add('is-in')});
      tl.from(main,{scale:.3,opacity:0,duration:1.3,ease:'expo.out'});
      phs.forEach((ph,i)=>{ const r=ph.getBoundingClientRect(); tl.fromTo(ph,{x:cx-(r.left+r.width/2),y:cy-(r.top+r.height/2),scale:.4,opacity:0},{x:0,y:0,scale:1,opacity:1,duration:1.4,ease:'expo.out'},.5+i*.08); });
      tl.to(side.children,{x:0,opacity:1,duration:.8,ease:'power3.out',stagger:.09},.7);
    }
  }
  if(!pa && handoff){
    const t=$('.hs__panel--img img')||$('.proj-cover img');
    if(t) continueFrom(t.closest('figure')||t,[...$$('.hs__panel--title > *, .proj-hero .container > *')]);
  }

  /* ---------- Project layout B: horizontal story (pinned) ---------- */
  const hs=$('.hs');
  if(hs && window.gsap && window.ScrollTrigger && !reduce && !isStatic && innerWidth>900){
    gsap.registerPlugin(ScrollTrigger);
    const track=$('.hs__track',hs), wrap=$('.hs__wrap',hs), bar=$('.hs__bar i',hs);
    const dist=()=>track.scrollWidth-wrap.offsetWidth;
    gsap.to(track,{x:()=>-dist(),ease:'none',scrollTrigger:{trigger:hs,start:'top top',end:()=>'+='+dist(),pin:true,scrub:.7,invalidateOnRefresh:true,anticipatePin:1,onUpdate:s=>{bar&&(bar.style.width=(s.progress*100)+'%');}}});
  }

  /* ---------- YouTube lazy ---------- */
  $$('.vid[data-yt]').forEach(v=>v.addEventListener('click',e=>{
    e.preventDefault(); const f=$('.vid__frame',v); if($('iframe',f)) return;
    const strip=v.closest('[data-wk]'); if(strip) strip.classList.add('is-playing');   // the strip holds still while a video plays
    f.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${v.dataset.yt}?autoplay=1&rel=0" title="${v.dataset.title||'Video'}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  }));

  /* ---------- Lightbox (project galleries) ---------- */
  const gal=$$('.proj-gallery figure img');
  if(gal.length){
    const lb=document.createElement('div'); lb.className='lightbox'; lb.innerHTML=`<button class="lightbox__close">Close</button><button class="lightbox__btn lightbox__prev" aria-label="Previous"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5l-7 7 7 7"/></svg></button><img alt=""><button class="lightbox__btn lightbox__next" aria-label="Next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5l7 7-7 7"/></svg></button>`;
    document.body.appendChild(lb); const im=$('img',lb); let i=0;
    const show=n=>{i=(n+gal.length)%gal.length; im.src=gal[i].src; lb.classList.add('is-open'); document.body.classList.add('no-scroll');};
    const hide=()=>{lb.classList.remove('is-open'); document.body.classList.remove('no-scroll');};
    gal.forEach((g,n)=>{g.style.cursor='zoom-in'; g.addEventListener('click',()=>show(n));});
    $('.lightbox__close',lb).addEventListener('click',hide); $('.lightbox__prev',lb).addEventListener('click',()=>show(i-1)); $('.lightbox__next',lb).addEventListener('click',()=>show(i+1));
    lb.addEventListener('click',e=>{ if(e.target===lb) hide(); });
    addEventListener('keydown',e=>{ if(!lb.classList.contains('is-open')) return; if(e.key==='Escape') hide(); if(e.key==='ArrowRight') show(i+1); if(e.key==='ArrowLeft') show(i-1); });
  }

  /* ---------- Blog filters ---------- */
  const filters=$('.filters');
  if(filters){
    const posts=$$('.posts .post[data-cat]');
    $$('button',filters).forEach(b=>b.addEventListener('click',()=>{
      $$('button',filters).forEach(x=>x.classList.remove('is-active')); b.classList.add('is-active');
      const f=b.dataset.filter; posts.forEach(p=>{ p.style.display=(f==='all'||p.dataset.cat.split(',').includes(f))?'':'none'; });
    }));
  }

  /* ---------- Contact form → emailed straight to the enquiry inbox (via FormSubmit) ---------- */
  const form=$('#enquiry');
  if(form){
    const status=$('.form__status',form), btn=$('button[type=submit]',form);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const d=new FormData(form);
      if((d.get('_honey')||'').trim()) return;   // a bot filled the hidden field
      const name=(d.get('name')||'').trim();
      btn.disabled=true; form.classList.add('is-sending');
      try{
        const r=await fetch('https://formsubmit.co/ajax/'+encodeURIComponent(form.dataset.to),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({
          _subject:'Website enquiry — '+name+' ('+d.get('property')+')', _template:'table', _captcha:'false', _replyto:d.get('email'),
          Name:name, Email:d.get('email'), Phone:d.get('phone'), Property:d.get('property'), 'How they know us':d.get('source'), Message:d.get('message')||'—', Page:location.href
        })});
        const j=await r.json().catch(()=>({}));
        if(!r.ok||String(j.success)==='false') throw new Error(j.message||'send failed');
        form.reset(); form.classList.add('is-sent');
        status.textContent=form.dataset.thanks; status.className='form__status is-ok';
      }catch(err){
        status.textContent=form.dataset.error; status.className='form__status is-err';
      }
      status.hidden=false; btn.disabled=false; form.classList.remove('is-sending');
    });
  }

  /* wrap button labels so the word can flip on hover */
  $$('.btn,.header__cta,.pa__ring').forEach(b=>{
    [...b.childNodes].forEach(n=>{ if(n.nodeType===3&&n.textContent.trim()){ const t=n.textContent.trim(); const w=document.createElement('span'); w.className='btn__t'; w.innerHTML='<span>'+t+'</span><span aria-hidden="true">'+t+'</span>'; n.replaceWith(w); } });
  });

  /* active nav */
  const path=location.pathname.replace(/index\.html$/,'');
  $$('.header__nav a').forEach(a=>{ const h=a.getAttribute('href').replace(/index\.html$/,''); if(h && (path.endsWith(h) || (h.includes('blog')&&path.includes('/blog/')) || (h.includes('portfolio')&&path.includes('/projects/')))) a.classList.add('is-active'); });
})();
