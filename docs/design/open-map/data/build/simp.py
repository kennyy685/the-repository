import json,os,collections,math
def rdp(pts,eps):
    if len(pts)<3: return pts
    keep=[False]*len(pts);keep[0]=keep[-1]=True;st=[(0,len(pts)-1)]
    while st:
        a,b=st.pop();ax,ay=pts[a];bx,by=pts[b];dx,dy=bx-ax,by-ay;L=math.hypot(dx,dy) or 1e-12
        m=-1;mi=-1
        for i in range(a+1,b):
            px,py=pts[i];d=abs(dy*(px-ax)-dx*(py-ay))/L
            if d>m:m,mi=d,i
        if m>eps: keep[mi]=True;st+=[(a,mi),(mi,b)]
    return [p for p,k in zip(pts,keep) if k]
def ringrdp(r,eps):
    h=len(r)//2
    if h<2: return r
    return rdp(r[:h+1],eps)[:-1]+rdp(r[h:],eps)
d=json.load(open('base.json'))
out=[]
# chain streams by name
streams=collections.defaultdict(list)
for f in d['features']:
    k=f['properties']['k']
    if k=='stream': streams[(f['properties']['n'],f['properties']['w'])].append([tuple(p) for p in f['geometry']['coordinates']]);continue
    if k=='water':
        rr=[ringrdp(r,0.00032) for r in f['geometry']['coordinates']]
        rr=[r for r in rr if len(r)>=4]
        if not rr: continue
        f['geometry']['coordinates']=rr
    out.append(f)
def chain(L):
    ends=collections.defaultdict(list)
    for i,s in enumerate(L): ends[s[0]].append(i); ends[s[-1]].append(i)
    used=[False]*len(L);res=[]
    for i in range(len(L)):
        if used[i]:continue
        used[i]=True;cur=list(L[i])
        for _ in (0,1):
            while True:
                t=cur[-1];n=next((j for j in ends[t] if not used[j]),None)
                if n is None:break
                used[n]=True;s=L[n];cur+=s[1:] if s[0]==t else s[::-1][1:]
            cur.reverse()
        res.append(cur)
    return res
for (n,w),L in streams.items():
    for c in chain(L):
        c=rdp(c,0.00012 if w else 0.0003)
        if w==0 and len(c)<3: continue
        out.append({'type':'Feature','geometry':{'type':'LineString','coordinates':[list(p) for p in c]},'properties':{'k':'stream','n':n,'w':w}})
d['features']=out
json.dump(d,open('base.json','w'),separators=(',',':'))
c=collections.Counter()
for f in out: c[f['properties']['k']]+=len(json.dumps(f['geometry'],separators=(',',':')))
print(c,os.path.getsize('base.json'))
