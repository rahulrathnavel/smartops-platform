import re, sys, os

# Service name -> port mapping
services = {
    'api-gateway.yaml': '3000',
    'user-service.yaml': '3001',
    'catalog-service.yaml': '3002',
    'cart-service.yaml': '3003',
    'payment-service.yaml': '3004',
    'order-service.yaml': '3005',
    'frontend.yaml': None,  # No metrics for nginx frontend
}

base = r'r:\zzz_last_smartops\e-commerce-base\k8s\services'

for fname, port in services.items():
    if port is None:
        continue
    fpath = os.path.join(base, fname)
    with open(fpath, 'r') as f:
        content = f.read()
    
    # Add annotations after "labels:\n        app: <service>"
    # Find the template metadata section
    old = '    metadata:\n      labels:\n        app:'
    if old not in content:
        print(f"SKIP {fname}: pattern not found")
        continue
    
    # Find the app name from the labels line
    match = re.search(r'  template:\n    metadata:\n      labels:\n        app: (\S+)', content)
    if not match:
        print(f"SKIP {fname}: no match")
        continue
    
    app_name = match.group(1)
    old_block = f'  template:\n    metadata:\n      labels:\n        app: {app_name}'
    new_block = f'  template:\n    metadata:\n      annotations:\n        prometheus.io/scrape: "true"\n        prometheus.io/port: "{port}"\n        prometheus.io/path: "/metrics"\n      labels:\n        app: {app_name}'
    
    if 'prometheus.io/scrape' in content:
        print(f"SKIP {fname}: already has annotations")
        continue
    
    content = content.replace(old_block, new_block, 1)
    with open(fpath, 'w') as f:
        f.write(content)
    print(f"OK {fname}: added prometheus annotations (port {port})")
