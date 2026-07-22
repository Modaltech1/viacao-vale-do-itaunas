from pathlib import Path
from zipfile import ZipFile
from PIL import Image

base = Path('outputs/controle_financeiro_simples')
xlsx = base / 'controle_financeiro_simples.xlsx'
if not xlsx.exists() or xlsx.stat().st_size < 1000:
    raise SystemExit('xlsx ausente')
with ZipFile(xlsx) as z:
    names = set(z.namelist())
    for required in ['xl/workbook.xml', '[Content_Types].xml']:
        if required not in names:
            raise SystemExit(f'faltando {required}')
    xml = ''.join(z.read(n).decode('utf-8', errors='ignore') for n in names if n.endswith('.xml'))
    for token in ['#REF!', '#DIV/0!', '#VALUE!', '#NAME?', '#N/A']:
        if token in xml:
            raise SystemExit(f'erro de fórmula: {token}')
previews = sorted((base / 'previews').glob('*.png'))
if len(previews) < 2:
    raise SystemExit('previews ausentes')
for p in previews:
    im = Image.open(p)
    if im.width < 500 or im.height < 300:
        raise SystemExit(f'preview pequeno {p.name}')
    print(p.name, im.size)
print('OK', xlsx.resolve(), xlsx.stat().st_size)
