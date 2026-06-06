import re

with open('Unit-1', 'r', encoding='utf-8') as f:
    lines = [line.rstrip('\r\n') for line in f]

# Let's define rules or lists
for idx, line in enumerate(lines):
    # Check if empty
    if not line.strip():
        continue
    
    # We can print lines that look like headings
    # Let's inspect some of them
    if idx < 100:
        print(f"{idx+1}: {line[:60]}")
