"""Run while `python server.py` is active: python tests/smoke_test.py"""
from pathlib import Path
import json, urllib.request

base='http://127.0.0.1:8899'
here=Path(__file__).resolve().parents[1]

def fetch(path):
    with urllib.request.urlopen(base+path,timeout=10) as r:
        assert r.status==200,(path,r.status)
        return r.read()

html=fetch('/').decode('utf-8')
assert 'AgriVerse' in html and 'PH_PATHS' in html
catalog=json.loads(fetch('/catalog.json'))
assert len(catalog)==98,len(catalog)
workbook=(here/'AgriVerse_Verified_Crop_NASA_Integration.xlsx').read_bytes()
req=urllib.request.Request(base+'/api/import',workbook,headers={'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},method='POST')
with urllib.request.urlopen(req,timeout=10) as r:
    imported=json.load(r)
assert len(imported)==98,len(imported)
assert sum(bool(x.get('verified')) for x in imported)==6
print('PASS: website served, catalog has 98 plants, Excel API imports 98 plants / 6 sourced profiles.')
print('NASA external retrieval intentionally not tested by this local smoke test.')
