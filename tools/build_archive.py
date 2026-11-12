#!/usr/bin/env python3
"""tools/data/matches_raw.json + list articles -> site/history/*.json. Disagreements go to tools/data/reconcile.txt, never silently fixed."""
import json,os,re,collections,datetime,unicodedata,sys
sys.path.insert(0,'tools')
from parse_wiki import unlink,strip_refs
W='tools/data/wiki/'; OUT='site/history/'; os.makedirs(OUT,exist_ok=True)
REC=[]; 
def slug(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower(); s=s.replace("'",'').replace('’','')
    return re.sub(r'[^a-z0-9]+','-',s).strip('-')
def bare(t): return re.sub(r'\s*\(.*?\)\s*$','',t or '').strip()
# ---- opponents
ALIAS={'hearts':'Heart of Midlothian','st. mirren':'St Mirren','st mirren':'St Mirren','st. johnstone':'St Johnstone','inverness ct':'Inverness Caledonian Thistle','inverness c.t.':'Inverness Caledonian Thistle','inverness':'Inverness Caledonian Thistle','dundee utd':'Dundee United','dundee united':'Dundee United','partick':'Partick Thistle','hibs':'Hibernian','hamilton':'Hamilton Academical','hamilton accies':'Hamilton Academical','ross county':'Ross County','airdrie':'Airdrieonians','raith':'Raith Rovers','third lanark':'Third Lanark','morton':'Morton','greenock morton':'Morton','rangers':'Rangers','dunfermline':'Dunfermline Athletic','kilmarnock':'Kilmarnock','livingston':'Livingston','motherwell':'Motherwell','st. bernard\'s':"St Bernard's",'queens park':"Queen's Park",'queen\'s park':"Queen's Park",'albion':'Albion Rovers','arbroath':'Arbroath','alloa':'Alloa Athletic','stirling':'Stirling Albion','ayr':'Ayr United','clydebank':'Clydebank','man utd':'Manchester United','man united':'Manchester United','east fife':'East Fife','cowdenbeath':'Cowdenbeath','forfar':'Forfar Athletic','stenhousemuir':'Stenhousemuir'}
ALIAS.update({'dunde united':'Dundee United','dunfermlie athletic':'Dunfermline Athletic','hamilton academial':'Hamilton Academical','hanmilton academical':'Hamilton Academical','partic thistle':'Partick Thistle','partick thisle':'Partick Thistle','stilring albion':'Stirling Albion','dinamo kiev':'Dynamo Kyiv','hamburg':'Hamburger SV','jeunesse d\'esch':'Jeunesse Esch','mtk hungária':'MTK Budapest','rosenborg bk':'Rosenborg','sk rapid wien':'Rapid Vienna','stuttgart':'VfB Stuttgart','københavn':'Copenhagen','olympiacos piraeus':'Olympiacos','airdireonians':'Airdrieonians','airdrieonaians':'Airdrieonians','airdrieonains':'Airdrieonians','airdrie united':'Airdrie United','a.c. milan':'AC Milan','milan':'AC Milan','afc ajax':'Ajax','agf aarhus':'AGF','aarhus':'AGF','atletico madrid':'Atlético Madrid','as saint-etienne':'Saint-Étienne','bsc young boys':'Young Boys','inter milan':'Internazionale','inter':'Internazionale','fc porto':'Porto','fc barcelona':'Barcelona','fc basel':'Basel','fc copenhagen':'Copenhagen','f.c. copenhagen':'Copenhagen','fc midtjylland':'Midtjylland','psv':'PSV Eindhoven','bayern':'Bayern Munich','rb leipzig':'RB Leipzig','rasenballsport leipzig':'RB Leipzig','paris sg':'Paris Saint-Germain','psg':'Paris Saint-Germain','sevilla fc':'Sevilla','sporting':'Sporting CP','sporting clube de portugal':'Sporting CP','real madrid cf':'Real Madrid','dynamo kyiv':'Dynamo Kyiv','dynamo kiev':'Dynamo Kyiv','qarabag':'Qarabağ','ferencvaros':'Ferencváros','ferencvarosi':'Ferencváros','vitoria':'Vitória','besiktas':'Beşiktaş'})
_links={}
def opp_name(disp,link):
    d=(disp or '').strip()
    d=re.sub(r'\s*\(.*?\)\s*$','',d); d=re.sub(r'^(?:F\.?C\.?|A\.?F\.?C\.?)\s+','',d) if d not in('FC Copenhagen',) else d; d=re.sub(r'\s+(F\.?C\.?|A\.?F\.?C\.?)$','',d).strip()
    return ALIAS.get(d.lower(),ALIAS.get((disp or '').strip().lower(),d))
# ---- raw rows
raw=json.load(open('tools/data/matches_raw.json'))
today=datetime.date.today().isoformat()
un=[r for r in raw if r['c'] is None]
for r in un: REC.append(f"unclassified {r['d']} {r['t1']} v {r['t2']} [{r['sec']} | {r['rnd']}]")
# scorers: resolve surnames to the linked full name in the same season, then the nearest season
link_by_season=collections.defaultdict(lambda:collections.defaultdict(collections.Counter)); link_all=collections.defaultdict(collections.Counter)
def sur(n): return slug(bare(n).split(' ')[-1]) if n else ''
for r in raw:
    side=r['g1'] if r['ca'] else r['g2']
    for g in side:
        if g[1] and not re.search(r'[#:]',g[1]):
            t=bare(g[1]); link_by_season[r['y']][sur(g[0])][g[1]]+=1; link_all[sur(g[0])][g[1]]+=1
def full(disp,link,y):
    if link and not re.search(r'[:#]',link): return bare(link),link
    k=sur(disp)
    for dy in (0,1,-1,2,-2,3,-3,4,-4,5,-5):
        c=link_by_season.get(y+dy,{}).get(k)
        if c:
            t=c.most_common(1)[0][0]; return bare(t),t
    return disp,None
matches=[]; seen={}; dropped=0
HOME=re.compile(r'celtic park|parkhead',re.I)
for r in raw:
    if r['c'] in (None,'FR') or not r['s'] or not r['d'] or r['d']>today: continue
    a,b,aet,pens=r['s']; us=r['ca']
    gf,ga=(a,b) if us else (b,a); gl=r['g1'] if us else r['g2']
    o=opp_name(r['t2'] if us else r['t1'],r['ol'])
    if o=='Clydebank': o='Clydebank (1914)' if r['y']<1940 else 'Clydebank'
    if not o or re.search(r'^(tbd|tba|winner|loser)',o,re.I): continue
    rnd=r['rnd']; rl=rnd.lower(); stad=r['st']
    final=re.search(r'\bfinal\b|semi',rl) and not re.search(r'quarter',rl)
    h=1 if us else -1
    if final and r['c'] in('SC','LC','GC','CH','OTH','EC','EL','CWC','FC','WAR') and not HOME.search(stad) and 'leg' not in rl and not (r['c'] in('EC','EL','CWC','FC') and 'semi' in rl): h=0
    if r['c'] in('LG',) and re.search(r'play-?off',rl+r['lab'].lower()): h=0
    if re.search(r'montevideo|centenario',stad+r['loc'],re.I): h=0
    if r['src']=='table' and (re.search(r'hampden',stad,re.I) and r['c'] in('SC','LC') or r['d']=='2003-05-21'): h=0   # 2002-04 are plain tables with no round names
    k=(r['d'],slug(o))
    sc=[]
    for g in gl:
        name,link=full(g[0],g[1],r['y'])
        for m,kd in zip(g[2],g[3]):
            row=[("Own goal" if kd=='og' else name),m]
            if kd: row.append(kd)
            sc.append(row)
    known=len(sc)
    row=dict(d=r['d'],c=r['c'],t=r['lab'],o=o,h=h,gf=gf,ga=ga,v=stad,r=rnd,y=r['y'])
    if r['ref']: row['ref']=r['ref']
    if r['att']: row['att']=int(r['att'])
    if r['rep']: row['rep']=r['rep']
    if aet: row['aet']=1
    if pens: row['pw']=1 if (pens[0]>pens[1])==us else 0; row['pens']=(list(pens) if us else [pens[1],pens[0]])
    if sc: row['sc']=sc
    if known and gf and known!=gf: REC.append(f"scorers {r['d']} {o} {gf}-{ga}: {known} goals named")
    if k in seen:
        prev=seen[k]; dropped+=1
        if (prev['gf'],prev['ga'])!=(gf,ga): REC.append(f"duplicate with different score {r['d']} {o}: {prev['gf']}-{prev['ga']} / {gf}-{ga}")
        if not prev.get('sc') and sc: prev['sc']=sc
        continue
    seen[k]=row; matches.append(row)
matches.sort(key=lambda m:m['d'])
for i,m in enumerate(matches,1): m['i']=i
# ---- seasons list
def cells_after(block):
    out=[]
    for ln in block.split('\n'):
        if ln.startswith('|-'): continue
        if ln.startswith('|'):
            for c in re.split(r'\|\|',ln[1:]): out.append(c)
    return out
sl=open(W+'seasons.wt').read(); SEASONS={}
for m in re.finditer(r'!\s*scope=row\s*\|\s*\[\[(\d{4})[–-](\d{2,4})[^\]]*\]\](.*?)(?=\n\|-|\n\|\})',sl,re.S):
    y=int(m.group(1)); c=cells_after(m.group(3))
    def cv(i):
        x=c[i] if i<len(c) else ''; x=re.sub(r'^[^|\[]*\|(?!\|)','',x) if re.match(r'^\s*(bgcolor|style|rowspan|align)',x) else x
        x=re.sub(r'\{\{sort\|[^|}]*\|([^}]*)\}\}',r'\1',strip_refs(x)); x=re.sub(r'\{\{efn[^}]*\}\}','',x)
        return unlink(re.sub(r'\{\{[^}]*\}\}','',x)).strip()
    if len(c)<9: continue
    def ni(s):
        s=re.sub(r'\D','',s); return int(s) if s else None
    lastc=[x for x in c if not x.strip().startswith('rowspan')]
    SEASONS[y]=dict(top=re.sub(r'\s*,\s*,?',', ',cv(len(c)-2).replace('<hr>',', ').replace('<hr/>',', ')).strip(', ') if len(c)>=11 else '',topg=ni(re.sub(r'\{\{0\}\}','',c[-1])) if len(c)>=11 else None,div=cv(0),p=ni(cv(1)),w=ni(cv(2)),d=ni(cv(3)),l=ni(cv(4)),gf=ni(cv(5)),ga=ni(cv(6)),pts=ni(cv(7)),pos=cv(8))
# ---- reconcile league totals
LEAGUE=collections.defaultdict(lambda:dict(p=0,w=0,d=0,l=0,gf=0,ga=0))
for m in matches:
    if m['c']=='LG' and not re.search(r'play-?off',(m['r'] or '').lower()):
        t=LEAGUE[m['y']]; t['p']+=1; t['gf']+=m['gf']; t['ga']+=m['ga']; t['w' if m['gf']>m['ga'] else 'l' if m['gf']<m['ga'] else 'd']+=1
agree=diff=0
for y,s in sorted(SEASONS.items()):
    if not s['p'] or y>=2026: continue
    t=LEAGUE.get(y,{}); bad=[k for k in 'pwdl' if t.get(k)!=s[k]]+[k for k in ('gf','ga') if t.get(k)!=s[k]]
    if bad: diff+=1; REC.append(f"league {y}: list P{s['p']} W{s['w']} D{s['d']} L{s['l']} {s['gf']}-{s['ga']} / articles P{t.get('p')} W{t.get('w')} D{t.get('d')} L{t.get('l')} {t.get('gf')}-{t.get('ga')}")
    else: agree+=1
# ---- managers
ml=open(W+'managers.wt').read(); MAN=[]
for block in re.split(r'\n\|-',ml[ml.find('|+List'):]):
    m=re.search(r'\{\{sortname\|([^|}]+)\|([^|}]+)(?:\|([^|}]*))?[^}]*\}\}',block)
    w=re.search(r'\{\{WDL\|(\d+)\|(\d+)\|(\d+)\|(\d+)',block)
    if not m or (not w and 'McStay' not in block): continue
    ds=re.findall(r'\{\{dts\|(?:format=dmy\|)?(\d{4})(?:\|(\w+))?(?:\|(\d+))?',block); lb=m.group(3) if m.group(3) and '=' not in m.group(3) else None
    name=f"{m.group(1)} {m.group(2)}".strip(); care=block.count('FBAEB1')+block.count('Caretaker')
    def dd(x,end=False):
        y,mo,da=x; mi={k:v for v,k in enumerate('January February March April May June July August September October November December'.split(),1)}.get(mo or '',(12 if end else 1)) if not (mo or '').isdigit() else int(mo)
        return f"{y}-{mi:02d}-{int(da) if da else (28 if end else 1):02d}"
    fr=dd(ds[0]) if ds else None; to=dd(ds[1],True) if len(ds)>1 else (dd(ds[0],True) if ds and 'colspan' in block else None)
    MAN.append(dict(name=name,slug=slug(name),wiki=lb or name,fromd=fr,tod=to,lp=int(w.group(1)) if w else 0,lw=int(w.group(2)) if w else 0,ld=int(w.group(3)) if w else 0,ll=int(w.group(4)) if w else 0,care=1 if care else 0))
for n,x in enumerate(MAN): x['sp']=n
def manager_on(d):
    c=[x for x in MAN if x['fromd'] and x['fromd']<=d and (not x['tod'] or d<=x['tod'])]
    return c[-1] if c else None
for m in matches:
    x=manager_on(m['d'])
    if x: m['mn']=x['name']; m['ms']=x['slug']; m['_sp']=x['sp']
MAJOR=('LG','SC','LC','EC','EL','CWC','FC','ECL','OTH')
def tally(L):
    t=dict(p=0,w=0,d=0,l=0,gf=0,ga=0)
    for m in L: t['p']+=1; t['gf']+=m['gf']; t['ga']+=m['ga']; t['w' if m['gf']>m['ga'] else 'l' if m['gf']<m['ga'] else 'd']+=1
    return t
managers=[]
for x in MAN:
    L=[m for m in matches if m.get('_sp')==x['sp'] and m['c'] in MAJOR]; t=tally(L)
    managers.append(dict(name=x['name'],slug=x['slug'],career=(x['fromd'] or '')[:4]+'–'+((x['tod'] or '')[:4] or 'present'),**{'from':int((x['fromd'] or '0')[:4]),'to':int(x['tod'][:4]) if x['tod'] else None},**t,listed=x['lp'],lw=x['lw'],ld=x['ld'],ll=x['ll'],note='Caretaker' if x['care'] else '',wiki=x['wiki'].replace(' ','_')))
    if x['lp'] and abs(t['p']-x['lp'])>3: REC.append(f"manager {x['name']}: list {x['lp']} games / articles {t['p']} (major competitions)")
# ---- players
pl=open(W+'players.wt').read(); pl=pl[pl.find('|+ List'):pl.find('==Club captains')]; LIST={}
for block in re.split(r'\n\|-',pl):
    m=re.search(r'\{\{sortname\|([^|}]+)\|([^|}]+)((?:\|[^}]*)?)\}\}',block)
    if not m: continue
    name=f"{m.group(1)} {m.group(2)}".strip(); extra=m.group(3); dab=re.search(r'dab=([^|}]+)',extra); lk=re.search(r'\|([^=|}]+)(?:\||$)',extra)
    wiki=(lk.group(1).strip() if lk else name)+(f" ({dab.group(1)})" if dab else '')
    row=block[block.find('}}',m.end()-2)+2:]; cs=[c.strip() for c in re.split(r'\|\|',strip_refs(row))]
    if len(cs)<5: continue
    pos=re.sub(r'[^A-Z/]','',cs[1]); nat=(re.search(r'\{\{fba?\|(\w+)',cs[0]) or [None,''])[1]
    car=unlink(re.sub(r'<br\s*/?>',', ',cs[2])); ap=re.sub(r'\D','',cs[3]); go=re.sub(r'\D','',cs[4])
    if not ap: continue
    LIST[slug(name)]=dict(name=name,wiki=wiki.replace(' ','_'),pos=pos,nat=nat,career=car,apps=int(ap),goals=int(go or 0))
player_goals=collections.defaultdict(list); hats=[]
ST=collections.defaultdict(lambda:dict(known=0,first=None,last=None,name=None))
for m in matches:
    cnt=collections.Counter()
    for s in m.get('sc',[]):
        if s[0]=='Own goal': continue
        k=slug(s[0]); player_goals[k].append(dict(d=m['d'],o=m['o'],i=m['i'],m=s[1],p=1 if len(s)>2 and s[2]=='p' else 0,c=m['c'])); cnt[s[0]]+=1
        if m['c'] in MAJOR:
            T=ST[k]; T['known']+=1; T['name']=T['name'] or s[0]; T['first']=T['first'] or m['d']; T['last']=m['d']
    for n,g in cnt.items():
        if g>=3 and m['c'] in MAJOR: hats.append(dict(name=n,g=g,d=m['d'],c=m['c'],o=m['o'],h=m['h'],gf=m['gf'],ga=m['ga'],i=m['i']))
players=[]; keys=set(LIST)|set(ST)
for k in keys:
    L=LIST.get(k); T=ST.get(k,{})
    if not L and ' ' not in (T.get('name') or ''): continue
    # surname-only names from unlinked scorers stay as printed, marked so the page can say so
    players.append(dict(name=(L or T)['name'],slug=k,wiki=(L['wiki'] if L else (T['name'].replace(' ','_') if ' ' in T['name'] else None)),pos=(L or {}).get('pos',''),nat=(L or {}).get('nat',''),career=(L or {}).get('career',''),apps=(L or {}).get('apps'),goals=(L or {}).get('goals'),known=T.get('known',0),first=T.get('first'),last=T.get('last'),listed=1 if L else 0))
players.sort(key=lambda p:(-(p['apps'] or 0),-p['known'],p['name']))
for p in players:
    if p['listed'] and p['known']>p['goals']+1: REC.append(f"player {p['name']}: list {p['goals']} goals / articles {p['known']} (major competitions; same-name players may be merged)")
# ---- opponents
by=collections.defaultdict(list)
for m in matches:
    if m['c'] in MAJOR: by[m['o']].append(m)
opponents=[]
for o,L in by.items():
    t=tally(L); hm=tally([m for m in L if m['h']==1]); aw=tally([m for m in L if m['h']==-1]); lg=tally([m for m in L if m['c']=='LG'])
    opponents.append(dict(name=o,slug=slug(o),first=L[0]['d'],last=L[-1]['d'],**t,home=hm,away=aw,league=lg))
opponents.sort(key=lambda x:-x['p'])
# ---- league record by opponent: check
lo=open(W+'league-opp.wt').read(); chk=0; miss=0
for block in re.split(r'\n\|-',lo):
    m=re.search(r'!scope=row[^|]*\|\s*\[\[(?:[^\]|]*\|)?([^\]]+)\]\]',block)
    if not m: continue
    w=re.search(r'\{\{WDL\|(\d+)',block)
    if not w: continue
    name=opp_name(m.group(1),None); o=[x for x in opponents if x['name']==name]; pld=int(w.group(1))
    if name=='Clydebank' and re.search(r'1914',block): o=[x for x in opponents if x['name']=='Clydebank (1914)']
    if not o: miss+=1; REC.append(f"opponent {name}: list {pld} league games / none matched in articles"); continue
    if o[0]['league']['p']!=pld: REC.append(f"opponent {name}: list {pld} league games / articles {o[0]['league']['p']}")
    else: chk+=1
# ---- seasons file
seasons=[]
SC_W=collections.defaultdict(dict)
for m in matches:
    pass
years=sorted(set(m['y'] for m in matches)|set(SEASONS))
for y in years:
    S=SEASONS.get(y,{}); L=[m for m in matches if m['y']==y]
    title=f"{y}–{str(y+1)[-2:]}" if (y+1)%100 else f"{y}–{y+1}"
    known=sum(len([s for s in m.get('sc',[])]) for m in L); gf=sum(m['gf'] for m in L)
    seasons.append(dict(y=y,title=title,top=S.get('top',''),topg=S.get('topg'),div=S.get('div',''),pos=S.get('pos',''),p=S.get('p'),w=S.get('w'),d=S.get('d'),l=S.get('l'),gf=S.get('gf'),ga=S.get('ga'),pts=S.get('pts'),games=len(L),goals=gf,known=known))
# ---- records
def top(L,key,n=10): return sorted(L,key=key)[:n]
M=[m for m in matches if m['c'] in MAJOR]
names={'LG':'League','SC':'Scottish Cup','LC':'League Cup','EC':'European Cup / Champions League','EL':'UEFA Cup / Europa League','CWC':"Cup Winners' Cup",'FC':'Inter-Cities Fairs Cup','ECL':'Conference League','OTH':'Other major cups'}
def slimm(m): return {k:m[k] for k in('d','c','o','h','gf','ga','i','v','sc','pw','t') if k in m}
def runs(L):
    out={}
    defs={'Won in a row':lambda m:m['gf']>m['ga'],'Unbeaten':lambda m:m['gf']>=m['ga'],'Without a win':lambda m:m['gf']<=m['ga'],'Lost in a row':lambda m:m['gf']<m['ga'],'Scored in':lambda m:m['gf']>0,'Clean sheets':lambda m:m['ga']==0}
    for k,f in defs.items():
        best=(0,None,None); cur=0; st=None
        for m in L:
            if f(m):
                st=st or m['d']; cur+=1
                if cur>best[0]: best=(cur,st,m['d'])
            else: cur=0; st=None
        out[k]=dict(n=best[0],**{'from':best[1],'to':best[2]},cur=cur)
    return out
dec=collections.defaultdict(list)
for m in M: dec[m['d'][:3]+'0s'].append(m)
gr=collections.Counter(m['v'] for m in M if m['h']==1 and m['v'])
records=dict(span=[matches[0]['d'],matches[-1]['d']],all=tally(M),home=tally([m for m in M if m['h']==1]),away=tally([m for m in M if m['h']==-1]),neutral=tally([m for m in M if m['h']==0]),
  comps=[dict(c=c,name=names[c],**tally([m for m in M if m['c']==c])) for c in MAJOR if any(m['c']==c for m in M)],
  decades=[dict(dec=k,**tally(v)) for k,v in sorted(dec.items())],
  wins=[slimm(m) for m in top(M,lambda m:(-(m['gf']-m['ga']),-m['gf']))],defeats=[slimm(m) for m in top(M,lambda m:(-(m['ga']-m['gf']),-m['ga']))],highest=[slimm(m) for m in top(M,lambda m:-(m['gf']+m['ga']))],
  runs=runs(M),apps=[dict(name=p['name'],slug=p['slug'],apps=p['apps'],goals=p['goals'],career=p['career'],pos=p['pos']) for p in players if p['apps']][:25],
  scorers=[dict(name=p['name'],slug=p['slug'],apps=p['apps'],goals=p['goals'],career=p['career']) for p in sorted([p for p in players if p['goals']],key=lambda p:-p['goals'])[:25]],
  hats=hats,grounds=gr.most_common(10),
  coverage=dict(scored=sum(len(m.get('sc',[])) for m in M),goals=sum(m['gf'] for m in M),byComp=[dict(c=c,name=names[c],known=sum(len(m.get('sc',[])) for m in M if m['c']==c),goals=sum(m['gf'] for m in M if m['c']==c)) for c in MAJOR if any(m['c']==c for m in M)],byDecade=[dict(dec=k,known=sum(len(m.get('sc',[])) for m in v),goals=sum(m['gf'] for m in v)) for k,v in sorted(dec.items())]))
for m in matches: m.pop('_sp',None)
# ---- honours
ct=open(W+'club.wt').read(); i=ct.find('==Honours=='); j=ct.find('===Other honours',i); honours=[]
for b in re.split(r'\n\|-',ct[i:j]):
    m=re.search(r'!\s*scope=col\s*\|\s*(.*)',b); n=re.search(r"'''(\d+)'''",b)
    if not m or not n: continue
    ss=re.findall(r'\[\[[^\]|]*\|(\d{4}[–-]\d{2,4})\]\]',b)
    name=unlink(strip_refs(m.group(1))); honours.append(dict(name=name,n=int(n.group(1)),seasons=ss))
    if len(ss)!=int(n.group(1)): REC.append(f"honours {name}: {n.group(1)} titles / {len(ss)} seasons listed")
otd=collections.defaultdict(list)
for m in matches:
    if m['c'] in MAJOR: otd[m['d'][5:]].append({k:m[k] for k in('d','c','t','o','h','gf','ga','pw') if k in m})
# ---- search index: [title, kind, url, subtitle, aliases]
search=[]
for p in players:
    search.append([p['name'],'player','/player/?p='+p['slug'],' · '.join(x for x in (p['pos'],p['career'],(str(p['apps'])+' apps, '+str(p['goals'])+' goals') if p['apps'] else (str(p['known'])+' goals on record')) if x),[]])
seen_m=set()
for x in managers:
    if x['slug'] in seen_m: continue
    seen_m.add(x['slug']); search.append([x['name'],'manager','/manager/?m='+x['slug'],x['career'],[]])
for o in opponents: search.append([o['name'],'club','/opponent/?o='+slug(o['name']),str(o['p'])+' games, '+o['first'][:4]+'–'+o['last'][:4],[]])
for x in seasons: search.append([x['title'],'season','/results/?season='+str(x['y']),' · '.join(str(v) for v in (x['div'],x['pos']) if v),[]])
for t,u,a in [('Timeline','/timeline/',['history','decades']),('Every result','/results/',['results','fixtures']),('Every season','/seasons/',['seasons','league']),('Honours','/honours/',['trophies','titles','cups']),('Records','/records/',[]),('Kits','/kits/',['shirts','hoops']),('Squad','/squad/',[]),('Old Firm explorer','/oldfirm/',['old firm','derby','rangers'])]: search.append([t,'page',u,'',a])
json.dump(search,open('site/search.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump({'archive':{'date':today,'note':f"{len(matches)} matches to {matches[-1]['d']}"}},open('site/status.json','w'))
# ---- first-team squad from the club article (fallback until the feed answers; also gives Wikipedia links)
sq=[]; ca=ct[ct.find('===First-team squad==='):ct.find('===Out on loan===')]
POSN={'GK':'Goalkeeper','DF':'Defender','MF':'Midfielder','FW':'Attacker'}; pslug={p['slug'] for p in players}
for m in re.finditer(r'\{\{\s*Fs player\s*\|(.*?)\}\}',ca,re.S|re.I):
    f=dict(x.split('=',1) for x in re.split(r'\|(?![^\[]*\]\])',m.group(1)) if '=' in x); f={k.strip():v.strip() for k,v in f.items()}
    lk=re.search(r'\[\[([^\]|]+)(?:\|([^\]]*))?\]\]',f.get('name','')); 
    if not lk: continue
    nm=(lk.group(2) or lk.group(1)).strip(); wk=lk.group(1).strip(); sl=slug(bare(wk))
    sq.append(dict(n=int(f['no']) if f.get('no','').isdigit() else None,name=nm,pos=POSN.get(f.get('pos','').upper(),''),nat=f.get('nat',''),wiki=wk.replace(' ','_'),slug=sl if sl in pslug else None,cap=1 if re.search(r'captain',f.get('other',''),re.I) else 0))
json.dump(sq,open('site/squad.json','w'),ensure_ascii=False,separators=(',',':'))
# ---- timeline: every trophy, lost final, manager, record and first, from the archive; club events from the club article
TL=[]; CN={'LG':'League title','SC':'Scottish Cup','LC':'League Cup','EC':'European Cup'}
HN={'League Championship':'LG','Scottish League Cup':'LC','Scottish Cup':'SC','Champions League':'EC','European Cup':'EC'}
def fin(m): r=(m.get('r') or '').lower(); return bool(re.search(r'\bfinal\b',r)) and not re.search(r'semi|quarter|qualif',r)
for h in honours:
    c=next((v for k,v in HN.items() if k.lower() in h['name'].lower()),None)
    if not c: continue
    for ss in h['seasons']:
        y=int(ss[:4]); d=None; m0=None
        if c!='LG':
            F=[m for m in matches if m['c']==c and m['y']==y and fin(m) and (m['gf']>m['ga'] or m.get('pw')==1)]
            if F: m0=F[-1]; d=m0['d']
        if not d:
            L=[m for m in matches if m['c']=='LG' and m['y']==y]; d=L[-1]['d'] if L else f"{y+1}-05-01"
        e=dict(d=d,t='trophy',c=c,h=CN[c]+' '+ss.replace('-','–'),s=y)
        if m0: e['m']={k:m0[k] for k in ('o','gf','ga','v','pw','h') if k in m0}
        TL.append(e)
# runs of league titles
lg=sorted(int(x[:4]) for h in honours if 'League Championship' in h['name'] for x in h['seasons']); run=[]
for y in lg+[None]:
    if run and y==run[-1]+1: run.append(y); continue
    if len(run)>=4:
        L=[m for m in matches if m['c']=='LG' and m['y']==run[-1]]
        TL.append(dict(d=(L[-1]['d'] if L else f"{run[-1]+1}-05-01"),t='record',h=f"{len(run)} league titles in a row",p=f"Every title from {run[0]}–{str(run[0]+1)[-2:]} to {run[-1]}–{str(run[-1]+1)[-2:]}."))
    run=[y] if y else []
for m in matches:
    if m['c'] in ('SC','LC','EC','EL','CWC','FC') and fin(m) and (m['gf']<m['ga'] or m.get('pw')==0):
        TL.append(dict(d=m['d'],t='final',h={'SC':'Scottish Cup','LC':'League Cup','EC':'European Cup','EL':'UEFA Cup','CWC':"Cup Winners' Cup",'FC':'Fairs Cup'}[m['c']]+' final lost',m={k:m[k] for k in ('o','gf','ga','v','pw','h') if k in m}))
seen_mg=set()
for x in MAN:
    if not x['fromd']: continue
    TL.append(dict(d=x['fromd'],t='manager',h=x['name']+(' takes charge as caretaker' if x['care'] else ' appointed manager'),u='/manager/?m='+x['slug']))
def ev_m(m,t,h,p=''): TL.append(dict(d=m['d'],t=t,h=h,p=p,m={k:m[k] for k in ('o','gf','ga','v','pw','h') if k in m}))
ev_m(matches[0],'match','First competitive game')
ev_m([m for m in matches if m['c']=='LG'][0],'match','First Scottish League game')
ev_m([m for m in matches if m['c'] in('EC','EL','CWC','FC')][0],'match','First European tie')
ev_m(records['wins'][0],'record','Record win')
ev_m(records['defeats'][0],'record','Record defeat')
u=records['runs']['Unbeaten']; TL.append(dict(d=u['to'],t='record',h=f"{u['n']} games unbeaten",p=f"The longest unbeaten run in the major competitions, from {u['from']}."))
att=max((m for m in matches if m.get('att')),key=lambda m:m['att']); ev_m(att,'record','Biggest crowd on record',f"{att['att']} at {att['v']}.")
W='https://en.wikipedia.org/wiki/Celtic_F.C.'
TL+= [dict(d='1887-11-06',t='club',h='Celtic founded',p='Formed in the East End of Glasgow to relieve poverty among the Irish community.',src=W),
      dict(d='1903-08-15',t='club',h='The green and white hoops',p='Celtic adopt the hooped shirt, worn ever since.',src=W,dy=1)]
TL.sort(key=lambda e:e['d'])
json.dump(TL,open(OUT+'timeline.json','w'),ensure_ascii=False,separators=(',',':'))
print('timeline',len(TL),collections.Counter(e['t'] for e in TL))
# ---- the season behind each shirt: managers, top scorer, trophies, one defining result
won={}
for h in honours:
    for ss in h['seasons']: won.setdefault(int(ss[:4]),[]).append(h['name'])
SNAME={x['y']:x for x in seasons}; story={}
PRI={'EC':0,'EL':1,'CWC':1,'SC':2,'LC':3,'OTH':4}
for y in sorted(set(m['y'] for m in matches)):
    L=[m for m in matches if m['y']==y]; M2=[m for m in L if m['c'] in MAJOR]
    mg=[]; [mg.append((m['mn'],m.get('ms'))) for m in L if m.get('mn') and (m['mn'],m.get('ms')) not in mg]
    S=SNAME.get(y,{}); top=None
    if S.get('top'): top=dict(n=S['top'],g=S.get('topg'),src='list')
    else:
        gs=sum(m['gf'] for m in M2); kn=collections.Counter(x[0] for m in M2 for x in m.get('sc',[]) if x[0]!='Own goal')
        if gs and kn and sum(kn.values())>=0.9*gs: n,g=kn.most_common(1)[0]; top=dict(n=n,g=g,src='archive')
    key=None
    F=[m for m in M2 if fin(m) and (m['gf']>m['ga'] or m.get('pw')==1)]
    if F: m=sorted(F,key=lambda m:PRI.get(m['c'],9))[0]; key=dict(m,why=m['t']+' final won')
    else:
        R=[m for m in M2 if m['o']=='Rangers' and m['gf']>m['ga']]
        if R: m=max(R,key=lambda m:(m['gf']-m['ga'],m['gf'])); key=dict(m,why='Biggest win over Rangers')
        elif M2:
            m=max(M2,key=lambda m:(m['gf']-m['ga'],m['gf'])); key=dict(m,why='Biggest win' if m['gf']>m['ga'] else 'Best result')
    if key: key={k:key[k] for k in ('d','c','t','o','h','gf','ga','pw','v','r','why') if k in key}
    story[y]=dict(mg=[dict(n=n,s=sl) for n,sl in mg],top=top,won=won.get(y,[]),div=S.get('div',''),pos=S.get('pos',''),key=key,p=len(M2),w=sum(m['gf']>m['ga'] for m in M2),d=sum(m['gf']==m['ga'] for m in M2),l=sum(m['gf']<m['ga'] for m in M2))
json.dump(story,open(OUT+'season_story.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(otd,open(OUT+'otd.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(honours,open(OUT+'honours.json','w'),ensure_ascii=False,separators=(',',':'))
for n,d in dict(matches=matches,opponents=opponents,players=players,managers=managers,player_goals=player_goals,records=records,seasons=seasons).items():
    json.dump(d,open(f'{OUT}{n}.json','w'),ensure_ascii=False,separators=(',',':'))
os.makedirs('tools/data',exist_ok=True)
open('tools/data/reconcile.txt','w').write('\n'.join(REC)+'\n')
print('rangers league',len([m for m in matches if m['o']=='Rangers' and m['c']=='LG']),'(Wikipedia Old Firm table 344)')
print('matches',len(matches),'major',len(M),'dropped dup',dropped,'| league seasons agree',agree,'differ',diff,'| opponents ok',chk,'| players',len(players),'listed',len(LIST),'| managers',len(managers))
print('all',records['all']); print('cov',records['coverage']['byDecade'])
