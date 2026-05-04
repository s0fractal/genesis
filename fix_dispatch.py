import os
import re

def process_file(path):
    if not os.path.exists(path):
        return
    with open(path, 'r') as f:
        content = f.read()

    # match `source.dispatch(...);` possibly multiline, up to the `;`
    new_content = re.sub(
        r'(source\.dispatch\([\s\S]*?\);)(?!\s*await new Promise)',
        r'\1 await new Promise(r => setTimeout(r, 0));',
        content
    )

    if new_content != content:
        with open(path, 'w') as f:
            f.write(new_content)

for root, dirs, files in os.walk('tests'):
    for file in files:
        if file.endswith('_test.ts'):
            process_file(os.path.join(root, file))
