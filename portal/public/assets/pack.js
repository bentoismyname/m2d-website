/* M2D Handover Desk: shared pack content and the two customer documents.
   Used by the designer desk (index.html) and the homeowner view (view.html). */
var LOGO="/assets/m2d-logo.png", COVER="/assets/cover.jpg";
/* ---------- Pack content ---------- */
var CHECKLIST=[
 {id:"living",title:"Entrance & living areas",items:["Main door, gate and digital lock work smoothly; codes set","Flooring even, with no chips, gaps or hollow spots","Walls and ceiling evenly finished; no cracks or stains","Switches, power points and lights work as per plan","Windows and doors open, close and seal properly","Air-con units working; trunking neat","Shoe cabinet, TV console and feature walls aligned and smooth"]},
 {id:"kitchen",title:"Kitchen",items:["Countertop free of chips, scratches and stains; joints neat","Cabinets and drawers aligned; soft-close working","Sink and taps working; no leaks, under-sink area dry","Hob, hood and oven installed and working","Backsplash clean and sealed at edges","Power points, lights and switches working"]},
 {id:"bedrooms",title:"Bedrooms",items:["Wardrobe doors, drawers and hanging rods working","Wardrobe and cabinet lights working","Flooring, walls and ceiling in good condition","Switches, power points and lights work as per plan","Windows operate smoothly; air-con working"]},
 {id:"yard",title:"Service yard & laundry",items:["Washer and dryer points and taps in place","Sink and tap working; no leaks","Floor drains to the floor trap; no ponding","Power points and lights working","Storage and tall cabinets aligned"]},
 {id:"bath",title:"Bathrooms",items:["Vanity top and cabinet in good condition","Taps and shower working; good pressure and hot water","Toilet flushes and refills properly","Floor falls to the floor trap; no ponding","Floor traps clear; no chokes","Silicone joints neat and complete","Exhaust fan and lights working"]},
 {id:"util",title:"Utilities & safety",items:["Distribution board labelled; owner knows how to reset it","Water heater working; switch location shown","Main water valve located","Gas valve located (if any)","Smoke detector working (if installed)","Data points and router location shown"]},
 {id:"keys",title:"Keys & documents",items:["Keys, remotes and access cards handed over","Digital lock codes handed over","Appliance manuals and warranty cards received","Final drawings received","Debris removed and home cleaned"]}
];
var TOTAL=CHECKLIST.reduce(function(s,g){return s+g.items.length},0);
var ROLES=[["designer","M2D interior designer"],["carpentry","M2D carpentry workshop"],["electrician","Electrician"],["plumber","Plumber"],["aircon","Air-con"],["glass","Glass & aluminium"],["countertop","Countertop"],["flooring","Flooring & tiling"]];
var CFIELDS=[["name","Name"],["company","Company"],["mobile","Mobile"],["email","Email"]];
var PLACES=[["db","Distribution board (DB box)"],["heater","Water heater switch"],["water","Main water valve"],["gas","Gas valve"],["router","Router & data points"],["condenser","Air-con condensers"],["smoke","Smoke detector"],["other","Other"]];
var BATH=["Wall tiles","Floor tiles","Vanity top","Vanity cabinet laminate","Tapware & sanitary fittings"];
var DEFAULT_AREAS=[
 ["Entrance & foyer",["Wall paint","Flooring","Shoe cabinet laminate","Main door / gate"]],
 ["Living & dining",["Wall paint","Ceiling paint","Flooring","TV console laminate","Feature wall","Lighting"]],
 ["Kitchen",["Wall paint","Floor tiles","Wall tiles / backsplash","Cabinet laminate","Countertop","Handles & hardware","Sink & tap"]],
 ["Master bedroom",["Wall paint","Flooring","Wardrobe laminate","Wardrobe handles & hardware"]],
 ["Bedroom 2",["Wall paint","Flooring","Wardrobe laminate"]],
 ["Bedroom 3",["Wall paint","Flooring","Wardrobe laminate"]],
 ["Master bathroom",BATH],
 ["Common bathroom",BATH],
 ["Service yard",["Floor tiles","Wall tiles","Cabinet laminate"]]
];
function makeAreas(){return DEFAULT_AREAS.map(function(a,ai){return {id:"a"+ai,name:a[0],rows:a[1].map(function(it,ri){return {id:"a"+ai+"r"+ri,item:it,brand:"",code:""}})}})}
function rowFilled(r){return !!(r.brand||r.code)}
var FIRST30=[["Air it out","Keep windows open or fans running daily so paint, adhesive and board smells clear. Open cabinet doors for a few hours now and then."],["Let silicone cure","Avoid wetting or scrubbing new sealant joints around sinks, basins and showers for the first 48 hours."],["Go easy on new paint","Walls take a few weeks to fully harden. Don’t scrub, and wait before hanging heavy frames or using adhesive hooks."],["Load cabinets gradually","Spread heavy items across shelves and keep the heaviest low. Don’t stand or lean on open doors or drawers."],["Protect the floor","Put felt pads under furniture legs before moving in, and lift heavy pieces instead of dragging them."],["Change your codes","Reset digital lock codes and your Wi-Fi password once you’ve moved in, for your security."],["Note anything odd","Photograph any defects you spot, such as a misaligned door or a hairline crack, and send them to us together."],["File your paperwork","Keep this pack with your contract, drawings, manuals and warranty cards so they’re easy to find later."]];
var SCHEDULE=[
 ["Weekly",[["Floors","vacuum, then mop with a well-wrung mop."],["Kitchen","wipe countertops and cabinet fronts with a damp, soft cloth; dry any standing water."],["Bathrooms","squeegee shower glass and walls after use; clear hair from floor traps."]]],
 ["Monthly",[["Air-con","rinse and dry the indoor unit filters."],["Cabinets","air out wardrobes and under-sink cabinets; check for damp or mould."],["Kitchen","wash cooker hood filters; run a dishwasher clean cycle if you have one."],["Wet areas","check around toilets, sinks and showers for leaks; run water in unused floor traps."],["Safety","press the test button on smoke detectors, if installed."]]],
 ["Every 3 months",[["Air-con","general servicing by your air-con contractor."],["Hardware","tighten loose handles; vacuum drawer runners and sliding tracks."],["Electrical","press the test button on your circuit breaker (RCCB) to check it trips."]]],
 ["Every 6 months",[["Deep clean","bathrooms, kitchen, fridge and pantry."],["Doors & drawers","check alignment; adjust hinges if gaps look uneven."],["Tiles & taps","scrub grout and treat mould spots; descale aerators and shower heads."],["Windows","clean glass and tracks; check rubber seals. Replace water filters if fitted."]]],
 ["Yearly",[["Air-con","chemical wash by your air-con contractor."],["Termites & pests","professional inspection; watch for mud tubes or hollow-sounding wood."],["Sealant","replace silicone that has turned black, peeled or cracked."],["Soft furnishings","clean sofa, curtains, rugs and mattresses; touch up paint scuffs."]]]
];
var CARPENTRY=[["Laminate & board finishes","Clean with a soft cloth and mild soapy water, then wipe dry. Never use abrasive pads, scouring powder or solvents. Wipe spills straight away, especially along edges and joints where water can swell the board."],["Countertops","Quartz, sintered stone and solid surface are tough but not indestructible. Use a trivet under hot pots and a board for cutting. Avoid bleach and strong acids; wipe off oil, turmeric, wine and coffee before they stain."],["Hinges & doors","Doors can drop slightly as they settle. Most hinges have adjustment screws for side-to-side, height and depth; a quarter turn at a time is usually enough. Let soft-close doors close on their own."],["Drawers & runners","Keep loads within reason and spread evenly. Vacuum crumbs and grit from runners every few months. Don’t oil soft-close runners: it attracts dust and can damage the damper."]];
var DO=["Keep cabinets ventilated, especially wardrobes and under sinks","Dry dishes before putting them away","Use the provided shelf supports","Check under-sink pipes monthly for slow leaks"];
var AVOID=["Kettles, rice cookers or steamers right under upper cabinets","Hanging on or standing on open doors and drawers","Wet towels or laundry in wardrobes","Drilling into carpentry yourself; ask us first"];
var SURFACES=[["Vinyl & SPC flooring","Sweep or vacuum, then mop with a well-wrung mop and neutral cleaner. No flooding and no steam mops. Felt pads under furniture; mats at entrances."],["Tiles & grout","Use a pH-neutral cleaner; acid cleaners and bleach wear grout down. Scrub grout lines with a soft brush. Report hollow sounds or hairline cracks early."],["Painted walls","Dust occasionally; spot-clean marks gently with a damp cloth. Keep furniture a few centimetres off walls so air can circulate."],["Bathrooms & sinks","Run the exhaust fan after showers. Keep silicone joints dry and clean. Use hair catchers on floor traps; never pour oil down kitchen sinks."],["Electrical & lighting","Don’t overload power points with multi-plug adaptors. Switch off before replacing bulbs. If the breaker trips repeatedly, unplug appliances and call a licensed electrician."],["Glass & aluminium","Glass cleaner and a microfibre cloth for mirrors and panels. Wipe frames with soapy water and keep sliding tracks free of dirt."]];
var COVERED=["Defects in our carpentry and installation workmanship","Hinges, runners and fittings we supplied, under normal use","Work carried out by our appointed trades"];
var NOTCOVERED=["Normal wear and tear, scratches and chips from use","Damage from water, pests, misuse or overloading","Changes or repairs made by other contractors","Appliances, which carry the maker’s own warranty"];

