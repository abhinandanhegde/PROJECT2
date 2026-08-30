import sys

path = r'C:\Users\abhinandan\Desktop\clonefest\T2\frontend\src\app\(dashboard)\bugs\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Remove triageView state line
# 2. Remove triageView filter block
# 3. Remove brain button div, keep just Link

result = []
skip = 0  # lines to skip
in_brain_div = False
brain_div_indent = None

i = 0
while i < len(lines):
    line = lines[i]
    
    # 1. Remove triageView state line
    if 'const [triageView, setTriageView] = useState(false)' in line:
        i += 1
        continue
    
    # 2. Remove triageView filter block
    if 'if (triageView) {' in line:
        # Skip until we find "return filtered"
        i += 1
        while i < len(lines) and 'return filtered' not in lines[i]:
            i += 1
        # Keep the "return filtered" line
        result.append(lines[i])
        i += 1
        continue
    
    # 3. Remove the brain button div
    # The pattern: starts with div containing "flex items-center gap-2 self-start"
    # Ends after the </Link> line
    if 'className="flex items-center gap-2 self-start sm:self-auto">' in line:
        # Skip this div opening
        i += 1
        # Skip everything until we find href="/bugs/new"
        while i < len(lines) and 'href="/bugs/new"' not in lines[i]:
            i += 1
        # Now write the clean Link (replacing the button div wrapper)
        result.append('        <Link\n')
        result.append('          href="/bugs/new"\n')
        result.append('          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-sm shadow-orange-500/20 transition-all self-start sm:self-auto cursor-pointer"\n')
        result.append('        >\n')
        # Skip the old Link opening lines until <span>New Bug</span>
        i += 1  # skip href line
        i += 1  # skip className line  
        # Now we should be at <span>text-base leading-none</span>
        # Write the span contents
        result.append('          <span className="text-base leading-none">+</span>\n')
        result.append('          <span>New Bug</span>\n')
        # Skip until </Link>
        while i < len(lines) and '</Link>' not in lines[i]:
            i += 1
        result.append('        </Link>\n')
        i += 1
        continue
    
    result.append(line)
    i += 1

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(result)

print(f'Done. {len(lines)} -> {len(result)} lines')
