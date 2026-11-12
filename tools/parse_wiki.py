#!/usr/bin/env python3
"""Celtic season articles (tools/data/wiki/<year>.wt) -> tools/data/matches_raw.json. One row per match box or table row, as printed; build_archive.py dedupes and names."""
import glob,json,os,re,sys,datetime
W='tools/data/wiki/'
MONTHS={m:i+1 for i,m in enumerate('january february march april may june july august september october november december'.split())}
def unlink(s):
    s=re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]',r'\1',s); s=re.sub(r"'''?",'',s); return s.strip()
def strip_refs(s):
    s=re.sub(r'<ref[^>]*/>','',s); s=re.sub(r'<ref.*?</ref>','',s,flags=re.S); s=re.sub(r'<!--.*?-->','',s,flags=re.S); return s
def fields(box):
    """Split a template body on top-level pipes."""
    out={},; out=out[0]; depth=0; cur=''; parts=[]
    i=0
    while i<len(box):
        two=box[i:i+2]
        if two in('{{','[['): depth+=1; cur+=two; i+=2; continue
        if two in('}}',']]'): depth-=1; cur+=two; i+=2; continue
        if box[i]=='|' and depth==0: parts.append(cur); cur=''; i+=1; continue
        cur+=box[i]; i+=1
    parts.append(cur)
    for p in parts:
        if '=' in p:
            k,v=p.split('=',1); out[k.strip().lower()]=v.strip()
    return out
def template_end(t,i):
    d=0; n=len(t)
    while i<n:
        if t.startswith('{{',i): d+=1; i+=2; continue
        if t.startswith('}}',i):
            d-=1; i+=2
            if d==0: return i
            continue
        i+=1
    return n
def parse_date(s,year):
    s=strip_refs(s); s=unlink(s)
    m=re.search(r'\{\{\s*(?:start date|dts|date)[^|}]*\|(?:[a-z]+=[a-z]+\|)?(\d{4})\|(\d{1,2})\|(\d{1,2})',s,re.I)
    if m: return '%04d-%02d-%02d'%tuple(int(x) for x in m.groups())
    s=re.sub(r'\{\{[^}]*\}\}','',s)
    m=re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})',s)
    if m and m.group(2).lower()[:3] in [k[:3] for k in MONTHS]:
        mo=[v for k,v in MONTHS.items() if k[:3]==m.group(2).lower()[:3]][0]; return '%04d-%02d-%02d'%(int(m.group(3)),mo,int(m.group(1)))
    m=re.search(r'([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})',s)
    if m and m.group(1).lower()[:3] in [k[:3] for k in MONTHS]:
        mo=[v for k,v in MONTHS.items() if k[:3]==m.group(1).lower()[:3]][0]; return '%04d-%02d-%02d'%(int(m.group(3)),mo,int(m.group(2)))
    m=re.search(r'(\d{4})-(\d{2})-(\d{2})',s)
    if m: return m.group(0)
    # day and month only: the year follows the season
    m=re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)',s)
    if m and m.group(2).lower()[:3] in [k[:3] for k in MONTHS]:
        mo=[v for k,v in MONTHS.items() if k[:3]==m.group(2).lower()[:3]][0]; return '%04d-%02d-%02d'%(year if mo>=7 else year+1,mo,int(m.group(1)))
    return None
