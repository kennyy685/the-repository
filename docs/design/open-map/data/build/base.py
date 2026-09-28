import json,os,math,collections
R=lambda v:round(v,4)
def rings(g): return g.get('rings') or []
def paths(g): return g.get('paths') or []
def cl(pts):
    o=[]
    for x,y in pts:
        p=[R(x),R(y)]
        if not o or o[-1]!=p: o.append(p)
    return o
F=lambda geom,props:{'type':'Feature','geometry':geom,'properties':props}
feats=[]
# counties -> outlines
for f in json.load(open('County_Boundaries.json')):
    a=f['attributes'];nm=a.get('NAME') or a.get('CNTY_NAME') or a.get('County') or ''
    for r in rings(f['geometry']): feats.append(F({'type':'LineString','coordinates':cl(r)},{'k':'county','n':nm}))
# towns
for f in json.load(open('Municipal_Boundaries.json')):
    a=f['attributes']
    rr=[cl(r) for r in rings(f['geometry']) if len(r)>3]
    if rr: feats.append(F({'type':'Polygon','coordinates':rr},{'k':'town','n':a['NAME'],'a':round((a['ALAND'] or 0)/1e6,2)}))
# water areas
for f in json.load(open('River_Area.json')):
    rr=[cl(r) for r in rings(f['geometry']) if len(r)>3]
    if rr: feats.append(F({'type':'Polygon','coordinates':rr},{'k':'water'}))
for f in json.load(open('Waterbodies.json')):
    a=f['attributes']
    if (a['AreaSqKm'] or 0)<0.06: continue
    rr=[cl(r) for r in rings(f['geometry']) if len(r)>3]
    if rr: feats.append(F({'type':'Polygon','coordinates':rr},{'k':'water'}))
BIG={'Missouri River':3,'Platte River':3,'Elkhorn River':2,'Salt Creek':1,'Wahoo Creek':1,'Big Papillion Creek':1,'Little Papillion Creek':1,'West Papillion Creek':1,'Rawhide Creek':1,'Weeping Water Creek':1,'Pebble Creek':1}
for f in json.load(open('Major_Streams.json')):
    n=(f['attributes']['GNIS_Name'] or '').strip()
    if not n: continue
    for p in paths(f['geometry']): feats.append(F({'type':'LineString','coordinates':cl(p)},{'k':'stream','n':n,'w':BIG.get(n,0)}))
for f in json.load(open('Railroads.json')):
    for p in paths(f['geometry']): feats.append(F({'type':'LineString','coordinates':cl(p)},{'k':'rail'}))
for f in json.load(open('Highways.json')):
    a=f['attributes'];t=a['HwyType'];lab=(a['HwyLabel'] or '').strip()
    if t not in ('I','US','N'): continue
    for p in paths(f['geometry']): feats.append(F({'type':'LineString','coordinates':cl(p)},{'k':'hwy','t':t,'n':{'I':'I-','US':'US-','N':'NE-'}[t]+lab.rstrip('R')}))
json.dump({'type':'FeatureCollection','src':'Nebraska GIS (gis.ne.gov): County_Boundaries, Municipal_Boundaries (Census TIGER), River_Area + Waterbodies + Major_Streams (USGS NHD), Railroads, Highways (NDOT). Simplified.','features':feats},open('base.json','w'),separators=(',',':'))
print('base',collections.Counter(f['properties']['k'] for f in feats),os.path.getsize('base.json'))
# homes hexes
KX=111.32*math.cos(41.2*math.pi/180);KY=110.57;S=0.6 # hex radius km
H=collections.Counter()
for x,y,h in json.load(open('blocks.json')):
    X,Y=x*KX,y*KY
    q=(2/3*X)/S; r=(-1/3*X+math.sqrt(3)/3*Y)/S
    # cube round
    cx,cz=q,r;cy=-cx-cz;rx,ry,rz=round(cx),round(cy),round(cz)
    dx,dy,dz=abs(rx-cx),abs(ry-cy),abs(rz-cz)
    if dx>dy and dx>dz: rx=-ry-rz
    elif dy>dz: ry=-rx-rz
    else: rz=-rx-ry
    H[(rx,rz)]+=h
json.dump({'r':S,'kx':KX,'ky':KY,'src':'US Census 2020 blocks, Total_Housing (gis.ne.gov Census_Blocks_2020), summed per 0.6 km hex','h':[[q,r,n] for (q,r),n in H.items()]},open('homes.json','w'),separators=(',',':'))
print('hex',len(H),max(H.values()),os.path.getsize('homes.json'))
