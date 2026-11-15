"""AgriVerse SQLite initializer. Run beside server.py: python setup_sqlite.py.
Creates data/agriverse.db. Original files and existing API remain unchanged.
"""
from pathlib import Path
import csv, json, sqlite3, re, hashlib, datetime, sys

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
DB = DATA / 'agriverse.db'


def safe_name(raw):
    cleaned = re.sub(r'[^a-zA-Z0-9_]+', '_', str(raw).strip()).strip('_').lower()
    if not cleaned: cleaned = 'column'
    if cleaned[0].isdigit(): cleaned = 'c_' + cleaned
    return cleaned[:100]


def quote_identifier(v):
    return '"' + v.replace('"', '""') + '"'


def table_for(path):
    p = path.relative_to(DATA).with_suffix('')
    readable = safe_name('_'.join(p.parts))
    digest = hashlib.sha1(str(p).encode()).hexdigest()[:6]
    return 'csv_' + readable[:64] + '_' + digest


def import_csv(conn, path):
    relative = str(path.relative_to(DATA)).replace('\\','/')
    table = table_for(path)
    with path.open('r', encoding='utf-8-sig', errors='replace', newline='') as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header: return table, 0, 'empty'
        names, seen = [], {}
        for index, raw in enumerate(header, 1):
            base = safe_name(raw) or f'column_{index}'
            seen[base] = seen.get(base, 0) + 1
            names.append(base if seen[base] == 1 else f'{base}_{seen[base]}')
        conn.execute(f'DROP TABLE IF EXISTS {quote_identifier(table)}')
        conn.execute('CREATE TABLE '+quote_identifier(table)+' ('+', '.join(quote_identifier(x)+' TEXT' for x in names)+')')
        placeholders = ','.join('?' for _ in names)
        insert = f'INSERT INTO {quote_identifier(table)} VALUES ({placeholders})'
        count, batch = 0, []
        for values in reader:
            if not values or not any(v.strip() for v in values): continue
            values = (values + ['']*len(names))[:len(names)]
            batch.append([v if v.strip() else None for v in values])
            if len(batch)>=2000:
                conn.executemany(insert,batch); count+=len(batch);batch=[]
        if batch: conn.executemany(insert,batch); count+=len(batch)
        conn.execute('INSERT OR REPLACE INTO dataset_registry (path, kind, table_name, rows_imported, bytes, imported_utc, note) VALUES (?,?,?,?,?,?,?)',
                     (relative, 'csv', table, count, path.stat().st_size, datetime.datetime.now(datetime.timezone.utc).isoformat(), 'Source preserved; all imported CSV fields stored as TEXT'))
        return table, count, 'imported'


def main():
    if not DATA.exists(): sys.exit('ERROR: Place setup_sqlite.py beside server.py inside the AgriVerse folder.')
    conn=sqlite3.connect(DB)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('''CREATE TABLE IF NOT EXISTS dataset_registry (
        path TEXT PRIMARY KEY, kind TEXT, table_name TEXT, rows_imported INTEGER,
        bytes INTEGER, imported_utc TEXT, note TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS validation_records (
        field TEXT, barangay TEXT, crop TEXT, value TEXT, status TEXT,
        source TEXT, reviewer TEXT, notes TEXT, updated_utc TEXT,
        PRIMARY KEY (field, barangay, crop))''')
    csv_files=sorted(DATA.rglob('*.csv'))
    print(f'Importing {len(csv_files)} CSV files into {DB.name} ...')
    total=0
    for path in csv_files:
        try:
            conn.execute('SAVEPOINT one_csv')
            table,n,detail=import_csv(conn,path)
            conn.execute('RELEASE one_csv')
            total+=n
            print(f'  {path.relative_to(DATA)}: {n:,} rows')
        except Exception as exc:
            conn.execute('ROLLBACK TO one_csv');conn.execute('RELEASE one_csv')
            print(f'  WARNING: {path.name}: {exc}')
    validation=DATA/'manual_validation.json'
    if validation.exists():
        records=json.loads(validation.read_text(encoding='utf-8')).get('records',[])
        for v in records:
            if isinstance(v,dict):
                cols=['field','barangay','crop','value','status','source','reviewer','notes','updated_utc']
                conn.execute('INSERT OR REPLACE INTO validation_records VALUES (?,?,?,?,?,?,?,?,?)',tuple(str(v.get(k,'')) for k in cols))
        print('Copied manual validation records:',len(records))
    for path in sorted(DATA.rglob('*')):
        if not path.is_file() or path.suffix.lower()=='.csv' or path==DB or path.name.startswith('agriverse.db-'):continue
        rel=str(path.relative_to(DATA)).replace('\\','/')
        conn.execute('INSERT OR REPLACE INTO dataset_registry (path,kind,table_name,rows_imported,bytes,imported_utc,note) VALUES (?,?,?,?,?,?,?)',
             (rel,path.suffix.lower().lstrip('.') or 'file',None,None,path.stat().st_size,datetime.datetime.now(datetime.timezone.utc).isoformat(), 'Indexed only; binary/Excel/JSON source not parsed into SQL rows'))
    conn.commit()
    print(f'\nSUCCESS: {len(csv_files)} CSV files, {total:,} data rows indexed/imported.')
    print('SQLite file:', DB)
    print('Restart the local server to load refreshed SQLite datasets. The website continues to use live JSON review records.')
    conn.close()

if __name__=='__main__': main()