def parse_score(s):
    """Returns (a,b,aet,pens) from a printed score such as 2–1, 2–2 (a.e.t.), 1–1 (4–2 pens)."""
    s=strip_refs(s); raw=s
    aet=bool(re.search(r'a\.?e\.?t|\{\{aet|extra',raw,re.I))
    pens=None
    m=re.search(r'\{\{\s*(?:pen|penalty)[^|}]*\|?\s*(\d+)\s*[–\-−:]\s*(\d+)',raw,re.I) or re.search(r'\(?\s*(\d+)\s*[–\-−]\s*(\d+)\s*(?:on\s+)?(?:pens?|penalties|p\b|\(?p\))',raw,re.I) or re.search(r'(?:pens?|penalties|p\.)\D{0,12}(\d+)\s*[–\-−]\s*(\d+)',raw,re.I)
    if m: pens=(int(m.group(1)),int(m.group(2)))
    t=unlink(re.sub(r'\{\{[^}]*\}\}','',raw))
    t=re.sub(r'\[https?://\S+\s*([^\]]*)\]',r'\1',t)
    m=re.search(r'(\d+)\s*(?:–|-|−|&ndash;|\{\{.*?\}\})\s*(\d+)',t)
    if not m:
        m=re.search(r'\{\{\s*score[^|]*\|(\d+)\|(\d+)',raw,re.I)
        if not m: return None
    return int(m.group(1)),int(m.group(2)),aet,pens
GOAL=re.compile(r'\{\{\s*(?:goal|fbgoal|football goal)\s*(\|[^}]*)?\}\}',re.I)
def parse_goals(s):
    """Rows of (name, link target, minutes list, kinds). Links keep the article title, which gives the full name."""
    s=strip_refs(s or '')
    if not s.strip(): return []
    s=re.sub(r'\{\{\s*(?:small|nowrap)\|(.*?)\}\}',r'\1',s,flags=re.S)
    s=re.sub(r'<br\s*/?>|\{\{\s*(?:br|·|\*|nbsp)\s*\}\}|\n\s*\*?|;',' ¦ ',s)
    out=[]
    for part in s.split('¦'):
        part=part.strip(' ,*')
        if not part: continue
        for chunk in re.split(r'(?<=\})\s*,\s*(?=\[\[|[A-Z])',part):
            m=re.search(r'\[\[([^\]|]+)(?:\|([^\]]*))?\]\]',chunk)
            target=m.group(1).strip() if m else None
            disp=(m.group(2) or m.group(1)).strip() if m else None
            if not disp:
                n=re.sub(r'\{\{.*?\}\}|\(.*?\)|\d+\'?|\bo\.?g\.?\b|\bpen\.?\b','',chunk).strip(' ,.\'’')
                disp=n if re.match(r"^[A-Z][\w'’. -]+$",n) else None
                target=None
            if not disp: continue
            mins=[]; kinds=[]
            og=bool(re.search(r'\bo\.?\s?g\.?\b|own goal|\{\{\s*own',chunk,re.I))
            for g in GOAL.finditer(chunk):
                a=(g.group(1) or '').strip('|').split('|'); i=0
                while i<len(a):
                    v=a[i].strip()
                    if re.match(r"^\d+(\+\d+)?'?$",v):
                        k=''
                        if i+1<len(a) and re.match(r'^(p|pen|penalty|o\.?g\.?|og)$',a[i+1].strip(),re.I):
                            k='og' if 'o' in a[i+1].lower() else 'p'; i+=1
                        mins.append(v.rstrip("'")); kinds.append(k or ('og' if og else ''))
                    i+=1
            if not mins:
                ms=re.findall(r"\b(\d{1,3}(?:\+\d+)?)\s*['’′]?",re.sub(r'\[\[.*?\]\]|\{\{.*?\}\}','',chunk))
                n=re.search(r'\((\d+)\)|\b[x×]\s*(\d+)',re.sub(r'\[\[.*?\]\]','',chunk))
                if n: mins=[None]*int(n.group(1) or n.group(2)); kinds=['og' if og else '']*len(mins)
                elif ms: mins=ms; kinds=['p' if re.search(r'\bpen',chunk,re.I) else ('og' if og else '')]*len(ms)
                else: mins=[None]; kinds=['og' if og else '']
            out.append([disp,target,mins,kinds])
    return out
