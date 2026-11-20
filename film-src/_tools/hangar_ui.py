import sys,os,numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
S=sys.argv[1]; O=sys.argv[2]; P=sys.argv[3]; os.makedirs(O,exist_ok=True)
def cut(f):
    a=np.asarray(Image.open(f).convert('RGB')).astype(np.float32); r,g,b=a[...,0],a[...,1],a[...,2]
    # magenta-ness: how much g is below min(r,b)
    m=np.clip((np.minimum(r,b)-g-40)/80,0,1)*((r>120)&(b>120))
    fg=1-m; fgb=ndi.binary_opening(fg>0.5,iterations=2); lab,n=ndi.label(fgb)
    if n: sz=ndi.sum(fgb,lab,range(1,n+1)); keep=np.zeros(n+1,bool); keep[1:]=sz>0.02*sz.max(); fgm=keep[lab]
    else: fgm=fgb
    fgm=ndi.binary_fill_holes(fgm)
    al=np.asarray(Image.fromarray((fgm*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32)/255
    # despill magenta at edges
    edge=al<0.99; r2=np.where(edge,np.minimum(r,g+60),r); b2=np.where(edge,np.minimum(b,np.maximum(g+80,r*0.9)),b)
    out=np.dstack([r2,g,b2,al*255]).clip(0,255).astype(np.uint8)
    ys,xs=np.where(al>0.05); out=out[ys.min():ys.max()+1,xs.min():xs.max()+1]
    return Image.fromarray(out,'RGBA')
for n,maxw in [('ui_odznaka',512),('ui_panel',1200),('ui_przycisk',800),('ui_przycisk2',800),('ui_tabliczka',800)]:
    im=cut(os.path.join(S,n+'.webp')); im.thumbnail((maxw,maxw)); im.save(os.path.join(O,n.replace('ui_','')+'.webp'),quality=90,method=6); print(n,im.size)
# mission icons
badge=cut(os.path.join(S,'ui_odznaka.webp')); badge=badge.resize((512,int(512*badge.height/badge.width)),Image.LANCZOS)
groups={'ch1-m1':['01_tulow'],'ch1-m2':['02_glowa'],'ch1-m3':['03_miednica'],'ch1-m4':['04_udo_L','05_udo_P'],'ch1-m5':['06_golen_L','07_golen_P'],'ch1-m6':['08_ramie_L','09_przedramie_L'],'ch1-m7':['10_ramie_P','11_przedramie_P']}
os.makedirs(os.path.join(O,'ikony'),exist_ok=True)
def icon(parts_imgs,name):
    c=badge.copy(); inner=int(c.width*0.52)
    n=len(parts_imgs); gap=8; ws=[]
    for p in parts_imgs: p.thumbnail((inner//n-gap, inner)); ws.append(p)
    tw=sum(p.width for p in ws)+gap*(n-1); x=(c.width-tw)//2
    for p in ws: c.alpha_composite(p,(x,(c.height-p.height)//2)); x+=p.width+gap
    c.resize((256,int(256*c.height/c.width)),Image.LANCZOS).save(os.path.join(O,'ikony',name+'.webp'),quality=90)
for k,ps in groups.items(): icon([Image.open(os.path.join(P,'czesci',p+'.webp')).convert('RGBA') for p in ps],k)
s12=Image.open(os.path.join(P,'stan_12_aktywny.webp')).convert('RGBA'); W,H=s12.size
icon([s12.crop((int(W*0.28),int(H*0.02),int(W*0.72),int(H*0.40)))],'ch1-m8')
print('ok')
