#!/usr/bin/env python3
"""Označí nasazovaný web verzí, aby se otevřené stránky po nasazení samy obnovily.

GitHub Pages posílá všechny soubory s hlavičkou Cache-Control: max-age=600, takže
prohlížeč (hlavně Safari na iPhonu) může ještě až 10 minut po nasazení ukazovat starou
verzi a hlavičky se změnit nedají. Proto se při nasazení spočítá otisk obsahu webu a:

- zapíše se do index.html jako <meta name="build"> a jako ?v=… za styly a skripty
  (nová verze má jiné adresy souborů, takže se nevezmou z cache),
- uloží se do version.json, který si stránka stahuje bez cache a při rozdílu se
  sama načte znovu z adresy ?v=… (modul „nová verze webu“ v docs/assets/app.js).

Otisk se počítá z obsahu, ne z commitu, takže se nemění při pouhé aktualizaci počasí.

Použití: python3 tools/stamp.py <složka webu>   (ve workflow Nasazení webu na kopii docs/)
"""
import hashlib
import json
import os
import re
import sys

SKIP = {'data/weather.json', 'version.json', '.nojekyll'}


def fingerprint(root):
    h = hashlib.sha1()
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if not d.startswith('.git'))
        for name in sorted(files):
            rel = os.path.relpath(os.path.join(dirpath, name), root).replace(os.sep, '/')
            if rel in SKIP or name.startswith('.git'):
                continue
            h.update(rel.encode('utf-8') + b'\0')
            with open(os.path.join(dirpath, name), 'rb') as f:
                h.update(f.read())
    return h.hexdigest()[:10]


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else 'docs'
    path = os.path.join(root, 'index.html')
    with open(path, encoding='utf-8') as f:
        html = f.read()
    if 'name="build"' not in html:
        print('index.html nemá <meta name="build">, nic se neoznačilo.')
        return 1
    ver = fingerprint(root)
    html = re.sub(r'<meta name="build" content="[^"]*">', f'<meta name="build" content="{ver}">', html)
    html = re.sub(r'((?:href|src)=")((?:assets/[^"?]+\.(?:css|js))|data/trip\.js)(?:\?v=[^"]*)?"',
                  lambda m: f'{m.group(1)}{m.group(2)}?v={ver}"', html)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    with open(os.path.join(root, 'version.json'), 'w', encoding='utf-8') as f:
        json.dump({'version': ver}, f)
    print(f'Verze webu {ver}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