def classify(sec,rnd,year):
    """Competition code and label from the section headings and the round label."""
    s=' / '.join(sec); low=(s+' || '+rnd).lower()
    if re.search(r"friendl|pre-season|preseason|tour\b|testimonial|benefit|exhibition match",low): return 'FR','Friendly'
    r=rnd.lower()
    TAB={'uc':('EL','UEFA Cup'),'sc':('SC','Scottish Cup'),'slc':('LC','League Cup'),'clq':('EC','Champions League'),'cla':('EC','Champions League'),'ucl':('EC','Champions League'),'f':('FR','Friendly'),'cl':('EC','Champions League'),'lc':('LC','League Cup'),'spl':('LG','League')}
    if not sec and r.strip() in TAB: return TAB[r.strip()]
    if 'championsworld' in r or 'championsworld' in low: return 'FR','Friendly'
    if 'anglo-franco' in low or 'exhibition cup' in low or 'clydesdale harrier' in low: return 'OTH','Other cup'
    if re.search(r'friendl',r): return 'FR','Friendly'
    for pat,c,t in [
        (r'intercontinental|world (?:club )?championship','OTH','Intercontinental Cup'),
        (r'uefa super cup|european super cup','OTH','Super Cup'),
        (r'coronation cup','OTH','Coronation Cup'),(r'empire exhibition','OTH','Empire Exhibition Trophy'),
        (r'st\.? mungo','OTH','St Mungo Cup'),(r'victory cup','WAR','Victory Cup'),(r'summer cup','WAR','Summer Cup'),
        (r'drybrough','OTH','Drybrough Cup'),(r'texaco|anglo-scottish','OTH','Texaco / Anglo-Scottish Cup'),(r'dubai|tennents sixes|sixes','OTH','Other cup'),
        (r'charity cup|merchants','CH','Glasgow Charity Cup'),(r'glasgow cup','GC','Glasgow Cup'),
        (r'war\s*fund|war fund shield|navy and army|navy & army|southern league cup|southern league|western (?:league|division)|emergency|inter[- ]city|north eastern|rangers benefit','WAR','Wartime'),
        (r"inter-cities fairs|fairs cup",'FC','Inter-Cities Fairs Cup'),
        (r"cup winners",'CWC',"Cup Winners' Cup"),
        (r"conference league",'ECL','Conference League'),
        (r"europa league",'EL','Europa League'),(r"uefa cup",'EL','UEFA Cup'),
        (r"champions league",'EC','Champions League'),(r"european cup",'EC','European Cup'),
        (r"league cup",'LC','League Cup'),(r"scottish cup|\bsfa cup",'SC','Scottish Cup'),
        (r"play-?off.*division|division.*play-?off",'LG','League play-off'),
        (r"\bspl\b|^table \|\| s?pl",'LG','League'),
        (r"premiership|premier league|premier division|\bspl\b|scottish league|scottish football league|division (?:one|a|1)|first division|football league|league\b|\bsfl\b",'LG','League'),
    ]:
        if re.search(pat,low): return c,t
    return None,s
def boxes(t,year):
    """Walk the article in order, keeping the section stack."""
    out=[]; sec=[]; i=0
    for m in re.finditer(r'^(={2,6})\s*(.*?)\s*\1\s*$|\{\{\s*football box collapsible',t,re.M|re.I):
        if m.start()<i: continue
        if m.group(1):
            d=len(m.group(1)); sec=sec[:max(0,d-2)]+[unlink(strip_refs(m.group(2)))]; continue
        i=template_end(t,m.start()); f=fields(t[m.start()+2:i-2]); rnd=unlink(strip_refs(f.get('round','')))
        out.append((list(sec),rnd,f))
    return out
def team(s):
    s=strip_refs(s); s=re.sub(r'\{\{\s*flag(?:icon|deco)[^}]*\}\}','',s,flags=re.I); s=re.sub(r'\{\{\s*fb[a-z]*\|[^}]*\}\}','',s)
    m=re.search(r'\[\[([^\]|]+)(?:\|([^\]]*))?\]\]',s)
    return (m.group(2) or m.group(1)).strip() if m else unlink(s).strip(), (m.group(1).strip() if m else None)
