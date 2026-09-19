#!/usr/bin/env python3
"""第四次优化 1：把词根注释里的「古语考据」去掉。

   词根是拿来记单词的，不是拿来做词源学的。凡是只能告诉你
   「这词来自拉丁 xxx / 希腊 yyy」而拆不出英文里看得见的部件的，整条删掉；
   拆得开的（abs- + tem、melan + chol），只把括号里的古语引证抹掉，
   拆分本身留着。跑完 src/ex3/*.tsv 就地改写。
"""
import glob, os, re, sys

LANG = (r'(?:古典拉丁|中古英语|古英语|古法语|古诺斯语|古北欧语|古斯堪的纳维亚语|'
        r'拉丁|希腊|梵语|法语|意大利语|西班牙语|荷兰语|德语|葡萄牙语|阿拉伯语|中古)')
CITE   = re.compile(r'[，,]\s*' + LANG + r'[^）]*(?=）)')   # （酒，拉丁 temetum） → （酒）
LEAD   = re.compile(r'^\s*' + LANG + r'\s*')                # 开头的语言名
MYTH   = {                                                 # 神话典故不是古语考据，改写保留
    'Iris（希腊虹之女神）': 'Iris（虹之女神）',
    'Narcissus（希腊神话中恋上水中倒影的少年）': 'Narcissus（恋上水中倒影的少年）',
}

def fix(root):
    """→ (新词根, 说明)；新词根为空表示整条删掉。"""
    if root in MYTH:
        return MYTH[root], 'myth'
    if not re.search(LANG, root):
        return root, None
    if LEAD.match(root):
        # 整条就是「某古语 xxx（义）」。有 + 号说明还是能拆的，留着；否则删。
        if '+' in root:
            return LEAD.sub('', CITE.sub('', root)).strip(), 'lead'
        return '', 'drop'
    return CITE.sub('', root).strip(), 'cite'

def main():
    dry = '--dry' in sys.argv
    stat = {'cite': 0, 'lead': 0, 'drop': 0, 'myth': 0}
    for path in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ex3', '*.tsv'))):
        out, changed = [], False
        for line in open(path, encoding='utf-8'):
            parts = line.rstrip('\n').split('§')
            if len(parts) == 4 and parts[3].strip():
                new, why = fix(parts[3])
                if why:
                    stat[why] += 1
                    if new != parts[3]:
                        parts[3] = new
                        line = '§'.join(parts) + '\n'
                        changed = True
            out.append(line)
        if changed and not dry:
            open(path, 'w', encoding='utf-8').writelines(out)
    print(f"删去括号里的古语引证  {stat['cite']} 条")
    print(f"开头是古语但能拆分    {stat['lead']} 条（只删语言名）")
    print(f"神话典故改写          {stat['myth']} 条")
    print(f"整条删掉的词根        {stat['drop']} 条")

main()
