#!/usr/bin/env python3
"""tests/fixtures/broken/ 에 '깨진 레슨' 파일을 만든다. 샘플을 바꾸면 다시 실행.
각 폴더: <이름>/<폴더=track 자리>/<파일>.json  + expect.txt(오류 메시지에 들어 있어야 할 문자열)"""
import copy, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
L = ROOT / "public/lessons"
OUT = ROOT / "tests/fixtures/broken"
load = lambda p: json.loads((L / p).read_text(encoding="utf-8"))
p5, p6, p7, gen = (load("toeic/2026-11-12-L1-part5.json"), load("toeic/2026-11-12-L1-part6.json"),
                   load("toeic/2026-11-12-L1-part7.json"), load("general/2026-11-12-L1.json"))

cases = []
def case(name, data, folder, expect, stem=None):
    cases.append((name, data, folder, stem or data["id"], expect))

d = copy.deepcopy(p5); d["questions"][0]["answer"] = "A"
case("answer-mismatch", d, "toeic", "와 answerText")
d = copy.deepcopy(p5); d["questions"][0]["blank"]["answerText"] = "simple"
case("answertext-missing", d, "toeic", "0번 있음")
d = copy.deepcopy(p5); d["questions"][0]["blank"]["answerText"] = "e"; d["questions"][0]["choices"][1]["text"] = "e"
case("answertext-twice", d, "toeic", "번 있음")
d = copy.deepcopy(p5); d["questions"] = d["questions"][:9]
case("part5-nine-questions", d, "toeic", "part5 문제는 10개")
d = copy.deepcopy(p6); d["questions"][3]["type"] = "part6-word"
case("part6-no-sentence-insert", d, "toeic", "문장 넣기 문제(part6-sentence)가 정확히 1개")
d = copy.deepcopy(p6); q = d["questions"]; q[0], q[1] = q[1], q[0]; q[0]["number"], q[1]["number"] = 1, 2
case("part6-order", d, "toeic", "빈칸 순서")
d = copy.deepcopy(p7); d["questions"][0]["evidenceSentenceIds"] = []
case("part7-no-evidence", d, "toeic", "근거 문장(evidenceSentenceIds) 필요")
d = copy.deepcopy(p7); d["audio"] = copy.deepcopy(gen["audio"])
case("toeic-with-audio", d, "toeic", "audio = null")
d = copy.deepcopy(gen)
case("folder-not-track", d, "toeic", "폴더(toeic)와 track(general)")
d = copy.deepcopy(p5); d["id"] = "2026-11-12-L1-p5"
case("bad-id-format", d, "toeic", "스키마")
d = copy.deepcopy(gen); d["structures"][0]["chunks"][0]["text"] = "A Dog"
case("chunks-mismatch", d, "general", "chunks를 이은 문장이 원문과 다름")
d = copy.deepcopy(gen); d["wordCount"] += 1
case("wordcount", d, "general", "wordCount")
d = copy.deepcopy(gen); del d["glossary"][next(iter(d["glossary"]))]
case("glossary-missing", d, "general", "glossary에 없는 단어 1개")
d = copy.deepcopy(p7); d["glossary"]["zebra"] = {"lemma": "zebra", "pos": "noun", "ko": "얼룩말"}
case("glossary-extra", d, "toeic", "glossary에 지문에 없는 단어: zebra")
d = copy.deepcopy(gen); d["glossary"][next(iter(d["glossary"]))]["pos"] = "verbs"
case("glossary-bad-pos", d, "general", "스키마")

if OUT.exists():
    import shutil; shutil.rmtree(OUT)
for name, data, folder, stem, expect in cases:
    dd = OUT / name / folder
    dd.mkdir(parents=True)
    (dd / f"{stem}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / name / "expect.txt").write_text(expect, encoding="utf-8")
print(f"{len(cases)} cases")