/* ---------- Helpers ---------- */
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function $(s,r){return (r||document).querySelector(s)}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)}
function ckey(g,i){return g.id+"_"+slug(g.items[i])}
function get(obj,path){return path.split(".").reduce(function(o,k){return o&&o[k]},obj)}
function setp(obj,path,val){var ks=path.split("."),o=obj;for(var i=0;i<ks.length-1;i++){if(typeof o[ks[i]]!=="object"||!o[ks[i]])o[ks[i]]={};o=o[ks[i]]}o[ks[ks.length-1]]=val}
function clone(x){return JSON.parse(JSON.stringify(x||{}))}
function fmtDate(s){if(!s)return "";var d=new Date(s+"T00:00:00");if(isNaN(d))return s;return d.toLocaleDateString("en-SG",{day:"numeric",month:"short",year:"numeric"})}
function uid(){return "h"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function toast(msg){var t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove()},2600)}
function doneCount(h){var c=h.checks||{},n=0;CHECKLIST.forEach(function(g){g.items.forEach(function(_,i){if(c[ckey(g,i)])n++})});return n}
function openDefects(h){return (h.defects||[]).filter(function(d){return d.text&&!d.done}).length}

var BK_CSS=
'.bk{--o:#D9731F;--oi:#A4500E;--k:#2B2A28;--m:#4A4846;--l:#D9D4CE;--s:#F7F2EC;font-family:Poppins,system-ui,sans-serif;color:var(--k);font-size:13px;line-height:1.55}'+
'.bk *{box-sizing:border-box}'+
'.bk .pg{width:794px;min-height:1123px;background:#fff;padding:64px 68px 56px;display:flex;flex-direction:column;gap:18px;position:relative;margin:0 auto 24px;box-shadow:0 1px 4px rgba(0,0,0,.12)}'+
'.bk h1,.bk h2,.bk h3{font-family:"Open Sans","Arial Narrow",sans-serif;font-stretch:75%;margin:0;font-weight:500;text-wrap:balance}'+
'.bk h2{font-size:46px;line-height:1.05;color:var(--o)}'+
'.bk h3{font-size:19px;font-weight:600}'+
'.bk p{margin:0}'+
'.bk .ey{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--oi);font-weight:500}'+
'.bk .mut{color:var(--m)}'+
'.bk .g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 30px}'+
'.bk .g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 22px}'+
'.bk .blk{display:flex;flex-direction:column;gap:6px;border-top:2px solid var(--o);padding-top:10px}'+
'.bk .blk.k{border-top-color:var(--k)}'+
'.bk .row{display:flex;gap:9px;align-items:flex-start;font-size:12px;line-height:1.45}'+
'.bk .bx{flex-shrink:0;width:12px;height:12px;border:1.5px solid var(--k);margin-top:2px;display:grid;place-content:center}'+
'.bk .bx.on{background:var(--k)}.bk .bx.on::after{content:"";width:6px;height:3px;border:1.5px solid #fff;border-top:0;border-right:0;transform:translateY(-1px) rotate(-45deg)}'+
'.bk .tbl{width:100%;border-collapse:collapse;font-size:12.5px}'+
'.bk .tbl th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--m);text-align:left;font-weight:500;padding:6px 8px 6px 0;border-bottom:1px solid var(--k)}'+
'.bk .tbl td{padding:8px 8px 8px 0;border-bottom:1px solid var(--l);vertical-align:top}'+
'.bk .soft{background:var(--s);padding:18px 20px;display:flex;flex-direction:column;gap:6px}'+
'.bk .ft{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--m)}'+
'.bk .ft img{height:14px;width:auto}'+
'.bk .cov{padding:0;gap:0}'+
'.bk .cov .top{padding:60px 68px 0;display:flex;flex-direction:column;gap:16px}'+
'.bk .cov .top img{width:280px;height:auto}'+
'.bk .cov .ttl{font-family:"Open Sans","Arial Narrow",sans-serif;font-stretch:75%;font-size:38px;color:var(--m);line-height:1}'+
'.bk .cov .who{padding:34px 68px 36px;display:flex;flex-direction:column;gap:10px}'+
'.bk .cov .who h1{font-size:42px;line-height:1.08;color:var(--o)}'+
'.bk .cov .ph{flex:1;min-height:420px;background-size:cover;background-position:center}'+
'.bk .cov .bot{height:60px;padding:0 36px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--m)}'+
'.bk .sched{display:grid;grid-template-columns:130px minmax(0,1fr);gap:18px;padding:12px 0;border-top:1px solid var(--k)}'+
'.bk .sched .w{font-family:"Open Sans","Arial Narrow",sans-serif;font-stretch:75%;font-weight:600;font-size:20px;color:var(--o)}'+
'.bk .dark{background:var(--k);color:#F5F1EC;padding:24px 28px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}'+
'.bk .dark .ct{text-align:right;font-size:13px;line-height:1.6}'+
'.bk .kv{display:grid;grid-template-columns:200px minmax(0,1fr);gap:4px 16px;font-size:12.5px}'+
'.bk .kv div:nth-child(odd){color:var(--m)}'+
'.bk .card2{border-top:1px solid var(--k);padding-top:10px;display:flex;flex-direction:column;gap:2px;font-size:12.5px}'+
'.bk .card2 .r{font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;margin-bottom:4px}'+
'.bk *{-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
'@media print{.bk .pg{box-shadow:none;margin:0;break-after:page;min-height:297mm;height:auto;width:210mm;overflow:visible}body{margin:0}@page{size:A4;margin:0}}';

