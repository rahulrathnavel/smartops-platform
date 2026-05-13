import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

nb = json.load(open(r'r:\zzz_last_smartops\rca_model\smartops-rca(1).ipynb', 'r', encoding='utf-8'))
cells = nb['cells']

for i in [11, 13, 19, 20, 21]:
    src = ''.join(cells[i]['source'])
    print(f"{'='*60}")
    print(f"CELL {i} [{cells[i]['cell_type']}]")
    print(f"{'='*60}")
    print(src)
    print()
