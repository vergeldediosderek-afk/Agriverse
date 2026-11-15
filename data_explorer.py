"""Read-only, paginated AgriVerse dataset explorer. Never modifies original source tables."""
import sqlite3, re, math
from contextlib import closing
from pathlib import Path
DB=Path(__file__).resolve().parent/'data'/'agriverse.db'
MAX_PAGE=100

def connect():
    uri = DB.as_uri() + '?mode=ro'
    db = sqlite3.connect(uri, uri=True, timeout=10)
    try:
        db.execute('SELECT name FROM sqlite_master LIMIT 1').fetchone()
    except sqlite3.OperationalError as exc:
        db.close()
        # An extracted, checkpointed copy can have a zero-byte WAL and a
        # shared-memory sidecar that SQLite cannot open from read-only media.
        wal = DB.with_name(DB.name + '-wal')
        if "unable to open database file" not in str(exc) or not wal.exists() or wal.stat().st_size:
            raise
        db = sqlite3.connect(uri + '&immutable=1', uri=True, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA query_only=ON')
    return db

def display_name(s):
    return s.replace('_',' ').strip()

def dtype(col):
    s=col.lower()
    if any(k in s for k in ['_id','psgc','code','flag','status','source','grid_id','yearmonth','url']):return 'text'
    if s in ('year','month','reference_month','valid_years','reference_years','day','doy','gmin','gmax') or re.search(r'(_year|_month|_day|_count|_days|_pct|_mm|_c|_cm|_m|_km|_kg|_g|_mean|_median|_min|_max|_ph|_latitude|_longitude|_lat|_lon|_slope|_elevation|_ndvi|_moisture)$',s):return 'number'
    if s in ('topmn','topmx','tmin','tmax','ropmn','ropmx','rmin','rmax','phopmn','phopmx','phmin','phmax','latopmn','latopmx','altmx','latitude','longitude','rainfall','temperature','ndvi','precipitation'):return 'number'
    return 'text'

def unit(col):
    s=col.lower()
    if any(k in s for k in ['temperature','temp_c','_temp_','t2m']) or s.endswith('_c') or s in ('topmn','topmx','tmin','tmax'):return '°C'
    if 'rain' in s or 'precip' in s or s.endswith('_mm') or s in ('ropmn','ropmx','rmin','rmax'):return 'mm (check source period)'
    if 'ph' in s and ('soil' in s or s in ('phopmn','phopmx','phmin','phmax')):return 'pH'
    if '_pct' in s:return '%'
    if s in ('ndvi','mean_ndvi') or 'ndvi' in s:return 'dimensionless / scaled (check source)'
    if 'moisture' in s:return 'verify source units'
    return ''

def datasets():
    with closing(connect()) as db:
        return [{'file':r['path'],'table':r['table_name'],'rows':r['rows_imported'],'kind':r['kind'],'bytes':r['bytes'],'note':r['note'],'queryable':bool(r['table_name'])} for r in db.execute('SELECT path,table_name,rows_imported,kind,bytes,note FROM dataset_registry ORDER BY path COLLATE NOCASE')]

def columns(conn, table):
    return [r['name'] for r in conn.execute('PRAGMA table_info("'+table.replace('"','""')+'")')]

def rows(table, page=1, size=50, column=None, query='', sort=None, descending=False):
    page=max(1,min(int(page),100000));size=max(1,min(int(size),MAX_PAGE))
    with closing(connect()) as db:
        item=db.execute('SELECT path,table_name,rows_imported,note FROM dataset_registry WHERE table_name=?',(table,)).fetchone()
        if not item:raise ValueError('Dataset not found')
        cols=columns(db,table)
        if not cols:raise ValueError('Dataset has no columns')
        qtable='"'+table.replace('"','""')+'"'
        where='';args=[]
        if query:
            if len(query)>120:raise ValueError('Search too long')
            if column not in cols: raise ValueError('Choose a searchable column')
            where=' WHERE "'+column.replace('"','""')+'" LIKE ? ESCAPE \'\\\''
            args=['%'+query.replace('\\','\\\\').replace('%','\\%').replace('_','\\_')+'%']
        if sort not in cols:sort=cols[0]
        qsort='"'+sort.replace('"','""')+'"'
        if dtype(sort)=='number':
            # Treat nonnumeric strings as NULL instead of CAST's misleading zero.
            expression=f'CASE WHEN trim({qsort}) <> \'\' AND (trim({qsort}) GLOB \'[0-9]*\' OR trim({qsort}) GLOB \'-[0-9]*\' OR trim({qsort}) GLOB \'.[0-9]*\') THEN CAST({qsort} AS REAL) END'
        else:expression=f'{qsort} COLLATE NOCASE'
        order=f' ORDER BY {expression} {"DESC" if descending else "ASC"}, rowid ASC'
        total=db.execute('SELECT COUNT(*) FROM '+qtable+where,args).fetchone()[0]
        result=db.execute('SELECT * FROM '+qtable+where+order+' LIMIT ? OFFSET ?',args+[size,(page-1)*size]).fetchall()
        return {'file':item['path'],'table':table,'columns':[{'name':c,'label':display_name(c),'type':dtype(c),'unit':unit(c)} for c in cols], 'rows':[[v for v in r] for r in result], 'page':page,'page_size':size,'total':total,'pages':(total+size-1)//size,'sort':sort,'descending':bool(descending),'source_note':item['note']}