function docKit(h,s,label){
  var page=0;
  return {
    ft:function(){page++;return '<div class="ft"><img src="'+LOGO+'" alt="M2D"><span>'+label+' · '+(page<10?"0":"")+page+'</span></div>'},
    skip:function(){page++},
    bx:function(on){return '<span class="bx'+(on?" on":"")+'"></span>'}
  };
}

/* Part 1: Handover record — checklist, defects, sign-off */
function handoverDoc(h,s){
  h=h||{};s=s||{};
  var c=h.customer||{}, web=s.website||"www.m2decor.com.sg", K=docKit(h,s,"Handover Record"), ck=h.checks||{};
  var out='';
  out+='<section class="pg"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px"><img src="'+LOGO+'" alt="M2D" style="width:170px;height:auto"><div style="text-align:right;font-size:12px" class="mut">'+esc(web)+'</div></div>';
  out+='<div class="ey" style="margin-top:10px">Handover record</div><h2>Handover checklist</h2>';
  out+='<div class="kv">'+[["Homeowner",c.name],["Property",c.address],["Handover date",fmtDate(h.handoverDate)],["M2D designer",h.designer]].filter(function(r){return r[1]}).map(function(r){return '<div>'+esc(r[0])+'</div><div>'+esc(r[1])+'</div>'}).join("")+'</div>';
  out+='<p class="mut">We walked through your home together. Items ticked were checked and working at handover.</p><div class="g3">';
  CHECKLIST.forEach(function(g){out+='<div class="blk"><h3>'+esc(g.title)+'</h3>'+g.items.map(function(it,i){return '<div class="row">'+K.bx(ck[ckey(g,i)])+'<span>'+esc(it)+'</span></div>'}).join("")+'</div>'});
  out+='</div>'+K.ft()+'</section>';
  var defs=(h.defects||[]).filter(function(d){return d.text}), so=h.signoff||{};
  out+='<section class="pg"><div class="ey">Handover record</div><h2>Defects &amp; follow-ups</h2>';
  out+=defs.length?'<p class="mut">These items will be followed up after handover. Your designer will keep you updated on each one.</p><table class="tbl"><thead><tr><th style="width:30px">#</th><th>Item &amp; location</th><th style="width:150px">Action by</th><th style="width:60px">Done</th></tr></thead><tbody>'+defs.map(function(d,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(d.text)+'</td><td>'+esc(d.by||"")+'</td><td>'+K.bx(d.done)+'</td></tr>'}).join("")+'</tbody></table>':'<p class="mut">No defects were noted at handover.</p>';
  out+='<div class="soft" style="margin-top:14px"><h3>Sign-off</h3><span class="mut">Walked through and handed over, subject to any defects listed above.</span><div class="g3" style="margin-top:10px">'+[["Homeowner",so.homeowner],["M2D representative",so.rep],["Date",fmtDate(so.date)]].map(function(r){return '<div><div style="border-bottom:1px solid #2B2A28;min-height:30px;font-size:14px">'+esc(r[1]||"")+'</div><div class="mut" style="font-size:11px;margin-top:4px">'+r[0]+'</div></div>'}).join("")+'</div></div>';
  out+='<p class="mut" style="margin-top:6px">Questions about any item? Contact us'+((s.phone||s.email)?' at '+esc([s.phone,s.email].filter(Boolean).join(" or ")):'')+'.</p>'+K.ft()+'</section>';
  return '<div class="bk">'+out+'</div>';
}

