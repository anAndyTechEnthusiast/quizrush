import sqlite3
p='c:/webtry/questions.db'
try:
    db=sqlite3.connect(p)
    cur=db.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    print('tables:', [r[0] for r in cur.fetchall()])
except Exception as e:
    print('error', e)
