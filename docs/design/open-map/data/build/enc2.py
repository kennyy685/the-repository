import json,os,collections
S=1e5/2; OX,OY=-96.95,40.72
HW={'Interstate','Freeway','Expressway','Ramp'}
ART={'Federal','Primary','Major Arterial','Minor Arterial','Other Arterial','SECONDARY'}
COL={'Collector','Major Collector','Minor Collector'}
cls=lambda c:0 if c in HW else 1 if c in ART else 2 if c in COL else 3
st=json.load(open('Street_Centerlines.json'))
segs=collections.defaultdict(list)
for f in st:
    c=cls(f['attributes']['ST_CLASS'])
    for p in f['geometry']['paths']:
        q=[]
        for x,y in p:
            t=(round((x-OX)*S),round((y-OY)*S))
            if not q or q[-1]!=t: q.append(t)
        if len(q)>=2: segs[c].append(q)
def chain(L):
    ends=collections.defaultdict(list)
    for i,s in enumerate(L): ends[s[0]].append(i); ends[s[-1]].append(i)
    used=[False]*len(L); out=[]
    for i in range(len(L)):
        if used[i]: continue
        used[i]=True; cur=list(L[i])
        for direction in (0,1):
            while True:
                tail=cur[-1]; nxt=None
                for j in ends[tail]:
                    if not used[j]: nxt=j;break
                if nxt is None: break
                used[nxt]=True; s=L[nxt]
                cur+= s[1:] if s[0]==tail else s[::-1][1:]
            cur.reverse()
        out.append(cur)
    return out
def enc(q):
    o=[q[0][0],q[0][1]]
    for a,b in zip(q,q[1:]): o+=[b[0]-a[0],b[1]-a[1]]
    return o
t=[[enc(q) for q in chain(segs[i])] for i in range(4)]
json.dump({'o':[OX,OY],'s':S,'t':t,'src':'Nebraska GIS Street_Centerlines (gis.ne.gov), simplified ~7 m'},open('streets.json','w'),separators=(',',':'))
print([len(x) for x in t],os.path.getsize('streets.json'))
