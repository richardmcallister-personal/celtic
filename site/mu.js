// Shared bits for the Celtic pages (forked from manutd.wiki by way of irelandfootball).
window.MU=(function(){
  var TEAM=247;
  var NAV=[["/","Hub"],["/season/","Season"],["/squad/","Squad"],["/results/","Results"],["/seasons/","Seasons"],["/players/","Players"],["/opponents/","Opponents"],["/records/","Records"],["/managers/","Managers"],["/honours/","Honours"],["/kits/","Kits"]];
  // Wide tables scroll sideways on narrow screens instead of being clipped: every table.mu gets a scroll wrapper, including ones rendered later.
  function wrapTables(root){(root||document).querySelectorAll("table.mu").forEach(function(t){if(t.parentElement&&t.parentElement.classList.contains("tw"))return; var w=document.createElement("div"); w.className="tw"; t.parentNode.insertBefore(w,t); w.appendChild(t)})}
  if(window.MutationObserver){new MutationObserver(function(ms){var hit=false; ms.forEach(function(m){if(m.addedNodes.length)hit=true}); if(hit)wrapTables()}).observe(document.documentElement,{childList:true,subtree:true})}
  document.addEventListener("DOMContentLoaded",function(){wrapTables()});
  // Installed app: a short crest splash on the first page of a session, carrying on from the iOS launch image.
  (function(){try{var sa=window.navigator.standalone===true||matchMedia("(display-mode: standalone)").matches; if(!sa||sessionStorage.getItem("mu:splash"))return; sessionStorage.setItem("mu:splash","1");
    var d=document.createElement("div"); d.className="splash"; d.innerHTML='<img src="/assets/crest.png" alt="">'; (document.body||document.documentElement).appendChild(d);
    setTimeout(function(){d.classList.add("out"); setTimeout(function(){d.remove()},500)},900)}catch(e){}})();
  // Appearance: auto (device) / light / dark, remembered on this device; the switch sits in the footer of every page.
  function theme(mode){try{if(mode==="auto")localStorage.removeItem("mu:theme"); else localStorage.setItem("mu:theme",mode)}catch(e){} if(mode==="auto")document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme",mode);
    var m=document.querySelector('meta[name="theme-color"]'); if(m)m.setAttribute("content",getComputedStyle(document.documentElement).getPropertyValue("--red").trim()||"#0b6e4f");
    document.querySelectorAll(".themesw button").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.m===mode)})}
  (function(){try{var t=localStorage.getItem("mu:theme"); if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})();
  function themeSwitch(){var f=document.querySelector("footer.mu"); if(!f||f.querySelector(".themesw"))return; var cur="auto"; try{cur=localStorage.getItem("mu:theme")||"auto"}catch(e){}
    var d=document.createElement("span"); d.className="themesw"; d.setAttribute("role","group"); d.setAttribute("aria-label","Appearance"); d.innerHTML=["auto","light","dark"].map(function(m){return '<button type="button" data-m="'+m+'" aria-pressed="'+(m===cur)+'">'+m+'</button>'}).join("");
    d.addEventListener("click",function(e){var b=e.target.closest("button"); if(b)theme(b.dataset.m)}); f.appendChild(document.createTextNode(" Appearance:")); f.appendChild(d)}
  document.addEventListener("DOMContentLoaded",themeSwitch);
  // Cookie consent for analytics (Consent Mode v2). Nothing is stored or sent to Google until "Accept"; "No thanks" keeps
  // the denied default and remembers that. A "Cookies" control in the footer reopens the choice.
  function consentGet(){try{return localStorage.getItem("mu:consent")||""}catch(e){return ""}}
  function consentSet(v){try{localStorage.setItem("mu:consent",v)}catch(e){} if(window.gtag)gtag("consent","update",{analytics_storage:v==="granted"?"granted":"denied"}); var b=document.getElementById("consent"); if(b)b.remove()}
  function consentBar(){if(document.getElementById("consent"))return; var d=document.createElement("div"); d.id="consent"; d.className="consent"; d.setAttribute("role","region"); d.setAttribute("aria-label","Cookies");
    d.innerHTML='<p>This site uses Google Analytics to count visits. No ads, nothing personal — just which pages get read. <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener">How Google uses the data</a>.</p><div class="acts"><button type="button" class="btn" data-c="granted">Accept</button><button type="button" class="btn ghost" data-c="denied">No thanks</button></div>';
    d.addEventListener("click",function(e){var b=e.target.closest("button"); if(b)consentSet(b.dataset.c)}); document.body.appendChild(d)}
  var EEA="AT,BE,BG,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,RO,SK,SI,ES,SE,IS,LI,NO,GB,CH".split(",");
  function consentNeeded(){var m=document.querySelector('meta[name="mu-country"]'), cc=m?m.content:""; return !cc||EEA.indexOf(cc)>=0}
  // No analytics yet, so no consent bar. When a GA4 property exists: add the tag to the pages and restore this from manutd.wiki.

  function nav(active){
    var el=document.querySelector("nav.munav"); if(!el)return;
    document.querySelectorAll("header.mu h1 br").forEach(function(br){br.replaceWith(" ")});   // the wordmark sits on one line now
    el.innerHTML=NAV.map(function(n){return '<a href="'+n[0]+'"'+(n[1]===active?' aria-current="page"':'')+'>'+n[1]+'</a>'}).join("")+'<form class="musearch" role="search" action="/search/"><input type="search" name="q" placeholder="Search players, opponents, managers…" aria-label="Search the site" autocomplete="off"><div class="hits" hidden></div></form>';
    searchBox(el.querySelector(".musearch"));
    // phone tab bar: five destinations, the current one lit
    var TABS=[["/","Match",'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',["Hub"]],["/season/","Season",'<path d="M4 6h16M4 12h16M4 18h10"/>',["Season"]],["/results/","Results",'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',["Results"]],["/players/","Players",'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>',["Players","Squad"]],["/#more","More",'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',["Opponents","Records","Managers","Kits","Honours","Seasons"]]];
    var old=document.querySelector("nav.mutabs"); if(old)old.remove();
    var t=document.createElement("nav"); t.className="mutabs"; t.setAttribute("aria-label","Sections");
    t.innerHTML=TABS.map(function(x){return '<a href="'+x[0]+'"'+(x[3].indexOf(active)>=0?' aria-current="page"':'')+'><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+x[2]+'</svg>'+x[1]+'</a>'}).join("");
    document.body.appendChild(t);
  }
  // ---- Site search: /search.json is [title, kind, url, subtitle, aliases]; loaded on first keystroke, matched client-side.
  var IDX=null, GROUP={player:"Players",manager:"Managers",club:"Opponents",season:"Decades",match:"Matches",kit:"Kits",ground:"Grounds",book:"Media",doc:"Media",film:"Media",pod:"Media",page:"Sections"}, GORDER=["Players","Managers","Opponents","Decades","Matches","Media","Kits","Grounds","Sections"], KIND={player:"Player",manager:"Manager",club:"Opponent",season:"Decade",kit:"Kit",ground:"Ground",book:"Book",doc:"Documentary",film:"Film",pod:"Podcast",match:"Match",page:"Section"};
  function fold(t){return String(t||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/æ/g,"ae").replace(/ø/g,"o").replace(/ß/g,"ss").replace(/[đð]/g,"d").replace(/ł/g,"l").replace(/þ/g,"th").replace(/[’']/g,"").replace(/[–—]/g,"-")}
  function loadIndex(){return IDX||(IDX=fetch("/search.json").then(function(r){return r.json()}).then(function(j){return j.map(function(e){return {t:e[0],k:e[1],u:e[2],s:e[3]||"",a:e[4]||[],f:fold(e[0]),fa:(e[4]||[]).map(fold),fs:fold(e[3]||"")}})}))}
  function search(q,n){
    var terms=fold(q).split(/\s+/).filter(Boolean); if(!terms.length)return Promise.resolve([]);
    return loadIndex().then(function(ix){
      var out=[];
      ix.forEach(function(e){
        var sc=0;
        for(var i=0;i<terms.length;i++){var t=terms[i], w=0;
          if(e.f===t)w=100; else if(e.f.split(/[\s,]+/).indexOf(t)>=0)w=70; else if(e.f.indexOf(t)===0)w=60; else if(e.f.indexOf(" "+t)>=0)w=50; else if(e.f.indexOf(t)>=0)w=30;
          else if(e.fa.some(function(a){return a===t}))w=80; else if(e.fa.some(function(a){return a.indexOf(t)>=0}))w=35;
          else if(e.fs.indexOf(t)>=0)w=10;
          if(!w){sc=0;break} sc+=w}
        if(sc){ var person=e.k==="player"||e.k==="manager";
          // a person's surname typed on its own is as good as an exact title ("rooney" → Wayne Rooney before the documentary)
          if(person&&terms.length===1&&e.f.split(/[\s,]+/).indexOf(terms[0])>=0)sc=Math.max(sc,100);
          if(person)sc+=35; else if(e.k==="club")sc+=15; else if(e.k==="season"||e.k==="ground")sc+=8; else if(e.k==="kit")sc-=8; else if(/^(book|doc|film|pod)$/.test(e.k))sc-=10;
          out.push({e:e,sc:sc}) }
      });
      out.sort(function(a,b){return b.sc-a.sc||a.e.t.length-b.e.t.length||a.e.t.localeCompare(b.e.t)});
      return out.slice(0,n||8).map(function(x){return x.e});
    });
  }
  function hit(e,q){var re=q?new RegExp("("+fold(q).split(/\s+/).filter(Boolean).map(function(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}).join("|")+")","ig"):null;
    var t=esc(e.t); if(re)t=t.replace(re,"<mark>$1</mark>");
    return '<a href="'+e.u+'"><span class="k">'+(KIND[e.k]||e.k)+'</span><span class="t">'+t+(e.s?'<small>'+esc(e.s)+'</small>':'')+'</span></a>'}
  function searchBox(form){
    if(!form)return; var inp=form.querySelector("input"), box=form.querySelector(".hits"), sel=-1, last="";
    function render(list,q){box.innerHTML=list.map(function(e){return hit(e,q)}).join("")+(list.length?'<a class="all" href="/search/?q='+encodeURIComponent(q)+'">All results for “'+esc(q)+'” →</a>':'<span class="none">Nothing matches “'+esc(q)+'”</span>'); box.hidden=false; sel=-1}
    inp.addEventListener("input",function(){var q=inp.value.trim(); last=q; if(q.length<2){box.hidden=true;return} search(q,8).then(function(l){if(q===last)render(l,q)})});
    inp.addEventListener("focus",function(){if(inp.value.trim().length>=2&&box.innerHTML)box.hidden=false});
    inp.addEventListener("keydown",function(ev){var as=box.querySelectorAll("a"); if(ev.key==="ArrowDown"||ev.key==="ArrowUp"){ev.preventDefault(); if(!as.length)return; sel=(sel+(ev.key==="ArrowDown"?1:-1)+as.length)%as.length; as.forEach(function(a,i){a.classList.toggle("sel",i===sel)}); as[sel].scrollIntoView({block:"nearest"})}
      else if(ev.key==="Enter"&&sel>=0&&as[sel]){ev.preventDefault(); location.href=as[sel].href} else if(ev.key==="Escape"){box.hidden=true}});
    box.addEventListener("keydown",function(ev){if(ev.key==="Escape"){ev.preventDefault(); inp.focus(); box.hidden=true}});   // Escape from a focused suggestion closes the list and returns to the field
    form.addEventListener("focusout",function(){setTimeout(function(){if(!form.contains(document.activeElement))box.hidden=true},0)});   // tabbing out of the form closes it
    var live=document.createElement("div"); live.className="sr"; live.setAttribute("role","status"); live.setAttribute("aria-live","polite"); form.appendChild(live);
    var _render=render; render=function(list,q){_render(list,q); live.textContent=list.length?list.length+" suggestion"+(list.length===1?"":"s")+" for "+q:"No matches for "+q};
    document.addEventListener("click",function(ev){if(!form.contains(ev.target))box.hidden=true});
    document.addEventListener("keydown",function(ev){if(ev.key==="/"&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){ev.preventDefault(); inp.focus()}});
  }
  // GET /api/<name>?..., cached in sessionStorage for 30 min so page hops don't re-hit the Worker.
  function api(name,params){
    params=Object.assign({},params||{},{v:"4"});   // bumps the URL so browsers drop copies cached by earlier Worker builds
    var q="?"+Object.keys(params).map(function(k){return k+"="+encodeURIComponent(params[k])}).join("&");
    var url="/api/"+name+q, key="mu:"+url;
    try{var c=JSON.parse(sessionStorage.getItem(key)||"null"); if(c&&Date.now()-c.t<18e5)return Promise.resolve(c.v)}catch(e){}
    if(api._inflight[url])return api._inflight[url];
    return api._inflight[url]=fetch(url).then(function(r){var age=parseInt(r.headers.get("x-age")||"0",10)||0; return r.text().then(function(t){var j=JSON.parse(t.replace(/&apos;/g,"'")); if(j&&typeof j==="object")j._fetched=Date.now()-age*1000; return j})}).then(function(j){
      if(j.errors&&Object.keys(j.errors).length){var e=new Error(JSON.stringify(j.errors)); e.api=true; throw e}
      if(j.message)throw Object.assign(new Error(j.message),{api:true});
      try{sessionStorage.setItem(key,JSON.stringify({t:Date.now(),v:j}))}catch(e){}
      return j;
    }).finally(function(){delete api._inflight[url]});
  }
  api._inflight={};
  function apiDown(el,err){
    if(!el)return;
    el.innerHTML='<div class="empty"><b>Live data not connected yet.</b> This section fills from API-Football once the Worker key is active'+(err&&err.message?' <span style="opacity:.7">('+String(err.message).slice(0,120)+')</span>':'')+'.</div>';
  }
  var ISO={"England":"gb-eng","Scotland":"gb-sct","Wales":"gb-wls","Portugal":"pt","Brazil":"br","Netherlands":"nl","Argentina":"ar","Morocco":"ma","Turkey":"tr","Türkiye":"tr","Denmark":"dk","France":"fr","Cameroon":"cm","Uruguay":"uy","Slovenia":"si","Belgium":"be","Paraguay":"py","Cote d'Ivoire":"ci","Ivory Coast":"ci","Spain":"es","Germany":"de","Italy":"it","Sweden":"se","Norway":"no","Republic of Ireland":"ie","Ireland":"ie","Nigeria":"ng","Ghana":"gh","Senegal":"sn","Croatia":"hr","Serbia":"rs","Poland":"pl","Austria":"at","Switzerland":"ch","USA":"us","United States":"us","Canada":"ca","Mexico":"mx","Colombia":"co","Chile":"cl","Ecuador":"ec","Japan":"jp","Korea Republic":"kr","South Korea":"kr","Australia":"au","Egypt":"eg","Algeria":"dz","Tunisia":"tn","Mali":"ml","Guinea":"gn","DR Congo":"cd","Congo DR":"cd","Angola":"ao","Ukraine":"ua","Czech Republic":"cz","Czechia":"cz","Slovakia":"sk","Hungary":"hu","Romania":"ro","Greece":"gr","Finland":"fi","Iceland":"is","Jamaica":"jm","Venezuela":"ve","Peru":"pe","Bosnia and Herzegovina":"ba","Albania":"al","Kosovo":"xk","North Macedonia":"mk","Montenegro":"me","Georgia":"ge","Israel":"il","Iran":"ir","Saudi Arabia":"sa","New Zealand":"nz","Gabon":"ga","Burkina Faso":"bf","Zambia":"zm","Zimbabwe":"zw","South Africa":"za","Uganda":"ug","Kenya":"ke","Luxembourg":"lu","Cyprus":"cy","Malta":"mt","Lithuania":"lt","Latvia":"lv","Estonia":"ee","Bulgaria":"bg","Moldova":"md","Belarus":"by","Russia":"ru","Armenia":"am","Azerbaijan":"az","Kazakhstan":"kz","Uzbekistan":"uz","China PR":"cn","China":"cn","India":"in","Pakistan":"pk","Bangladesh":"bd","Indonesia":"id","Malaysia":"my","Philippines":"ph","Thailand":"th","Vietnam":"vn","Costa Rica":"cr","Panama":"pa","Honduras":"hn","Guatemala":"gt","El Salvador":"sv","Trinidad and Tobago":"tt","Haiti":"ht","Dominican Republic":"do","Cuba":"cu","Bolivia":"bo","Suriname":"sr","Curacao":"cw","Curaçao":"cw","Cape Verde Islands":"cv","Cabo Verde":"cv","Guinea-Bissau":"gw","Sierra Leone":"sl","Liberia":"lr","Togo":"tg","Benin":"bj","Niger":"ne","Chad":"td","Sudan":"sd","Ethiopia":"et","Tanzania":"tz","Mozambique":"mz","Madagascar":"mg","Comoros":"km","Mauritania":"mr","Libya":"ly","Equatorial Guinea":"gq","Central African Republic":"cf","Congo":"cg","Rwanda":"rw","Burundi":"bi","Eritrea":"er","Djibouti":"dj","Somalia":"so","Namibia":"na","Botswana":"bw","Eswatini":"sz","Lesotho":"ls","Malawi":"mw","Gambia":"gm"};
  // Club crest files (assets/crests/*.png, Richard's uploads). Keys cover both the API's spellings and the site's own.
  // FLAGS now only identifies Ireland and supplies player nationality flags; opponents use crests below.
  var FLAGS={"Albania":"al","Algeria":"dz","Andorra":"ad","Argentina":"ar","Armenia":"am","Australia":"au","Austria":"at","Azerbaijan":"az","Belarus":"by","Belgium":"be","Bolivia":"bo","Bosnia and Herzegovina":"ba","Bosnia & Herzegovina":"ba","Brazil":"br","Bulgaria":"bg","Cameroon":"cm","Canada":"ca","Chile":"cl","China":"cn","China PR":"cn","Colombia":"co","Costa Rica":"cr","Croatia":"hr","Cyprus":"cy","Czech Republic":"cz","Czechia":"cz","Czechoslovakia":"cz","Denmark":"dk","Ecuador":"ec","Egypt":"eg","England":"gb-eng","Estonia":"ee","Faroe Islands":"fo","Finland":"fi","France":"fr","Georgia":"ge","Germany":"de","West Germany":"de","Gibraltar":"gi","Greece":"gr","Grenada":"gd","Hungary":"hu","Iceland":"is","Iran":"ir","Israel":"il","Italy":"it","Jamaica":"jm","Kazakhstan":"kz","Kosovo":"xk","Latvia":"lv","Liechtenstein":"li","Lithuania":"lt","Luxembourg":"lu","Malta":"mt","Mexico":"mx","Moldova":"md","Montenegro":"me","Morocco":"ma","Netherlands":"nl","New Zealand":"nz","Nigeria":"ng","North Macedonia":"mk","FYR Macedonia":"mk","Norway":"no","Oman":"om","Paraguay":"py","Poland":"pl","Portugal":"pt","Qatar":"qa","Republic of Ireland":"ie","Rep. Of Ireland":"ie","Ireland":"ie","Romania":"ro","Russia":"ru","San Marino":"sm","Saudi Arabia":"sa","Scotland":"gb-sct","Senegal":"sn","Serbia":"rs","Slovakia":"sk","Slovenia":"si","South Africa":"za","Spain":"es","Sweden":"se","Switzerland":"ch","Trinidad and Tobago":"tt","Tunisia":"tn","Turkey":"tr","Türkiye":"tr","Ukraine":"ua","United States":"us","USA":"us","Uruguay":"uy","Wales":"gb-wls"};
  function slug(t){return fold(t).replace(/[^a-z0-9 -]/g,"").replace(/-/g," ").trim().replace(/ +/g,"-")}
  // Association crests (assets/crests/<slug>.png, Richard's files). Former countries use one general federation mark for every era (sources: tools/data/asset_sources.csv).
  var HAS=["aberdeen","dundee-united","dundee","falkirk","heart-of-midlothian","hibernian","kilmarnock","motherwell","rangers","st-johnstone","st-mirren","benfica","besiktas","celta-vigo","ferencvaros","lask","marseille","omonia","torreense","union-saint-gilloise"];
  var ALIAS={"Hearts":"heart-of-midlothian","Heart Of Midlothian":"heart-of-midlothian","Dundee Utd":"dundee-united","ST Mirren":"st-mirren","ST Johnstone":"st-johnstone","St. Mirren":"st-mirren","St. Johnstone":"st-johnstone","Ferencvarosi TC":"ferencvaros","Ferencváros":"ferencvaros","Beşiktaş":"besiktas","Besiktas JK":"besiktas","Olympique Marseille":"marseille","Union St. Gilloise":"union-saint-gilloise","Union Saint-Gilloise":"union-saint-gilloise","Omonia Nicosia":"omonia","LASK Linz":"lask","Lask Linz":"lask","SC Torreense":"torreense"};
  function crest(name,size){size=size||16; var box=' width="'+size+'" height="'+size+'" style="width:'+size+'px;height:'+size+'px;object-fit:contain;vertical-align:-4px;margin-right:6px" loading="lazy">';
    if(/^celtic$/i.test(name))return '<img class="crest" src="/assets/crest-88.png" alt=""'+box;
    var s=ALIAS[name]||slug(name); if(HAS.indexOf(s)>=0)return '<img class="crest" src="/assets/crests/'+s+'.png" alt=""'+box;
    var w=String(name||"").replace(/[^A-Za-z ]/g,"").split(" ").filter(Boolean), ini=((w[0]||"?")[0]+(w[1]?w[1][0]:"")).toUpperCase();   // no crest supplied yet: a plain roundel with initials
    return '<span class="crestph" aria-hidden="true" style="width:'+size+'px;height:'+size+'px;font-size:'+Math.max(7,Math.round(size*.42))+'px">'+esc(ini)+'</span>'}
  // Rangers from 2012-13 carry an asterisk and a footnote, on every page they appear. No date means a current or all-time figure, which includes that period.
  function astNote(){if(document.getElementById("astnote"))return; function add(){if(document.getElementById("astnote"))return; var f=document.querySelector("footer.mu"); if(!f)return; var p=document.createElement("p"); p.id="astnote"; p.className="sub"; p.textContent="* Rangers from 2012-13, after the 2012 liquidation of the previous company. Counted here as the same club."; f.parentNode.insertBefore(p,f)} if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",add); else add()}
  function ast(name,d){if(/^rangers$/i.test(String(name||""))&&(!d||d>="2012-07-01")){astNote(); return "*"} return ""}
  function nm(name,d){return esc(name)+ast(name,d)}
  // The feed's labels for the Scottish cups.
  function cn(n){return n==="FA Cup"?"Scottish Cup":n==="League Cup"?"Scottish League Cup":n==="Premiership"?"Scottish Premiership":n}
  var COMPS={}, ALIASN={"Heart Of Midlothian":"Heart of Midlothian","ST Mirren":"St Mirren","ST Johnstone":"St Johnstone","Ferencvarosi TC":"Ferencváros","Besiktas JK":"Beşiktaş","Olympique Marseille":"Marseille","Union St. Gilloise":"Union Saint-Gilloise","Lask Linz":"LASK","Dundee Utd":"Dundee United","Omonia Nicosia":"Omonia"};
  // Crest plus the club's name linked to its biography page (Ireland itself links to the hub).
  function club(name,size,cls,d){var us=/^celtic$/i.test(name); return crest(name,size)+'<a class="cl'+(cls?' '+cls:'')+'" href="'+(us?"/":"/opponent/?o="+slug(ALIASN[name]||name))+'">'+esc(ALIASN[name]||name)+'</a>'+ast(name,d)}
  // Competition logos. Feed names map to the current edition; archive rows to the edition the game belonged to.
  function logo(f,alt,size){size=size||18; return '<img class="comp'+(f==="scottish-league-cup"?" ondark":"")+'" src="/assets/comps/'+f+'.png" alt="'+esc(alt)+'" title="'+esc(alt)+'" width="'+size+'" height="'+size+'" style="width:'+size+'px;height:'+size+'px;object-fit:contain;vertical-align:-4px;margin-right:6px" loading="lazy">'}
  function comp(name,size){var n=cn(String(name||"")); if(/premiership/i.test(n))return logo("scottish-premiership",n,size); if(/scottish cup/i.test(n))return logo("scottish-cup",n,size); if(/league cup/i.test(n))return logo("scottish-league-cup",n,size); if(/champions/i.test(n))return logo("champions-league",n,size); if(/europa/i.test(n))return logo("europa-league",n,size); if(/conference/i.test(n))return logo("conference-league",n,size); return ""}
  // Archive rows get a logo only where the current mark was in use, so a 1925 game does not wear a modern sponsor's logo.
  function compRow(m,size){var y=parseInt(m.d,10); if(m.c==="LG"&&y>=2013)return logo("scottish-premiership","Scottish Premiership",size); if(m.c==="SC"&&y>=2020)return logo("scottish-cup","Scottish Cup",size); if(m.c==="LC"&&y>=2023)return logo("scottish-league-cup","Scottish League Cup",size); if(m.c==="EC"&&y>=1993)return logo("champions-league","Champions League",size); if(m.c==="EL"&&y>=2009)return logo("europa-league","Europa League",size); if(m.c==="ECL")return logo("conference-league","Conference League",size); return ""}
  function flag(nat){var c=ISO[nat]; return c?'<img class="flag" src="https://flagcdn.com/w40/'+c+'.png" srcset="https://flagcdn.com/w80/'+c+'.png 2x" alt="'+nat+'" title="'+nat+'">':''}
  // Times default to the viewer's own time zone; UK time is added alongside when the viewer is elsewhere.
  var TZ=(function(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/London"}catch(e){return "Europe/London"}})(), IN_UK=TZ==="Europe/London";
  function fmtDate(iso,opt){return new Date(iso).toLocaleDateString("en-GB",Object.assign({weekday:"short",day:"numeric",month:"short",timeZone:TZ},opt||{}))}
  function fmtUK(iso){return new Date(iso).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"})}
  function fmtLocal(iso){return new Date(iso).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:TZ})}
  function tzLabel(iso){try{var p=new Intl.DateTimeFormat(navigator.language||"en-GB",{timeZone:TZ,timeZoneName:"short"}).formatToParts(new Date(iso)).filter(function(x){return x.type==="timeZoneName"})[0]; return p?p.value:"local"}catch(e){return "local"}}
  // Kick-off in the viewer's zone, with the UK (match) time as a small sub-value beneath — or beside, inline — unless the viewer is in the UK.
  // Plain-text form for canvases and titles.
  function fmtKOText(iso){return IN_UK?fmtUK(iso)+" UK":fmtLocal(iso)+" "+tzLabel(iso)+" (" +fmtUK(iso)+" UK)"}
  function fmtKO(iso,inline){return IN_UK?fmtUK(iso)+" UK":fmtLocal(iso)+" "+esc(tzLabel(iso))+'<small class="tz'+(inline?' inl':'')+'">'+(inline?'· ':'')+fmtUK(iso)+' UK</small>'}
  function fmtSE(iso){return fmtLocal(iso)}
  // ---- single fixture source: fixtures.js wins over the API for kick-off date/time; the API supplies ids, scores, status.
  function nrm(n){return String(n||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z]/g,"")}
  function fixFor(opp,home,iso){var L=window.MU_FIXTURES||[], a=nrm(opp), t=iso?new Date(iso).getTime():0;
    return L.filter(function(f){if(!!f.home!==!!home)return false; var b=nrm(f.opp); if(!(a===b||(Math.min(a.length,b.length)>=4&&(a.indexOf(b)>=0||b.indexOf(a)>=0))))return false; return !t||Math.abs(new Date(f.ko).getTime()-t)<5*864e5})[0]||null}
  // ko(m): for an API match object → {ko, conf, src}. ko(f) for a fixtures.js entry works too.
  function ko(m){ if(m&&m.fixture){var home=m.teams.home.id===TEAM, opp=(home?m.teams.away:m.teams.home).name, f=fixFor(opp,home,m.fixture.date);
      if(f)return {ko:f.ko,conf:!!f.conf,src:"site"}; return {ko:m.fixture.date,conf:m.fixture.status.short!=="TBD",src:"api"} }
    return {ko:m.ko,conf:!!m.conf,src:"site"} }
  // Calendar: the same stable id the Worker's /calendar.ics uses (season-comp-opponent-h/a), so a downloaded match and the subscription are one event.
  function fxSlug(t){return String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
  function fxUid(f){var d=new Date(f.ko), y=d.getUTCMonth()>=6?d.getUTCFullYear():d.getUTCFullYear()-1; return [y+"-"+String(y+1).slice(2),fxSlug(f.comp),fxSlug(f.opp),f.home?"h":"a"].join("-")}
  function calLink(id){return id?'<a class="calbtn" href="/calendar.ics?m='+id+'" download title="Add this game to your calendar. A downloaded copy will not update if the kick-off moves; subscribe on the Season page for that.">+ Calendar</a>':''}
  function calFeed(){var h=location.host||"celtic.richardmcallister.workers.dev", path="/calendar.ics"; return {webcal:"webcal://"+h+path, https:location.protocol+"//"+h+path, google:"https://calendar.google.com/calendar/r?cid="+encodeURIComponent("webcal://"+h+path)}}
  function confTag(x){return x&&x.conf?'<span class="conftag" title="Kick-off confirmed">Confirmed</span>':''}
  function prov(x){var c=x&&typeof x==="object"?x.conf:x; return c?"":'<span class="prov" title="Kick-off time not confirmed yet">Provisional</span>'}
  // "Last checked" stamps from status.json, written by the build scripts and the weekly scheduled task.
  function checked(key,el,label){ if(!el)return; (checked._p=checked._p||fetch("/status.json").then(function(r){return r.json()}).catch(function(){return {}})).then(function(s){var x=s[key]; if(!x)return; var d=new Date(x.date+"T12:00:00Z"), age=Math.round((Date.now()-d)/864e5); el.innerHTML='<span class="stamp'+(age>35?' old':'')+'" title="'+esc(x.note||"")+'">'+(label||"Last checked")+' '+d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})+(age>35?' · '+age+' days ago':'')+'</span>'}) }
  // Match report from a full /api/match payload: timeline, who stood out (by rating), comeback tags — same rules as the collection.
  function tagsFor(f){var home=f.teams.home.id===TEAM, gf=home?f.goals.home:f.goals.away, ga=home?f.goals.away:f.goals.home, won=gf>ga, drew=gf===ga, st=f.fixture.status.short;
    var goals=(f.events||[]).filter(function(e){return e.type==="Goal"&&e.detail!=="Missed Penalty"&&e.time.elapsed!=null}).sort(function(a,b){return (a.time.elapsed+(a.time.extra||0))-(b.time.elapsed+(b.time.extra||0))});
    var us=0,them=0,maxdef=0,last=null; goals.forEach(function(e){var mine=e.team.id===TEAM; if(mine)us++; else them++; if(them-us>maxdef)maxdef=them-us; last={mine:mine,t:e.time.elapsed,lead:us-them}});
    var reds=(f.events||[]).filter(function(e){return e.type==="Card"&&/Red/.test(e.detail)&&e.team.id===TEAM&&e.time.elapsed!=null}), tags=[];
    if(maxdef>=2&&(won||drew))tags.push("two-down"); else if(maxdef>=1&&won)tags.push("from-behind");
    if(last&&last.mine&&won&&last.lead===1&&last.t>=90)tags.push("injury-time-winner"); else if(last&&last.mine&&won&&last.lead===1&&last.t>=85)tags.push("late-winner");
    if(last&&last.mine&&drew&&last.t>=89)tags.push("late-equaliser");
    if(reds.length&&(won||drew)&&Math.min.apply(null,reds.map(function(e){return e.time.elapsed}))<=75)tags.push("ten-men");
    if(st==="PEN"&&(home?f.teams.home.winner:f.teams.away.winner))tags.push("penalties");
    if(gf>=4&&ga>=3)tags.push("thriller");
    return tags}
  var TAGLABEL={"two-down":"Two goals down","from-behind":"Came from behind","injury-time-winner":"Injury-time winner","late-winner":"Late winner","late-equaliser":"Late equaliser","ten-men":"Down to ten men","penalties":"Won on penalties","thriller":"Seven-goal thriller"};
  function report(f,opt){opt=opt||{}; var home=f.teams.home.id===TEAM, us=home?f.teams.home:f.teams.away, opp=home?f.teams.away:f.teams.home, gf=home?f.goals.home:f.goals.away, ga=home?f.goals.away:f.goals.home, res=gf>ga?"W":gf<ga?"L":"D";
    var ev=(f.events||[]).filter(function(e){return e.time.elapsed!=null&&(e.type==="Goal"||(e.type==="Card"&&/Red/.test(e.detail)))}).sort(function(a,b){return (a.time.elapsed+(a.time.extra||0))-(b.time.elapsed+(b.time.extra||0))});
    var h=0,a=0; var tl=ev.map(function(e){var mine=e.team.id===TEAM; if(e.type==="Goal"){if(e.team.id===f.teams.home.id)h++; else a++} var t=e.time.elapsed+(e.time.extra?"+"+e.time.extra:"")+"′";
      return '<li class="'+(mine?"us":"them")+'"><span class="t">'+t+'</span><span>'+(e.type==="Goal"?(e.detail==="Own Goal"?"(og) ":e.detail==="Penalty"?"(pen) ":"⚽ ")+(mine?'<a class="pl" href="/player/?q='+encodeURIComponent(e.player.name)+'">'+esc(e.player.name)+'</a>':esc(e.player.name))+(e.assist&&e.assist.name?' <small>('+esc(e.assist.name)+')</small>':''):'🟥 '+esc(e.player.name))+'</span><span class="sc">'+h+'–'+a+'</span></li>'}).join("");
    var side=(f.players||[]).filter(function(t){return t.team.id===TEAM})[0], stars=side?side.players.filter(function(p){var g=p.statistics[0].games; return g.rating&&g.minutes>=30}).sort(function(x,y){return +y.statistics[0].games.rating-+x.statistics[0].games.rating}).slice(0,3):[];
    var tags=tagsFor(f), sentence=(function(){var o=esc(opp.name); if(res==="W")return (gf-ga>=3?"A comfortable ":tags.indexOf("injury-time-winner")>=0?"A stoppage-time ":tags.indexOf("two-down")>=0?"A comeback ":"A ")+gf+"–"+ga+" win "+(home?"over ":"at ")+o+"."; if(res==="D")return gf+"–"+ga+" "+(home?"with ":"at ")+o+(tags.indexOf("late-equaliser")>=0?", rescued late.":"."); return (ga-gf>=3?"A heavy ":"A ")+gf+"–"+ga+" defeat "+(home?"to ":"at ")+o+"."})();
    return '<div class="report"><div class="rh"><h2 class="k">'+(opt.label||"Match report")+' · '+fmtDate(f.fixture.date,{year:"numeric"})+' · '+comp(f.league.name,16)+esc(f.league.name)+(f.fixture.venue&&f.fixture.venue.name?' · '+esc(f.fixture.venue.name):'')+'</h2><div class="line">'+crest(f.teams.home.name,28)+esc(f.teams.home.name)+' <b>'+f.goals.home+'–'+f.goals.away+'</b> '+esc(f.teams.away.name)+crest(f.teams.away.name,28)+' '+formHtml(res)+'</div><p class="sent">'+sentence+(tags.length?' '+tags.map(function(t){return '<a class="tag" href="/comebacks/">'+(TAGLABEL[t]||t)+'</a>'}).join(" "):'')+'</p></div>'+
      '<div class="rg"><div><h3>How it went</h3>'+(tl?'<ul class="tl">'+tl+'</ul>':'<p class="sub">No goals.</p>')+'</div><div><h3>Stood out</h3>'+(stars.length?'<ul class="stars">'+stars.map(function(p){var g=p.statistics[0]; return '<li><img src="/img/player/'+p.player.id+'.png" alt="" onerror="this.style.visibility=\'hidden\'"><span><a class="pl" href="/player/?q='+encodeURIComponent(p.player.name)+'">'+esc(p.player.name)+'</a><small>'+g.games.minutes+'′'+(g.goals.total?' · '+g.goals.total+' goal'+(g.goals.total>1?'s':''):'')+(g.goals.assists?' · '+g.goals.assists+' assist'+(g.goals.assists>1?'s':''):'')+(g.goals.saves?' · '+g.goals.saves+' saves':'')+'</small></span><b>'+(+g.games.rating).toFixed(1)+'</b></li>'}).join("")+'</ul>':'<p class="sub">Ratings not published for this match.</p>')+'</div></div>'+(opt.link!==false?'<p class="sub" style="margin-top:8px"><a href="/match/?id='+f.fixture.id+'">Full match centre →</a></p>':'')+'</div>'}
  // scorers from the archive: [[name, article title, goals, flags]] -> "Beckham, Cole 2 (pen), Dunk (og)" with player links
  // Goal events reconciled against the official score: the feed logs a goal the moment the ball goes in, and if VAR
  // rules it out the event can stay (usually with no scorer) while f.goals never moves. Returns the goal events
  // (penalty misses excluded) with e.ok=true for the ones the score counts and e.ok=false for the ones ruled out;
  // when a team has more goal events than goals, the extras are the ones without a scorer first, then the latest.
  function goalEvents(f){var ev=(f&&f.events||[]).filter(function(e){return e.type==="Goal"&&e.detail!=="Missed Penalty"&&e.time&&e.time.elapsed!=null}); if(!f||!f.goals||!f.teams)return ev.map(function(e){e.ok=true;return e});
    [f.teams.home,f.teams.away].forEach(function(t,i){var mine=ev.filter(function(e){return e.team.id===t.id}), allowed=i?f.goals.away:f.goals.home; if(allowed==null)allowed=mine.length; var extra=mine.length-allowed; mine.forEach(function(e){e.ok=true});
      if(extra>0){var pool=mine.filter(function(e){return !(e.player&&e.player.name)}).concat(mine.filter(function(e){return e.player&&e.player.name}).reverse()); pool.slice(0,extra).forEach(function(e){e.ok=false})}});
    return ev}
  // Section pills. pills(el, items) renders [{id,label,count}] as jump links and highlights the section in view;
  // tabs(el, items, def) does the same but on phones (≤640px) shows only the chosen section, remembers it, and honours #hash.
  function pills(el,items){el.innerHTML=items.map(function(i){return '<a href="#'+i.id+'">'+esc(i.label)+(i.count!=null?' <small>'+i.count+'</small>':'')+'</a>'}).join(""); if(!items.length){el.hidden=true;return} el.hidden=false;
    var links=[].slice.call(el.querySelectorAll("a")), secs=items.map(function(i){return document.getElementById(i.id)});
    function mark(){var y=window.scrollY+90, on=0, best=-Infinity; secs.forEach(function(s,i){if(!s||s.offsetParent===null)return; var t=s.getBoundingClientRect().top+window.scrollY; if(t<=y&&t>best){best=t;on=i}}); links.forEach(function(a,i){a.classList.toggle("on",i===on)})}
    window.addEventListener("scroll",mark,{passive:true}); mark()}
  function tabs(el,items,def,opt){var always=!!(opt&&opt.always), phone=function(){return always||window.matchMedia("(max-width:640px)").matches}, wrap=el.parentNode, key="tab:"+location.pathname+(always?":v2":"");
    el.innerHTML=items.map(function(i){return '<a href="#'+i.id+'" data-t="'+i.id+'"'+(always?' role="tab"':'')+'>'+(i.icon||"")+esc(i.label)+'</a>'}).join(""); wrap.classList.add("tabbed"); if(always){wrap.classList.add("always"); el.setAttribute("role","tablist")}
    function show(id,push){items.forEach(function(i){var s=document.querySelector('[data-tab="'+i.id+'"]'); if(s)s.classList.toggle("on",i.id===id)}); [].slice.call(el.querySelectorAll("a")).forEach(function(a){var on=a.getAttribute("data-t")===id; a.classList.toggle("on",on); if(always)a.setAttribute("aria-selected",on)}); if(always)document.dispatchEvent(new CustomEvent("mu:tab",{detail:id})); try{localStorage.setItem(key,id)}catch(e){} if(push)history.replaceState(null,"","#"+id)}
    var start=(location.hash||"").slice(1); if(!items.some(function(i){return i.id===start})){try{start=localStorage.getItem(key)}catch(e){} if(!items.some(function(i){return i.id===start}))start=def||items[0].id}
    show(start,false);
    el.addEventListener("click",function(ev){var a=ev.target.closest("a"); if(!a)return; var id=a.getAttribute("data-t"); if(phone()){ev.preventDefault(); show(id,true); window.scrollTo({top:0,behavior:"smooth"})} else show(id,false)});
    window.addEventListener("hashchange",function(){var id=location.hash.slice(1); if(items.some(function(i){return i.id===id}))show(id,false)});
    if(!phone())pills(el,items); return {show:show}}
  // Team news from the injuries feed, reconciled. The feed lists a player once per fixture he was flagged for and the order is
  // not by date, so the newest flag per player wins; a player who then started or came on in a match played on or after his
  // flag is "back" (with the minute), not injured. Returns {list, out, doubts, back, asOf, fetched}.
  function injuries(j,matches){var rows=(j&&j.response||[]).filter(function(x){return x.player&&x.fixture&&x.fixture.date}).sort(function(a,b){return b.fixture.date.localeCompare(a.fixture.date)});
    var seen={}, list=[]; rows.forEach(function(x){if(seen[x.player.id])return; seen[x.player.id]=1; list.push(x)});
    var cut=Date.now()-7*864e5; list=list.filter(function(x){return new Date(x.fixture.date)>cut});
    (matches||[]).forEach(function(f){if(!f||!f.fixture)return; var d=f.fixture.date, on={};
      (f.lineups||[]).forEach(function(l){if(l.team.id!==TEAM)return; (l.startXI||[]).forEach(function(p){on[p.player.id]="started"})});
      (f.events||[]).forEach(function(e){if(e.type==="subst"&&e.team.id===TEAM&&e.assist&&e.assist.id)on[e.assist.id]="came on "+e.time.elapsed+"'"});
      list.forEach(function(x){if(on[x.player.id]&&d>=x.fixture.date.slice(0,10)){var opp=f.teams.home.id===TEAM?f.teams.away.name:f.teams.home.name; x.back={what:on[x.player.id],opp:opp,date:d}}})});
    var out=list.filter(function(x){return !x.back&&/Missing/i.test(x.player.type||"")}), doubts=list.filter(function(x){return !x.back&&!/Missing/i.test(x.player.type||"")}), back=list.filter(function(x){return x.back});
    return {list:list.filter(function(x){return !x.back}),out:out,doubts:doubts,back:back,asOf:list.length?list[0].fixture.date:null,fetched:j&&j._fetched||null}}
  function ago(t){if(!t)return ""; var m=Math.round((Date.now()-t)/60000); if(m<1)return "just now"; if(m<60)return m+" min ago"; var h=Math.round(m/60); if(h<48)return h+" h ago"; return Math.round(h/24)+" days ago"}
  // Lead portrait from a Wikipedia REST summary: the 330px thumbnail with 2x/3x variants (Wikimedia renders any width),
  // intrinsic size set so the box is reserved, high fetch priority since it is the largest thing above the fold.
  function portrait(j,alt,cls){var th=j&&j.thumbnail, t=typeof th==="string"?th:th&&th.source; if(!t)return ""; var tb=j.thumb||th||{}, m=t.match(/\/(\d+)px-/), w=m?+m[1]:0, W=tb.w||tb.width||w||330, H=tb.h||tb.height||Math.round(W*1.25), ow=tb.ow||0;
    var at=function(n){return t.replace(/\/\d+px-/,"/"+n+"px-")}, ws=w?[330,440,660].filter(function(n){return ow?n<=ow:n<=440}):[], ss=ws.map(function(n){return at(n)+" "+n+"w"}).join(", ");
    return '<img class="'+(cls||"photo")+'" src="'+(ws.length?at(ws[0]):t)+'"'+(ss?' srcset="'+ss+'" sizes="220px"':'')+' width="'+W+'" height="'+H+'" fetchpriority="high" decoding="async" alt="'+esc(alt||"")+'">'}
  // Ask the archive: POST the question to the Worker, render the answer with the pages it drew on.
  function scorers(sc){if(!sc||!sc.length)return ""; return sc.map(function(x){var fl=x[3]||"", og=fl.indexOf("o")>=0; return (x[1]&&!og?'<a class="pl" href="/player/?p='+encodeURIComponent(x[1])+'">'+esc(x[0])+'</a>':esc(x[0]))+(x[2]>1?' '+x[2]:'')+(fl.indexOf("p")>=0?' <i>pen</i>':'')+(og?' <i>og</i>':'')}).join(", ")}
  // links for an archived match row: the site's match centre (feed id, 2010/11 on), the match report the season article cites, else the season article itself
  function mlinks(m){var out=[]; if(m.id)out.push('<a class="chip" href="/match/?id='+m.id+'">Match centre</a>');
    if(m.rep)out.push('<a class="chip" href="'+esc(m.rep)+'" target="_blank" rel="noopener" title="'+esc(m.rep.replace(/^https?:\/\/(www\.)?([^\/]+).*$/,"$2"))+'">Report ↗</a>');
    return out.join("")}
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function formHtml(str){return '<span class="form">'+String(str||"").split("").map(function(c){return '<b class="'+c+'">'+c+'</b>'}).join("")+'</span>'}
  return {ast:ast,nm:nm,cn:cn,compRow:compRow,slug:slug,FLAGS:FLAGS,fxUid:fxUid,calLink:calLink,calFeed:calFeed,confTag:confTag,TEAM:TEAM,nav:nav,theme:theme,portrait:portrait,injuries:injuries,ago:ago,GROUP:GROUP,GORDER:GORDER,pills:pills,tabs:tabs,scorers:scorers,goalEvents:goalEvents,mlinks:mlinks,search:search,hit:hit,KIND:KIND,checked:checked,report:report,tagsFor:tagsFor,TAGLABEL:TAGLABEL,fixFor:fixFor,ko:ko,prov:prov,crest:crest,club:club,comp:comp,api:api,apiDown:apiDown,flag:flag,fmtDate:fmtDate,fmtUK:fmtUK,fmtSE:fmtSE,fmtLocal:fmtLocal,fmtKO:fmtKO,fmtKOText:fmtKOText,TZ:TZ,IN_UK:IN_UK,esc:esc,form:formHtml};
})();
