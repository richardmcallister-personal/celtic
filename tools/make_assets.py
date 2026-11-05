#!/usr/bin/env python3
"""Everything visual, from Richard's celtic-assets folder. Usage: make_assets.py <folder>. Run from the repo root.
Writes site/assets (crest sizes, icons, launch images, crests, comps, kits) and site/kits/kits.json. Rewrites the HAS list in site/mu.js."""
import csv,json,os,re,sys
from PIL import Image
src=sys.argv[1].rstrip('/')+'/'; A='site/assets/'
for d in ('crests','comps','kits','kits/t','splash'): os.makedirs(A+d,exist_ok=True)
GREEN=(0,112,60,255)
c=Image.open(src+'celtic/celtic.png').convert('RGBA'); box=c.getbbox(); c=c.crop(box)
def fit(s,pad=0,bg=None,im=None):
    o=Image.new('RGBA',(s,s),bg or (0,0,0,0)); n=s-2*pad; r=(im or c).copy(); r.thumbnail((n,n),Image.LANCZOS); o.alpha_composite(r,((s-r.width)//2,(s-r.height)//2)); return o
fit(540).save(A+'crest.png'); 
for s in (44,88,132): fit(s).save(f'{A}crest-{s}.png')
fit(32).save(A+'favicon-32.png')
w=Image.open(src+'celtic/celtic-white.png').convert('RGBA'); fit(96,im=w.crop(w.getbbox())).save(A+'badge-96.png')
WHITE=(255,255,255,255)
fit(180,14,WHITE).convert('RGB').save(A+'apple-touch-icon.png'); fit(192,14,WHITE).save(A+'icon-192.png'); fit(512,36,WHITE).save(A+'icon-512.png'); fit(512,90,WHITE).save(A+'icon-512-maskable.png')
# iPhone launch images
for wh in (sys.argv[2].split(',') if len(sys.argv)>2 else []):
    if not re.fullmatch(r'\d+x\d+',wh): continue
    W,H=[int(x) for x in wh.split('x')]; o=Image.new('RGB',(W,H),(255,255,255)); r=c.copy(); n=W//2; r.thumbnail((n,n),Image.LANCZOS); o.paste(r,((W-r.width)//2,(H-r.height)//2),r); o.save(f'{A}splash/{wh}.png',optimize=True)
# crests: site slug -> file
NAMES={'hearts':'heart-of-midlothian'}
has=[]
for sub in ('premiership','european-opponents-2026-27'):
    for f in sorted(os.listdir(src+sub)):
        if not f.endswith('.png'): continue
        s=NAMES.get(f[:-4],f[:-4]); fit(128,im=Image.open(src+sub+'/'+f).convert('RGBA')).save(f'{A}crests/{s}.png',optimize=True); has.append(s)
for f in sorted(os.listdir(src+'competitions')):
    if f.endswith('.png'): fit(128,im=Image.open(src+'competitions/'+f).convert('RGBA')).save(f'{A}comps/{f}',optimize=True)
m=open('site/mu.js').read(); m=re.sub(r'var HAS=\[[^\]]*\];','var HAS='+json.dumps(has,separators=(',',':'))+';',m); open('site/mu.js','w').write(m)
# kits
rows=list(csv.DictReader(open(src+'kit-catalogue.csv'))); out=[]; done={}
for r in rows:
    f=r['file']; base=re.sub(r'[^a-z0-9-]','-',os.path.basename(f)[:-4].lower())
    if f.count('/')>1: base=('v-' if 'variants/' in f else 'h-')+base
    if not os.path.exists(src+f): print('missing',f); continue
    im=Image.open(src+f).convert('RGB' if Image.open(src+f).mode!='RGBA' else 'RGBA')
    if base not in done:
        im.save(f'{A}kits/{base}.webp',quality=78,method=5); t=im.copy(); t.thumbnail((240,240),Image.LANCZOS); t.save(f'{A}kits/t/{base}.webp',quality=72,method=5); done[base]=1
    src_host='Historical Football Kits' if 'historicalkits' in r['source_page'] else 'Football Kit Archive'
    out.append(dict(id=base,s=r['season'],c=r['category'],v=r['variant'],d=r['source_date'],il=1 if r['kind'].startswith('historical') else 0,u=r['source_page'],by=src_host,w=int(r['source_width'] or 0),up=1 if r['upscaled']=='True' else 0,g='h' if 'historical-illustrations' in f else 'v' if 'variants' in f else 'm'))
json.dump(out,open('site/kits/kits.json','w'),ensure_ascii=False,separators=(',',':'))
print('kits',len(out),'crests',len(has))
