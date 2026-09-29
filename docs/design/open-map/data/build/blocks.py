import json,urllib.request,urllib.parse,concurrent.futures as cf
B='https://gis.ne.gov/Enterprise/rest/services/Census_Blocks_2020/FeatureServer/0/query'
base={'where':'Total_Housing>0','geometry':'-96.95,40.72,-95.80,41.70','geometryType':'esriGeometryEnvelope','inSR':'4326','f':'json'}
def q(p):
    u=B+'?'+urllib.parse.urlencode({**base,**p})
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=120))
oid=sorted(q({'returnIdsOnly':'true'})['objectIds']);print(len(oid))
ch=[oid[i:i+1000] for i in range(0,len(oid),1000)]
def one(c): return [f['attributes'] for f in q({'objectIds':','.join(map(str,c)),'outFields':'INTPTLAT20,INTPTLON20,Total_Housing','returnGeometry':'false'})['features']]
out=[]
with cf.ThreadPoolExecutor(6) as ex:
    for r in ex.map(one,ch): out+=r
json.dump([[float(a['INTPTLON20']),float(a['INTPTLAT20']),a['Total_Housing']] for a in out],open('blocks.json','w'))
print(len(out),sum(a['Total_Housing'] for a in out))
