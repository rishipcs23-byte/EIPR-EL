import zipfile
import xml.etree.ElementTree as ET

namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def get_docx_text(path):
    with zipfile.ZipFile(path) as docx:
        tree = ET.fromstring(docx.read('word/document.xml'))
        paragraphs = []
        for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            # Check if this paragraph has runs
            runs = []
            for r in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r'):
                # Extract text
                text = ''.join(t.text for t in r.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text)
                runs.append(text)
            
            p_text = ''.join(runs)
            paragraphs.append(p_text)
        return paragraphs

if __name__ == '__main__':
    paragraphs = get_docx_text('C:/Users/rishi/Desktop/EIPR/UNIT 1.docx')
    with open('Unit-1-extracted.txt', 'w', encoding='utf-8') as f:
        for p in paragraphs:
            f.write(p + '\n')
    print(f"Extracted {len(paragraphs)} paragraphs.")
