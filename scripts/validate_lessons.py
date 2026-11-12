#!/usr/bin/env python3
"""레슨 JSON 검증 + index.json 생성 (schemaVersion 2).

파일 위치
  public/lessons/general/YYYY-MM-DD-L<레벨>.json          (그날 그 레벨 첫 이야기)
  public/lessons/general/YYYY-MM-DD-L<레벨>-2.json        (두 번째, -3 … -9)
  public/lessons/general/YYYY-MM-DD-L<레벨>-news.json     (뉴스, genre=news. 같은 날 더 있으면 -news2 …)
  public/lessons/toeic/YYYY-MM-DD-L<레벨>-part5.json   (10문제)
  public/lessons/toeic/YYYY-MM-DD-L<레벨>-part6.json   (5문제)
  public/lessons/toeic/YYYY-MM-DD-L<레벨>-part7.json   (3문제)

사용법
  python3 scripts/validate_lessons.py public/lessons/
  python3 scripts/validate_lessons.py public/lessons/ --write-index public/lessons/index.json
  python3 scripts/validate_lessons.py public/lessons/toeic/2026-11-12-L1-part5.json

필요: pip install jsonschema      종료 코드 0 = 통과, 1 = 오류 (CI 배포 차단용)
"""
import json
import re
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:
    sys.exit("jsonschema가 필요합니다: pip install jsonschema")

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = json.loads((ROOT / "lesson.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())

TOL = 15  # 자연스러운 곳에서 끊느라 범위를 조금 넘는 것은 허용
# 단어 수 범위 (레벨별)
WORDS = {
    "general": {1: (100, 150), 2: (150, 200), 3: (200, 250), 4: (250, 300)},
    "news":    {1: (100, 200), 2: (150, 250), 3: (200, 300), 4: (250, 350)},
    "part7":   {1: (100, 150), 2: (150, 200), 3: (200, 250), 4: (250, 300)},
    "part6":   {1: (80, 130), 2: (100, 150), 3: (120, 170), 4: (140, 190)},
    "part5":   {1: (80, 150), 2: (100, 180), 3: (120, 220), 4: (150, 260)},  # 10문장 합계
}
Q_COUNT = {"part5": 10, "part6": 5, "part7": 3}
Q_TYPES = {"part5": "part5-", "part6": "part6-", "part7": "part7-"}
BLANK = "-------"


def kind_of(data):
    if data["track"] == "toeic":
        return data.get("chapter")
    return "news" if data["genre"] == "news" else "general"


def check(path, data):
    errs = []
    for e in sorted(VALIDATOR.iter_errors(data), key=lambda e: list(e.path)):
        loc = "/".join(str(p) for p in e.path) or "(root)"
        errs.append(f"스키마: {loc}: {e.message}")
    if errs:
        return errs

    track, lv, kind = data["track"], data["level"], kind_of(data)

    # 위치와 id
    base = f"{data['date']}-L{lv}"
    if track == "toeic":
        exp_id = base + f"-{data['chapter']}"
        ok = data["id"] == exp_id
    else:
        # 이야기: base, base-2 … base-9 / 뉴스(genre=news): base-news, base-news2 …
        exp_id = base + ("-news(2~9)" if kind == "news" else "(-2~9)")
        sfx = data["id"][len(base):] if data["id"].startswith(base) else None
        ok = sfx is not None and re.fullmatch(r"-news[2-9]?" if kind == "news" else r"(-[2-9])?", sfx) is not None
    if not ok:
        errs.append(f"id는 {exp_id} 이어야 함 (현재 {data['id']})")
    if path.stem != data["id"]:
        errs.append(f"파일명({path.stem})과 id가 다름")
    if path.parent.name != track:
        errs.append(f"폴더({path.parent.name})와 track({track})이 다름")

    lic = data["source"]["license"]
    if track == "general" and lic == "original":
        errs.append("일반 필사는 퍼블릭 도메인 원문만")
    if track == "toeic" and lic != "original":
        errs.append("토익은 직접 쓴 지문만 (license=original)")
    if lic != "original" and not data["source"].get("url"):
        errs.append("원문 링크(source.url) 없음")

    for key in ("paragraphs", "sentences", "vocab", "structures", "grammar", "questions"):
        ids = [x["id"] for x in data.get(key, [])]
        dup = {i for i in ids if ids.count(i) > 1}
        if dup:
            errs.append(f"{key} id 중복: {sorted(dup)}")

    sents = {s["id"]: s for s in data["sentences"]}
    paras = {p["id"]: p for p in data["paragraphs"]}

    order = []
    for p in data["paragraphs"]:
        for sid in p["sentenceIds"]:
            if sid not in sents:
                errs.append(f"{p['id']}: 없는 문장 {sid}")
            elif sents[sid]["paragraphId"] != p["id"]:
                errs.append(f"{sid}.paragraphId가 {p['id']}가 아님")
            order.append(sid)
    if order != [s["id"] for s in data["sentences"]]:
        errs.append("paragraphs.sentenceIds 순서가 sentences 순서와 다름")
    for s in data["sentences"]:
        if s["paragraphId"] not in paras:
            errs.append(f"{s['id']}: 없는 문단 {s['paragraphId']}")
        if s["en"] != s["en"].strip() or "  " in s["en"]:
            errs.append(f"{s['id']}: 앞뒤 공백이나 이중 공백")
        a, b = s.get("audioStartSec"), s.get("audioEndSec")
        if a is not None and b is not None and b <= a:
            errs.append(f"{s['id']}: audioEndSec <= audioStartSec")

    wc = len(" ".join(s["en"] for s in data["sentences"]).split())
    if wc != data["wordCount"]:
        errs.append(f"wordCount {data['wordCount']} != 실제 {wc}")
    lo, hi = WORDS[kind][lv]
    if not (lo - TOL <= wc <= hi + TOL):
        errs.append(f"단어 수 {wc}가 {kind} 레벨 {lv} 범위 {lo}~{hi}(±{TOL}) 밖")

    # 단어
    for v in data["vocab"]:
        s = sents.get(v["sentenceId"])
        if not s:
            errs.append(f"{v['id']}: 없는 문장 {v['sentenceId']}")
        elif v["matchText"] not in s["en"]:
            errs.append(f"{v['id']}: matchText '{v['matchText']}'가 {v['sentenceId']}에 없음")
        if track == "toeic" and not (1 <= len(v.get("synonyms", [])) <= 3):
            errs.append(f"{v['id']}: 토익 단어는 synonyms 1~3개")
    nv = len(data["vocab"])
    if kind == "part5":
        if not 3 <= nv <= 5:
            errs.append(f"part5 vocab은 3~5개 (현재 {nv})")
    elif nv != 5:
        errs.append(f"vocab은 5개 (현재 {nv})")

    # 구조 분석
    for st in data["structures"]:
        s = sents.get(st["sentenceId"])
        if not s:
            errs.append(f"{st['id']}: 없는 문장 {st['sentenceId']}")
            continue
        joined = " ".join(c["text"] for c in st["chunks"])
        if joined != s["en"]:
            errs.append(f"{st['id']}: chunks를 이은 문장이 원문과 다름\n    chunks: {joined}\n    원문  : {s['en']}")
    lo_st = 1 if kind == "part5" else 2
    if not lo_st <= len(data["structures"]) <= 3:
        errs.append(f"structures는 {lo_st}~3개")

    # 문법
    for g in data["grammar"]:
        s = sents.get(g["sentenceId"])
        if not s:
            errs.append(f"{g['id']}: 없는 문장 {g['sentenceId']}")
            continue
        for h in g["highlight"]:
            if h not in s["en"]:
                errs.append(f"{g['id']}: highlight '{h}'가 {g['sentenceId']}에 없음")
    if not 2 <= len(data["grammar"]) <= 3:
        errs.append("grammar는 2~3개")

    # 문제 (토익)
    if track == "toeic":
        qs = data["questions"]
        if len(qs) != Q_COUNT[kind]:
            errs.append(f"{kind} 문제는 {Q_COUNT[kind]}개 (현재 {len(qs)})")
        if [q["number"] for q in qs] != list(range(1, len(qs) + 1)):
            errs.append("questions.number는 1부터 차례대로")
        used_blank = []
        for q in qs:
            tag = q["id"]
            if not q["type"].startswith(Q_TYPES[kind]):
                errs.append(f"{tag}: type {q['type']}은 {kind}에 맞지 않음")
            keys = [c["key"] for c in q["choices"]]
            if keys != ["A", "B", "C", "D"]:
                errs.append(f"{tag}: 보기 key는 A,B,C,D 순서")
            texts = [c["text"].strip().lower() for c in q["choices"]]
            if len(set(texts)) != 4:
                errs.append(f"{tag}: 같은 보기가 있음")
            ans = next((c["text"] for c in q["choices"] if c["key"] == q["answer"]), None)
            if kind in ("part5", "part6"):
                b = q.get("blank")
                if not b:
                    errs.append(f"{tag}: Part 5·6은 blank 필요")
                    continue
                if q.get("prompt") not in (None, ""):
                    errs.append(f"{tag}: Part 5·6은 prompt를 null로 (앱이 빈칸 문장을 만듦)")
                s = sents.get(b["sentenceId"])
                if not s:
                    errs.append(f"{tag}: 없는 문장 {b['sentenceId']}")
                    continue
                cnt = s["en"].count(b["answerText"])
                if cnt != 1:
                    errs.append(f"{tag}: answerText '{b['answerText']}'가 {b['sentenceId']}에 {cnt}번 있음 (정확히 1번이어야 빈칸 위치가 정해짐)")
                if ans is None or ans.strip().lower() != b["answerText"].strip().lower():
                    errs.append(f"{tag}: 정답 보기 '{ans}'와 answerText '{b['answerText']}'가 다름")
                if q["type"] == "part6-sentence" and b["answerText"] != s["en"]:
                    errs.append(f"{tag}: 문장 넣기 문제는 answerText가 문장 전체여야 함")
                if b["sentenceId"] in used_blank and kind == "part5":
                    errs.append(f"{tag}: Part 5는 문장 하나에 문제 하나")
                used_blank.append(b["sentenceId"])
            else:  # part7
                if not q.get("prompt"):
                    errs.append(f"{tag}: Part 7은 질문(prompt) 필요")
                ev = q.get("evidenceSentenceIds") or []
                if not ev:
                    errs.append(f"{tag}: Part 7은 근거 문장(evidenceSentenceIds) 필요")
                for sid in ev:
                    if sid not in sents:
                        errs.append(f"{tag}: 없는 근거 문장 {sid}")
        if kind == "part5":
            if len(data["sentences"]) != 10 or any(len(p["sentenceIds"]) != 1 for p in data["paragraphs"]):
                errs.append("Part 5는 문장 10개, 문단마다 문장 1개")
            if sorted(used_blank) != sorted(sents):
                errs.append("Part 5는 모든 문장에 문제가 하나씩")
        if kind == "part6" and sum(q["type"] == "part6-sentence" for q in qs) != 1:
            errs.append("Part 6은 문장 넣기 문제(part6-sentence)가 정확히 1개")
        if kind == "part6":
            idx = {s["id"]: i for i, s in enumerate(data["sentences"])}
            pos = [idx.get(q["blank"]["sentenceId"], -1) for q in qs if q.get("blank")]
            if pos != sorted(pos):
                errs.append("Part 6 문제 순서는 지문 속 빈칸 순서와 같아야 함")
        answers = [q["answer"] for q in qs]
        if len(qs) >= 5 and max(answers.count(k) for k in "ABCD") > len(qs) // 2:
            errs.append(f"정답이 한 보기에 몰림: {answers}")

    au = data["audio"]
    if track == "toeic" and au is not None:
        errs.append("토익은 audio = null (앱 TTS 사용)")
    if au and au.get("startSec") is not None and au.get("endSec") is not None:
        if au["endSec"] <= au["startSec"] or au["endSec"] > au["durationSec"] + 1:
            errs.append("audio startSec/endSec 범위 오류")
    return errs


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    target = Path(argv[1])
    index_out = Path(argv[argv.index("--write-index") + 1]) if "--write-index" in argv else None

    files = sorted(target.rglob("*.json")) if target.is_dir() else [target]
    files = [f for f in files if f.name != "index.json"]
    bad, index, seen = 0, [], {}
    for f in files:
        name = f"{f.parent.name}/{f.name}"
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"✗ {name}: JSON 문법 오류 {e}")
            bad += 1
            continue
        errs = check(f, data)
        if data.get("track") == "general":  # 같은 작품·같은 부분을 두 번 보내지 않기
            key = (data.get("title", "").lower(), (data.get("source") or {}).get("excerptNote"))
            if key in seen:
                errs.append(f"같은 작품·같은 부분이 이미 있음: {seen[key]}")
            seen[key] = name
        if errs:
            bad += 1
            print(f"✗ {name}")
            for e in errs:
                print("   -", e)
            continue
        extra = f", {len(data['questions'])}문제" if data["track"] == "toeic" else ""
        print(f"✓ {name}  ({data['title']}, L{data['level']}, {data['wordCount']}단어{extra})")
        index.append({
            "track": data["track"], "chapter": data.get("chapter"), "id": data["id"], "date": data["date"],
            "level": data["level"], "genre": data["genre"], "title": data["title"], "titleKo": data["titleKo"],
            "wordCount": data["wordCount"], "hasAudio": data["audio"] is not None,
            "questionCount": len(data.get("questions", [])),
            "grammarTags": sorted({t for g in data["grammar"] for t in g["tags"]}),
            "file": f"{data['track']}/{f.name}",
        })
    if index_out and not bad:
        index.sort(key=lambda x: (x["date"], x["track"], x["level"], x["chapter"] or ""), reverse=True)
        index_out.write_text(json.dumps({"schemaVersion": 2, "lessons": index}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"→ {index_out} ({len(index)}개)")
    print(f"\n{len(files) - bad}/{len(files)} 통과")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
