import sys, os, json, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
SRC=sys.argv[1]; OUT=sys.argv[2]; os.makedirs(OUT,exist_ok=True)
def load(n):
    for ext in ('.png','.jpg','.webp'):
        f=os.path.join(SRC,n+ext)
        if os.path.exists(f): return np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
    raise FileNotFoundError(n)
def keybg(a):
    r,g,b=a[...,0],a[...,1],a[...,2]
    mag=(r>90)&(b>90)&(g<0.62*np.minimum(r,b))
    return mag
def clean(m,o=3,c=5):
    m=ndi.binary_opening(m,iterations=o); m=ndi.binary_closing(m,iterations=c)
    lab,n=ndi.label(m)
    if n==0: return m
    sz=ndi.sum(m,lab,range(1,n+1)); keep=np.zeros(n+1,bool); keep[1:]=sz>4000
    return keep[lab]
base=load('stan_11'); robot=~keybg(base); robot=ndi.binary_fill_holes(clean(robot,1,2))
from PIL import ImageDraw
Hh,Ww=robot.shape
def P(pts):
    im=Image.new('L',(Ww,Hh),0); ImageDraw.Draw(im).polygon([(x*2,y*2) for x,y in pts],fill=1); return np.asarray(im).astype(bool)
yy=np.arange(Hh)[:,None]*np.ones((1,Ww))
armR=P([(40,215),(297,215),(297,505),(250,520),(238,700),(212,830),(40,830)])&robot
armL=P([(551,215),(810,215),(810,830),(636,830),(610,700),(598,520),(551,505)])&robot
pel=P([(300,503),(550,503),(546,560),(482,582),(472,668),(376,668),(366,582),(304,560)])&robot
legR=P([(180,548),(366,560),(376,668),(424,668),(424,1210),(180,1210)])&robot&~pel&~armR
legL=P([(424,668),(472,668),(482,560),(670,548),(670,1210),(424,1210)])&robot&~pel&~armL
head=P([(320,0),(530,0),(530,200),(512,236),(338,236),(320,200)])&robot
M={'arm_r':armR,'forearm_r':armR&(yy>880),'arm_l':armL,'forearm_l':armL&(yy>880),'leg_r':legR,'shin_r':legR&(yy>1540),'leg_l':legL,'shin_l':legL&(yy>1540),'pelvis':pel|legR|legL,'head':head}
arms=M['arm_r']|M['arm_l']; legs=M['leg_r']|M['leg_l']
stages={10:M['forearm_r'],9:M['arm_r'],8:M['arm_r']|M['forearm_l'],7:arms,6:arms|M['shin_r'],5:arms|M['shin_r']|M['shin_l'],4:arms|M['shin_l']|M['leg_r'],3:arms|legs,2:arms|M['pelvis'],1:arms|M['pelvis']|M['head']}
parts={'01_tulow':robot&~(arms|M['pelvis']|M['head']),'02_glowa':M['head'],'03_miednica':M['pelvis']&~legs,'04_udo_L':M['leg_l']&~M['shin_l'],'05_udo_P':M['leg_r']&~M['shin_r'],'06_golen_L':M['shin_l'],'07_golen_P':M['shin_r'],'08_ramie_L':M['arm_l']&~M['forearm_l'],'09_przedramie_L':M['forearm_l'],'10_ramie_P':M['arm_r']&~M['forearm_r'],'11_przedramie_P':M['forearm_r']}
ys,xs=np.where(robot); y0,y1,x0,x1=ys.min(),ys.max(),xs.min(),xs.max()
H=y1-y0; pad=int(H*0.04); y0-=pad; y1+=pad; cx=(x0+x1)/2; w=(y1-y0)*1024/1536; x0=int(cx-w/2); x1=int(cx+w/2)
def despill(rgb,alpha):
    r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]; lim=np.maximum(g*1.25,np.minimum(r,b)*0.0+g)
    edge=(alpha<1)
    r2=np.where(edge,np.minimum(r,np.maximum(g,b*0.6)+40),r); b2=np.where(edge,np.minimum(b,np.maximum(g,r*0.6)+40),b)
    return np.stack([r2,g,b2],-1)
def save(rgb,mask,name,feather=1.2):
    a=Image.fromarray((mask*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather))
    a=np.asarray(a).astype(np.float32)/255
    a=np.where(mask,np.maximum(a,0.5),a)*(ndi.binary_dilation(mask,iterations=2))
    rgb=despill(rgb,a)
    im=np.dstack([np.clip(rgb,0,255),a*255]).astype(np.uint8)
    canvas=np.zeros((y1-y0,x1-x0,4),np.uint8)
    sy0,sx0=max(0,y0),max(0,x0); sy1,sx1=min(im.shape[0],y1),min(im.shape[1],x1)
    canvas[sy0-y0:sy1-y0,sx0-x0:sx1-x0]=im[sy0:sy1,sx0:sx1]
    Image.fromarray(canvas,'RGBA').resize((1024,1536),Image.LANCZOS).save(os.path.join(OUT,name+'.webp'),quality=90,method=6)
order=list(parts.keys())
acc=np.zeros_like(robot)
for k,name in enumerate(order,1):
    acc=acc|parts[name]; save(base,acc,'stan_%02d'%k)
save(base,parts['02_glowa'],'stan_01_glowa')
# stan_00: hologram outline
edge=robot&~ndi.binary_erosion(robot,iterations=4)
holo=np.zeros_like(base); holo[...]=[60,230,220]
a=np.where(edge,0.9,np.where(robot,0.18,0))
im=np.dstack([holo,a*255]).astype(np.uint8)
canvas=np.zeros((y1-y0,x1-x0,4),np.uint8); sy0,sx0=max(0,y0),max(0,x0); sy1,sx1=min(im.shape[0],y1),min(im.shape[1],x1)
canvas[sy0-y0:sy1-y0,sx0-x0:sx1-x0]=im[sy0:sy1,sx0:sx1]
Image.fromarray(canvas,'RGBA').resize((1024,1536),Image.LANCZOS).save(os.path.join(OUT,'stan_00.webp'),quality=90)
if any(os.path.exists(os.path.join(SRC,'stan_12_src'+e)) for e in ('.png','.webp')):
    s12=load('stan_12_src'); save(s12,robot,'stan_12_aktywny')
# parts
pd=os.path.join(OUT,'czesci'); os.makedirs(pd,exist_ok=True); info={}
for k,m in parts.items():
    ys,xs=np.where(m)
    if len(ys)==0: print('EMPTY',k); continue
    yy0,yy1,xx0,xx1=ys.min()-8,ys.max()+8,xs.min()-8,xs.max()+8
    a=np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)/255
    im=np.dstack([despill(base,a),a*255]).clip(0,255).astype(np.uint8)[max(0,yy0):yy1,max(0,xx0):xx1]
    I=Image.fromarray(im,'RGBA'); I.thumbnail((512,512),Image.LANCZOS); I.save(os.path.join(pd,k+'.webp'),quality=90,method=6)
    info[k]={'px':int(m.sum())}
print(json.dumps(info))