def rows_from_boxes(t,year):
    rows=[]
    for sec,rnd,f in boxes(t,year):
        a,al=team(f.get('team1','')); b,bl=team(f.get('team2',''))
        ca=bool(re.match(r'^celtic\b(?!.*(?:youth|reserve|\bxi\b|colts))',a,re.I)); cb=bool(re.match(r'^celtic\b(?!.*(?:youth|reserve|\bxi\b|colts))',b,re.I))
        c,lab=classify(sec,rnd,year)
        d=parse_date(f.get('date',''),year); sc=parse_score(f.get('score',''))
        if sc:
            aet=sc[2] or bool(re.match(r'\s*(y|yes|true|1)\b',f.get('aet',''),re.I)); ps=sc[3]
            pm=re.search(r'(\d+)\s*[–\-−:]\s*(\d+)',unlink(strip_refs(re.sub(r'\{\{[^}]*\}\}','',f.get('penaltyscore','')))))
            if pm: ps=(int(pm.group(1)),int(pm.group(2))); aet=True
            sc=(sc[0],sc[1],aet,ps)
        rows.append(dict(y=year,c=c,lab=lab,sec=' / '.join(sec),rnd=rnd,d=d,t1=a,t2=b,ol=(bl if ca else al),ca=ca,cb=cb,s=sc,g1=parse_goals(f.get('goals1','')),g2=parse_goals(f.get('goals2','')),
          st=unlink(strip_refs(f.get('stadium',''))),loc=unlink(strip_refs(f.get('location',''))),att=re.sub(r'\D','',strip_refs(f.get('attendance','')).split('(')[0])[:7],ref=unlink(strip_refs(f.get('referee',''))),rep=(re.search(r'https?://[^\s\]|]+',f.get('report','')) or [None])[0] if f.get('report') else None,src='box'))
    return rows
def rows_from_tables(t,year):
    """2002-04: wikitable rows Date | Venue | Opponents | Score | Competition | Celtic scorers | Report."""
    rows=[]; sec=[]
    i=t.find('!Celtic scorers')
    if i<0: return rows
    tb=t[t.rfind('{|',0,i):]; tb=tb[:tb.find('\n|}')] if '\n|}' in tb else tb
    for r in tb.split('\n|-')[1:]:
        cells=[c[1:] for c in r.split('\n') if c.startswith('|')]
        if len(cells)<5: continue
        cells=[re.sub(r'^\s*align=\w+\s*\|','',c) for c in cells]
        d=parse_date(cells[0],year); ven=unlink(strip_refs(cells[1])).strip()
        opp,ol=team(cells[2]); sc=parse_score(cells[3]); compt=strip_refs(cells[4]); rnd=unlink(compt)
        c,lab=classify([],rnd,year)
        g=parse_goals(re.sub(r'\s*,\s*(?=\[\[|[A-Z])',' <br/>',cells[5])) if len(cells)>5 else []
        home=bool(re.search(r'celtic park|^h$|\(h\)',ven,re.I))
        rows.append(dict(y=year,c=c,lab=lab,sec='table',rnd=rnd,d=d,t1='Celtic' if home else opp,t2=opp if home else 'Celtic',ol=ol,ca=home,cb=not home,s=(sc if home or not sc else (sc[1],sc[0],sc[2],(sc[3][::-1] if sc[3] else None))),g1=g if home else [],g2=[] if home else g,st=ven,loc='',att='',ref='',rep=None,src='table'))
    return rows
if __name__=='__main__':
    allr=[]
    for f in sorted(glob.glob(W+'[0-9]*.wt')):
        y=int(os.path.basename(f)[:4]); t=open(f).read()
        r=rows_from_boxes(t,y)
        if y in (2002,2003,2004): r=r+rows_from_tables(t,y)
        allr+=r
    json.dump(allr,open('tools/data/matches_raw.json','w'),ensure_ascii=False)
    print(len(allr))
