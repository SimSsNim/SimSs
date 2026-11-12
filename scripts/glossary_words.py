#!/usr/bin/env python3
"""레슨 지문에서 glossary 에 넣어야 할 단어 key 목록을 뽑는다.

  python3 scripts/glossary_words.py public/lessons/general/2026-11-13-L3.json

출력: 한 줄에 하나씩 `key<TAB>처음 나온 문장 id<TAB>그 문장`.
key 규칙(앱의 wordTokens + wordKey 와 같음): 영문자/숫자 묶음(사이의 ' ’ - 포함),
’ → ', 소문자. 숫자로만 된 토큰(30, 1,900 의 1/900 등)은 빼고 셈.
"""
import json
import re
import sys

TOKEN_RE = re.compile(r"[A-Za-z0-9]+(?:[’'\-][A-Za-z0-9]+)*")


def word_key(t: str) -> str:
    return t.replace("’", "'").replace("‘", "'").lower()


def glossary_keys(data: dict) -> dict:
    """key -> 처음 나온 sentence id (순서 유지)"""
    out: dict = {}
    for s in data["sentences"]:
        for m in TOKEN_RE.finditer(s["en"]):
            k = word_key(m.group())
            if k.isdigit():
                continue
            out.setdefault(k, s["id"])
    return out


if __name__ == "__main__":
    for path in sys.argv[1:]:
        d = json.load(open(path, encoding="utf-8"))
        sen = {s["id"]: s["en"] for s in d["sentences"]}
        for k, sid in glossary_keys(d).items():
            print(f"{k}\t{sid}\t{sen[sid]}")
