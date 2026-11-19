cd "$(dirname "$0")"; D=$(cygpath -m "$PWD")
r(){ "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=4000 --window-size=$2,2796 --screenshot="$D/_$1.png" "file:///$D/$1.html" >/dev/null 2>&1; }
r p1 2580; r p2 2580; for s in s3 s6 s7 s8; do r $s 1290; done
python - <<'P'
from PIL import Image, ImageDraw
def L(p): return Image.open(p).convert('RGB')
p1=L('_p1.png'); p2=L('_p2.png')
out=[p1.crop((0,0,1290,2796)),p1.crop((1290,0,2580,2796)),L('_s3.png'),p2.crop((0,0,1290,2796)),p2.crop((1290,0,2580,2796)),L('_s6.png'),L('_s7.png'),L('_s8.png')]
for i,a in enumerate(out):
    assert a.size==(1290,2796),a.size; a.save('%02d.png'%(i+1))
w,h=430,932;g=24
im=Image.new('RGB',(len(out)*w+(len(out)+1)*g,h+2*g),'#C9CCD1')
for i,a in enumerate(out): im.paste(a.resize((w,h),Image.LANCZOS),(g+i*(w+g) - (g if i in(1,4) else 0),g))
im.save('all.png')
def sheet(imgs,w,g,r,bg,name):
    h=round(w*2796/1290); im=Image.new('RGB',(len(imgs)*w+(len(imgs)+1)*g,h+2*g),bg)
    m=Image.new('L',(w*4,h*4),0); ImageDraw.Draw(m).rounded_rectangle((0,0,w*4-1,h*4-1),r*4,fill=255); m=m.resize((w,h),Image.LANCZOS)
    for i,a in enumerate(imgs): im.paste(a.resize((w,h),Image.LANCZOS),(g+i*(w+g),g),m)
    im.save(name)
sheet(out,335,28,40,'#F3F4F8','split.png'); sheet(out[:3],425,22,45,'#FFFFFF','search3.png')
P
