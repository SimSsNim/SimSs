#!/usr/bin/env python3
"""glossary 의 각 단어에 미국식 발음기호(ipa)를 채운다. CMU 발음 사전 사용(지문에 나온 형태 그대로).

  pip install cmudict --break-system-packages
  python3 scripts/glossary_ipa.py public/lessons/general/2026-11-13-L3.json [...]

- 이미 ipa 가 있으면 그대로 둔다(--force 면 다시 채움).
- 사전에 없는 단어(고유명사 등)는 null.
- 발음이 여러 개인 단어(read, live …)는 form(과거형 등)으로 고르고, 애매하면 첫 번째.
"""
import json
import sys

import cmudict

V = {"AA": "ɑː", "AE": "æ", "AH": "ʌ", "AO": "ɔː", "AW": "aʊ", "AY": "aɪ", "EH": "ɛ", "ER": "ɜːr", "EY": "eɪ",
     "IH": "ɪ", "IY": "iː", "OW": "oʊ", "OY": "ɔɪ", "UH": "ʊ", "UW": "uː"}
C = {"B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "F": "f", "G": "ɡ", "HH": "h", "JH": "dʒ", "K": "k", "L": "l", "M": "m",
     "N": "n", "NG": "ŋ", "P": "p", "R": "r", "S": "s", "SH": "ʃ", "T": "t", "TH": "θ", "V": "v", "W": "w", "Y": "j",
     "Z": "z", "ZH": "ʒ"}
ONSETS = {"pl", "pr", "bl", "br", "tr", "dr", "kl", "kr", "ɡl", "ɡr", "fl", "fr", "θr", "ʃr", "sp", "st", "sk", "sm", "sn",
          "sl", "sw", "tw", "dw", "kw", "spr", "str", "skr", "spl", "skw", "pj", "bj", "kj", "fj", "mj", "hj", "vj", "dʒ", "tʃ"}
D = cmudict.dict()
# 사전에 없는 단어(레슨에 나온 것)
MANUAL = {
    "unclasped": "/ʌnˈklæspt/", "astrophysicists": "/ˌæstroʊˈfɪzɪsɪsts/", "exoplanets": "/ˈɛksoʊˌplænɪts/",
    "exoplanet": "/ˈɛksoʊˌplænɪt/", "astrophysical": "/ˌæstroʊˈfɪzɪkəl/", "esa": "/ˌiːɛsˈeɪ/",
    "mendicancy": "/ˈmɛndɪkənsi/", "appertaining": "/ˌæpərˈteɪnɪŋ/", "thereunto": "/ˌðɛrʌnˈtuː/",
    "fourscore": "/ˈfɔːrˌskɔːr/", "patel's": "/pəˈtɛlz/", "busan": "/ˈbuːsɑːn/", "brennick": "/ˈbrɛnɪk/",
    "dunmore": "/ˈdʌnmɔːr/", "kwon's": "/kwɑːnz/", "haldane": "/ˈhɔːldeɪn/", "corvane": "/ˈkɔːrveɪn/",
    "expensa": "/ɪkˈspɛnsə/", "intranet": "/ˈɪntrəˌnɛt/",
}


def to_ipa(phones):
    out = []  # (symbol, is_vowel, stress)
    for p in phones:
        base, st = (p[:-1], p[-1]) if p[-1].isdigit() else (p, None)
        if base in V:
            sym = V[base]
            if st == "0":
                sym = {"AH": "ə", "ER": "ər", "IH": "ɪ", "IY": "i", "UW": "u", "AA": "ɑ", "AO": "ɔ"}.get(base, sym)
            out.append((sym, True, st))
        else:
            out.append((C[base], False, None))
    nvow = sum(1 for _, v, _ in out if v)
    res = []
    for i, (sym, isv, st) in enumerate(out):
        if isv and nvow > 1 and st in ("1", "2"):
            mark = "ˈ" if st == "1" else "ˌ"
            # 강세 표시는 음절 앞(앞 자음 묶음 중 영어 첫소리로 가능한 만큼)
            j = len(res)
            cons = []
            while j > 0 and not res[j - 1][1] and res[j - 1][0] not in ("ˈ", "ˌ"):
                cons.insert(0, res[j - 1][0])
                j -= 1
            take = 0
            for k in range(len(cons), 0, -1):
                cl = "".join(cons[-k:])
                if k == 1 or cl in ONSETS:
                    take = k
                    break
            res.insert(len(res) - take, (mark, False))
        res.append((sym, isv))
    return "".join(s for s, _ in res)


def pick(word, form):
    prons = D.get(word)
    if not prons:
        return None
    if len(prons) > 1 and form and ("과거" in form):
        for p in prons:  # read(과거) → R EH1 D
            if any(x.startswith("EH") for x in p):
                return p
    return prons[0]


def ipa_for(key, form=None):
    if key in MANUAL:
        return MANUAL[key]
    parts = []
    for w in key.replace("’", "'").split("-"):
        p = pick(w, form)
        if not p:
            return None
        parts.append(to_ipa(p))
    return "/" + "-".join(parts) + "/"


if __name__ == "__main__":
    force = "--force" in sys.argv
    for path in [a for a in sys.argv[1:] if not a.startswith("--")]:
        s = open(path, encoding="utf-8").read()
        d = json.loads(s)
        n = 0
        for k, g in d.get("glossary", {}).items():
            if g.get("ipa") and not force:
                continue
            g["ipa"] = None if any(ch.isdigit() for ch in k) else ipa_for(k, g.get("form"))
            n += 1
        out = json.dumps(d, ensure_ascii=False, indent=2) + ("\n" if s.endswith("\n") else "")
        open(path, "w", encoding="utf-8").write(out)
        miss = [k for k, g in d.get("glossary", {}).items() if not g.get("ipa")]
        print(f"{path}: {n}개 채움, 없음 {len(miss)}개 {miss[:12]}")