/* Part 2: Home care pack — contacts, quick reference, finishes by area, maintenance, care */
function careDoc(h,s){
  h=h||{};s=s||{};
  var c=h.customer||{}, name=c.name||"Your home", web=s.website||"www.m2decor.com.sg", K=docKit(h,s,"Home Care Pack");
  var ct=h.contacts||{}, pl=h.places||{};
  var out='';
  K.skip();
  out+='<section class="pg cov"><div class="top"><img src="'+LOGO+'" alt="M2D"><div class="ttl">HOME CARE PACK</div></div><div class="who"><h1>Your home is ready. Here’s how to keep it that way.</h1><p class="mut">Prepared for <strong style="color:#2B2A28">'+esc(name)+'</strong>'+(c.address?' · '+esc(c.address):'')+'</p></div><div class="ph" style="background-image:url('+COVER+')" role="img" aria-label="Kitchen designed by M2D"></div><div class="bot"><span>'+esc(web)+'</span><span>'+(h.handoverDate?'Handover date: '+esc(fmtDate(h.handoverDate)):'')+'</span></div></section>';
  out+='<section class="pg"><h2>Welcome home'+(c.name?', '+esc(c.name):'')+'.</h2><p class="mut" style="font-size:14px;max-width:600px">Thank you for trusting M2D with your home. This pack keeps your project details in one place: who worked on your home, where things are, the exact finishes we used, and a simple guide to looking after it all.</p>';
  out+='<div class="kv" style="margin-top:8px">'+[["Property",c.address],["Handover date",fmtDate(h.handoverDate)],["Your M2D designer",h.designer],["Warranty",s.warranty?s.warranty+" from handover":""]].filter(function(r){return r[1]}).map(function(r){return '<div>'+esc(r[0])+'</div><div>'+esc(r[1])+'</div>'}).join("")+'</div>';
  out+='<h3 style="font-size:28px;color:#D9731F;font-weight:500;margin-top:14px">In this pack</h3><table class="tbl"><tbody>'+["Project contacts","Home quick reference","Material finishes","Maintenance schedule","Your first 30 days","Carpentry & cabinetry care","Floors, walls & wet areas","Warranty & after-care"].map(function(t,i){return '<tr><td style="width:44px;color:#D9731F;font-family:Open Sans,sans-serif;font-stretch:75%;font-size:18px">0'+(i+1)+'</td><td style="font-size:14px">'+esc(t)+'</td></tr>'}).join("")+'</tbody></table>'+K.ft()+'</section>';
  // Contacts + quick reference
  var used=ROLES.filter(function(r){var x=ct[r[0]]||{};return x.name||x.company||x.mobile||x.email});
  out+='<section class="pg"><div class="ey">01 · Who did what</div><h2>Project contacts</h2><p class="mut">For anything covered by your warranty, contact your M2D designer first. We’ll coordinate the right trade for you.</p>';
  out+=used.length?'<div class="g2">'+used.map(function(r){var x=ct[r[0]];return '<div class="card2"><div class="r">'+esc(r[1])+'</div>'+[x.name,x.company,x.mobile,x.email].filter(Boolean).map(function(v){return '<div>'+esc(v)+'</div>'}).join("")+'</div>'}).join("")+'</div>':'<p class="mut">Contact M2D for any follow-up: '+esc([s.phone,s.email].filter(Boolean).join(" · ")||web)+'</p>';
  var plUsed=PLACES.filter(function(p){return pl[p[0]]});
  out+='<div class="ey" style="margin-top:18px">02 · Keep for later</div><h2>Home quick reference</h2>';
  out+=plUsed.length?'<p class="mut">Where things are in your home.</p><div class="kv">'+plUsed.map(function(p){return '<div>'+esc(p[1])+'</div><div>'+esc(pl[p[0]])+'</div>'}).join("")+'</div>':'<p class="mut">Ask your designer to show you the distribution board, water heater switch and main water valve.</p>';
  out+=K.ft()+'</section>';
  // Finishes by area
  var areas=(h.finishAreas||[]).map(function(a){return {name:a.name,rows:a.rows.filter(rowFilled)}}).filter(function(a){return a.rows.length});
  out+='<section class="pg"><div class="ey">03 · Match it later</div><h2>Material finishes</h2><p class="mut">The exact finishes used in each part of your home. Quote these codes when buying touch-up paint, replacing a tile or adding matching carpentry.</p>';
  out+=areas.length?'<div class="g2" style="align-items:start">'+areas.map(function(a){return '<div class="blk"><h3>'+esc(a.name)+'</h3><table class="tbl"><tbody>'+a.rows.map(function(r){return '<tr><td style="width:42%;font-weight:500">'+esc(r.item||"Item")+'</td><td>'+esc(r.brand||"")+(r.brand&&r.code?'<br>':'')+'<span class="mut">'+esc(r.code||"")+'</span></td></tr>'}).join("")+'</tbody></table></div>'}).join("")+'</div>':'<p class="mut">Ask your designer for the brand and colour codes of your finishes.</p>';
  out+=K.ft()+'</section>';
  // Schedule
  out+='<section class="pg"><div class="ey">04 · Year-round</div><h2>Maintenance schedule</h2><p class="mut">A few minutes here and there prevents most of the problems we get called back for. Tick each one off as you go.</p><div>'+SCHEDULE.map(function(g){return '<div class="sched"><div class="w">'+esc(g[0])+'</div><div style="display:flex;flex-direction:column;gap:6px">'+g[1].map(function(t){return '<div class="row">'+K.bx(false)+'<span><strong>'+esc(t[0])+'</strong>: '+esc(t[1])+'</span></div>'}).join("")+'</div></div>'}).join("")+'<div style="border-top:1px solid #2B2A28"></div></div>'+K.ft()+'</section>';
  // First 30 days
  out+='<section class="pg"><div class="ey">05 · Settling in</div><h2>Your first 30 days</h2><p class="mut">New materials are still settling in. These habits matter most right now.</p><div class="g2">'+FIRST30.map(function(x){return '<div class="blk"><h3>'+esc(x[0])+'</h3><p class="mut">'+esc(x[1])+'</p></div>'}).join("")+'</div><div class="soft"><h3>Living in Singapore’s humidity</h3><p class="mut">Moisture is the biggest enemy of carpentry and wet areas. Ventilate daily, run the air-con or a dehumidifier when the home is closed up for long periods, and never leave wet items inside cabinets.</p></div>'+K.ft()+'</section>';
  // Care
  out+='<section class="pg"><div class="ey">06 · Built by our workshop</div><h2>Carpentry &amp; cabinetry</h2><div class="g2">'+CARPENTRY.map(function(x){return '<div class="blk k"><h3>'+esc(x[0])+'</h3><p class="mut">'+esc(x[1])+'</p></div>'}).join("")+'</div><div class="g2"><div class="soft"><h3 style="color:#A4500E">Do</h3>'+DO.map(function(x){return '<div>'+esc(x)+'</div>'}).join("")+'</div><div class="soft"><h3>Avoid</h3>'+AVOID.map(function(x){return '<div>'+esc(x)+'</div>'}).join("")+'</div></div><p class="mut"><strong style="color:#2B2A28">Swelling, peeling edges or a musty smell</strong> are early signs of moisture getting in. Dry the area, keep it ventilated and tell us early.</p>'+K.ft()+'</section>';
  out+='<section class="pg"><div class="ey">07 · Around the home</div><h2>Floors, walls &amp; wet areas</h2><div class="g2">'+SURFACES.map(function(x){return '<div class="blk k"><h3>'+esc(x[0])+'</h3><p class="mut">'+esc(x[1])+'</p></div>'}).join("")+'</div><div class="soft"><h3>Leaks: act fast</h3><div class="g3"><div><strong style="color:#A4500E">1.</strong> Turn off the water at the nearest isolation valve, or the main valve'+(pl.water?' ('+esc(pl.water)+')':'')+'.</div><div><strong style="color:#A4500E">2.</strong> Dry the area and clear things out of affected cabinets.</div><div><strong style="color:#A4500E">3.</strong> Take photos and contact us or a plumber the same day.</div></div></div>'+K.ft()+'</section>';
  // Warranty
  out+='<section class="pg"><div class="ey">08 · We’ve got you</div><h2>Warranty &amp; after-care</h2><p class="mut" style="font-size:14px">'+(s.warranty?'Your workmanship warranty runs for <strong style="color:#2B2A28">'+esc(s.warranty)+'</strong> from your handover date'+(h.handoverDate?' ('+esc(fmtDate(h.handoverDate))+')':'')+'.':'Your workmanship warranty starts from your handover date.')+' Full terms are in your contract.</p><div class="g2"><div class="blk"><h3>Usually covered</h3>'+COVERED.map(function(x){return '<div class="mut">'+esc(x)+'</div>'}).join("")+'</div><div class="blk k"><h3>Usually not covered</h3>'+NOTCOVERED.map(function(x){return '<div class="mut">'+esc(x)+'</div>'}).join("")+'</div></div><div class="card2"><h3>Requesting a service visit</h3><div class="g3" style="margin-top:6px"><div><strong style="color:#D9731F;font-size:20px">1</strong><br>Take clear photos or a short video of the issue.</div><div><strong style="color:#D9731F;font-size:20px">2</strong><br>Send them with your name, address and handover date.</div><div><strong style="color:#D9731F;font-size:20px">3</strong><br>We’ll reply with next steps and arrange a visit if needed.</div></div></div><div class="card2"><h3>Keep these together</h3><div class="g2" style="gap:4px 30px;margin-top:4px"><div class="mut">Your contract and quotation</div><div class="mut">Final layout and carpentry drawings</div><div class="mut">Appliance manuals and warranty cards</div><div class="mut">Your handover record and this pack</div></div></div><div class="dark" style="margin-top:auto"><div><h3 style="font-size:24px;font-weight:600">Thank you for building<br>your home with us.</h3><div style="font-size:12px;color:#CFC9C2;margin-top:6px">M2D Interior Design &amp; Consultancy</div></div><div class="ct">'+[s.phone,s.email,web].filter(Boolean).map(esc).join("<br>")+'</div></div>'+K.ft()+'</section>';
  return '<div class="bk">'+out+'</div>';
}
