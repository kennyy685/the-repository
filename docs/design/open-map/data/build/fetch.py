import json,sys,urllib.request,urllib.parse,concurrent.futures as cf,os
B='https://gis.ne.gov/Enterprise/rest/services/%s/FeatureServer/0/query'
BBOX='-96.95,40.72,-95.80,41.70'
def q(svc,params):
    p={'where':'1=1','geometry':BBOX,'geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects','outSR':'4326','f':'json'}
    p.update(params)
    url=B%svc+'?'+urllib.parse.urlencode(p)
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=120) as r: return json.load(r)
        except Exception as e: err=e
    raise err
def ids(svc):
    return sorted(q(svc,{'returnIdsOnly':'true'})['objectIds'])
def grab(svc,fields,off,prec=5,chunk=500):
    oid=ids(svc); print(svc,len(oid),file=sys.stderr)
    chunks=[oid[i:i+chunk] for i in range(0,len(oid),chunk)]
    def one(c):
        return q(svc,{'objectIds':','.join(map(str,c)),'outFields':fields,'geometryPrecision':prec,'maxAllowableOffset':off,'where':''})['features']
    out=[]
    with cf.ThreadPoolExecutor(6) as ex:
        for f in ex.map(one,chunks): out+=f
    json.dump(out,open(svc+'.json','w'))
    print(svc,'done',len(out),os.path.getsize(svc+'.json'),file=sys.stderr)
jobs={'Street_Centerlines':('ST_CLASS,FULL_ST_NM',0.00007),'Highways':('HwyType,HwyLabel',0.0002),'Municipal_Boundaries':('NAME,ALAND',0.0002),
 'River_Area':('GNIS_Name,FType',0.0002),'Major_Streams':('GNIS_Name,FCode',0.0003),'Waterbodies':('GNIS_Name,AreaSqKm,FType',0.0002),'Railroads':('RR',0.0002),'County_Boundaries':('*',0.0005)}
for s in (sys.argv[1:] or jobs): grab(s,*jobs[s])
