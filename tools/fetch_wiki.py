#!/usr/bin/env python3
"""Download Celtic season articles through this site's Worker into tools/data/wiki/. Incremental: only articles whose revision changed."""
import json,os,sys,time,urllib.parse,urllib.request
BASE=os.environ.get('SITE','https://celtic.richardmcallister.workers.dev'); OUT='tools/data/wiki/'; os.makedirs(OUT,exist_ok=True)
def get(p):
    for a in range(6):
        try:
            r=urllib.request.Request(BASE+p,headers={'user-agent':'celtic-site-build/1.0'})
            return urllib.request.urlopen(r,timeout=40).read().decode()
        except Exception as e:
            err=e; time.sleep(3+a*4)
    raise err
def title(y): return f"{y}–{y+1 if (y+1)%100==0 else str(y+1)[-2:]} Celtic F.C. season"   # 1899–1900, 1999–2000
years=list(range(1888,2027)); rp=OUT+'_revs.json'; revs=json.load(open(rp)) if os.path.exists(rp) else {}
cur={}
for i in range(0,len(years),40):
    cur.update(json.loads(get('/wiki-rev?titles='+urllib.parse.quote('|'.join(title(y) for y in years[i:i+40])))))
    time.sleep(1)
n=m=0
for y in years:
    t=title(y); f=f'{OUT}{y}.wt'; rev=cur.get(t)
    if not rev: print('no article',y); m+=1; continue
    if revs.get(t)==rev and os.path.exists(f): continue
    open(f,'w').write(get(f'/wiki-raw?rev={rev}&title='+urllib.parse.quote(t))); revs[t]=rev; n+=1; time.sleep(1.5)
    json.dump(revs,open(rp,'w'),ensure_ascii=False,indent=0)
LISTS={'seasons':'List of Celtic F.C. seasons','managers':'List of Celtic F.C. managers','players':'List of Celtic F.C. players','records':'List of Celtic F.C. records and statistics','europe':'Celtic F.C. in European football','league-opp':'Celtic F.C. league record by opponent','club':'Celtic F.C.','oldfirm':'Old Firm','wins':'List of Celtic F.C. seasons'}
for k,t in LISTS.items():
    try: open(f'{OUT}{k}.wt','w').write(get('/wiki-raw?title='+urllib.parse.quote(t)))
    except Exception as e: print('no list',k,t,e)
    time.sleep(1.5)
print('fetched',n,'missing',m,'have',len(revs))
