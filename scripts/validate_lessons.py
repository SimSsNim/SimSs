#!/usr/bin/env python3
"""레슨 JSON 검증 + index.json 생성.

사용법:
  python scripts/validate_lessons.py public/lessons
  python scripts/validate_lessons.py public/lessons --write-index public/lessons/index.json
  python scripts/validate_lessons.py public/lessons --write-index public/lessons/index.json --keep-going

외부 패키지 없이 표준 라이브러리만 쓴다. 규칙은 src/lib/validateLesson.ts 와 같다.
--keep-going: 오류가 있어도 index.json 을 쓰고(오류 레슨은 errors 필드 포함) 종료 코드 0.
              개발 서버용. CI에서는 쓰지 않는다(오류가 있으면 종료 코드 1 → 배포 중단).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

TRACKS = ("general", "toeic")
ROLES = {"S", "V", "O", "C", "M", "CONJ"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
LICENSE_BY_TRACK = {"general": {"public-domain"}, "toeic": {"original"}}

TOP_KEYS = {
    "schemaVersion", "id", "track", "date", "level", "title", "titleKo", "genre", "genreKo",
    "wordCount", "source", "audio", "paragraphs", "vocab", "structures", "grammar",
}
REQUIRED_TOP = TOP_KEYS - {"genreKo"}


def count_words(text: str) -> int:
    return len(text.split())


def is_str(v, allow_empty=False) -> bool:
    return isinstance(v, str) and (allow_empty or len(v) > 0)


def validate_lesson(data, folder_track: str | None = None, file_stem: str | None = None) -> list[str]:
    errors: list[str] = []
    err = errors.append

    if not isinstance(data, dict):
        return ["레슨 최상위는 객체여야 합니다"]

    for k in REQUIRED_TOP:
        if k not in data:
            err(f"필수 항목 '{k}' 이(가) 없습니다")
    for k in data:
        if k not in TOP_KEYS:
            err(f"알 수 없는 항목 '{k}'")
    if errors:
        return errors

    if data["schemaVersion"] != 1:
        err("schemaVersion 은 1 이어야 합니다")
    if not (is_str(data["id"]) and DATE_RE.match(data["id"])):
        err("id 는 YYYY-MM-DD 형식이어야 합니다")
    if not (is_str(data["date"]) and DATE_RE.match(data["date"])):
        err("date 는 YYYY-MM-DD 형식이어야 합니다")
    track = data["track"]
    if track not in TRACKS:
        err(f"track 은 general 또는 toeic 이어야 합니다 (현재: {track!r})")
    if folder_track is not None and track != folder_track:
        err(f"track({track}) 이 폴더 이름({folder_track}) 과 다릅니다")
    if file_stem is not None and data["id"] != file_stem:
        err(f"id({data['id']}) 가 파일 이름({file_stem}) 과 다릅니다")
    if not (isinstance(data["level"], int) and not isinstance(data["level"], bool) and 1 <= data["level"] <= 5):
        err("level 은 1~5 정수여야 합니다")
    for k in ("title", "titleKo", "genre"):
        if not is_str(data[k]):
            err(f"{k} 는 비어 있지 않은 문자열이어야 합니다")

    src = data["source"]
    if not isinstance(src, dict) or "license" not in src:
        err("source.license 가 없습니다")
    elif track in LICENSE_BY_TRACK and src["license"] not in LICENSE_BY_TRACK[track]:
        allowed = ", ".join(sorted(LICENSE_BY_TRACK[track]))
        err(f"{track} 트랙의 source.license 는 {allowed} 만 허용됩니다 (현재: {src['license']!r})")

    audio = data["audio"]
    if audio is not None:
        if track == "toeic":
            err("toeic 트랙의 audio 는 null 이어야 합니다")
        if not isinstance(audio, dict) or not is_str(audio.get("mp3")):
            err("audio.mp3 가 없습니다")
        elif not audio["mp3"].startswith("https://"):
            err("audio.mp3 는 https:// 로 시작해야 합니다")

    # 문단 / 문장
    sentences: dict[str, str] = {}
    paragraphs = data["paragraphs"]
    if not isinstance(paragraphs, list) or not paragraphs:
        err("paragraphs 는 1개 이상이어야 합니다")
        paragraphs = []
    all_en: list[str] = []
    para_ids: set[str] = set()
    for pi, p in enumerate(paragraphs):
        where = f"paragraphs[{pi}]"
        if not isinstance(p, dict):
            err(f"{where} 는 객체여야 합니다")
            continue
        pid = p.get("id")
        if not is_str(pid):
            err(f"{where}.id 가 없습니다")
        elif pid in para_ids:
            err(f"문단 id '{pid}' 가 중복됩니다")
        else:
            para_ids.add(pid)
        sents = p.get("sentences")
        if not isinstance(sents, list) or not sents:
            err(f"{where}.sentences 는 1개 이상이어야 합니다")
            continue
        texts = []
        for si, s in enumerate(sents):
            sw = f"{where}.sentences[{si}]"
            if not isinstance(s, dict):
                err(f"{sw} 는 객체여야 합니다")
                continue
            sid = s.get("id")
            if not is_str(sid):
                err(f"{sw}.id 가 없습니다")
                continue
            if sid in sentences:
                err(f"문장 id '{sid}' 가 중복됩니다")
            en = s.get("en")
            if not is_str(en):
                err(f"문장 {sid}: en 이 비어 있습니다")
                en = ""
            elif en != en.strip():
                err(f"문장 {sid}: en 앞뒤에 공백이 있습니다")
            if not is_str(s.get("ko")):
                err(f"문장 {sid}: ko 가 비어 있습니다")
            for k in ("audioStartSec", "audioEndSec"):
                v = s.get(k)
                if v is not None and (not isinstance(v, (int, float)) or isinstance(v, bool) or v < 0):
                    err(f"문장 {sid}: {k} 는 0 이상 숫자 또는 null 이어야 합니다")
            sentences[sid] = en
            texts.append(en)
        joined = " ".join(texts)
        if p.get("en") != joined:
            err(f"문단 {pid}: 문장들을 공백 하나로 이은 값이 문단 en 과 다릅니다")
        all_en.append(p.get("en") or "")

    wc = count_words(" ".join(all_en))
    if data["wordCount"] != wc:
        err(f"wordCount({data['wordCount']}) 가 실제 단어 수({wc}) 와 다릅니다")

    def need_sentence(sid, where):
        if sid not in sentences:
            err(f"{where}: 없는 sentenceId '{sid}'")
            return None
        return sentences[sid]

    # 단어
    vocab = data["vocab"]
    if not isinstance(vocab, list) or not vocab:
        err("vocab 는 1개 이상이어야 합니다")
        vocab = []
    vids: set[str] = set()
    for vi, v in enumerate(vocab):
        where = f"vocab[{vi}]"
        if not isinstance(v, dict):
            err(f"{where} 는 객체여야 합니다")
            continue
        for k in ("id", "term", "pos", "meaningKo", "sentenceId", "matchText"):
            if not is_str(v.get(k), allow_empty=(k == "pos")):
                err(f"{where}.{k} 가 없습니다")
        if v.get("id") in vids:
            err(f"단어 id '{v.get('id')}' 가 중복됩니다")
        vids.add(v.get("id"))
        en = need_sentence(v.get("sentenceId"), f"{where}({v.get('term')})")
        if en is not None and is_str(v.get("matchText")) and v["matchText"] not in en:
            err(f"{where}({v.get('term')}): matchText '{v['matchText']}' 가 문장 {v['sentenceId']} 에 없습니다")
        syn = v.get("synonyms")
        if syn is not None and (not isinstance(syn, list) or not all(is_str(x) for x in syn)):
            err(f"{where}.synonyms 는 문자열 배열이어야 합니다")

    # 구조
    structures = data["structures"]
    if not isinstance(structures, list):
        err("structures 는 배열이어야 합니다")
        structures = []
    seen_struct: set[str] = set()
    for ti, st in enumerate(structures):
        where = f"structures[{ti}]"
        if not isinstance(st, dict):
            err(f"{where} 는 객체여야 합니다")
            continue
        sid = st.get("sentenceId")
        if sid in seen_struct:
            err(f"{where}: 문장 {sid} 의 구조 분석이 두 번 있습니다")
        seen_struct.add(sid)
        en = need_sentence(sid, where)
        chunks = st.get("chunks")
        if not isinstance(chunks, list) or len(chunks) < 2:
            err(f"{where}.chunks 는 2개 이상이어야 합니다")
            continue
        texts = []
        for ci, c in enumerate(chunks):
            if not isinstance(c, dict) or not is_str(c.get("text")):
                err(f"{where}.chunks[{ci}].text 가 없습니다")
                continue
            if c.get("role") not in ROLES:
                err(f"{where}.chunks[{ci}].role '{c.get('role')}' 은(는) S/V/O/C/M/CONJ 중 하나여야 합니다")
            if "sub" in c and not isinstance(c["sub"], bool):
                err(f"{where}.chunks[{ci}].sub 는 true/false 여야 합니다")
            if not isinstance(c.get("ko"), str):
                err(f"{where}.chunks[{ci}].ko 가 없습니다")
            texts.append(c["text"])
        if en is not None and " ".join(texts) != en:
            err(f"{where}: 청크를 공백 하나로 이은 값이 문장 {sid} 과 다릅니다")
        if not is_str(st.get("skeleton")):
            err(f"{where}.skeleton 이 없습니다")
        if not isinstance(st.get("explanationKo"), str):
            err(f"{where}.explanationKo 가 없습니다")

    # 문법
    grammar = data["grammar"]
    if not isinstance(grammar, list):
        err("grammar 는 배열이어야 합니다")
        grammar = []
    gids: set[str] = set()
    for gi, g in enumerate(grammar):
        where = f"grammar[{gi}]"
        if not isinstance(g, dict):
            err(f"{where} 는 객체여야 합니다")
            continue
        for k in ("id", "title", "sentenceId", "explanationKo"):
            if not is_str(g.get(k)):
                err(f"{where}.{k} 가 없습니다")
        if g.get("id") in gids:
            err(f"문법 id '{g.get('id')}' 가 중복됩니다")
        gids.add(g.get("id"))
        tags = g.get("tags")
        if not isinstance(tags, list) or not tags or not all(is_str(t) for t in tags):
            err(f"{where}.tags 는 1개 이상의 문자열이어야 합니다")
        en = need_sentence(g.get("sentenceId"), where)
        hl = g.get("highlight")
        if not isinstance(hl, list) or not hl:
            err(f"{where}.highlight 는 1개 이상이어야 합니다")
        elif en is not None:
            for h in hl:
                if not is_str(h) or h not in en:
                    err(f"{where}: highlight '{h}' 가 문장 {g.get('sentenceId')} 에 없습니다")

    return errors


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root", help="lessons 폴더 (예: public/lessons)")
    ap.add_argument("--write-index", metavar="PATH", help="index.json 을 쓸 경로")
    ap.add_argument("--keep-going", action="store_true", help="오류가 있어도 index 를 쓰고 0 으로 종료(개발용)")
    args = ap.parse_args()

    root = Path(args.root)
    entries = []
    bad = 0
    total = 0
    for track in TRACKS:
        folder = root / track
        if not folder.is_dir():
            continue
        for path in sorted(folder.glob("*.json")):
            total += 1
            rel = f"{track}/{path.name}"
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                errors = [f"JSON 을 읽을 수 없습니다: {e}"]
                data = {}
            else:
                errors = validate_lesson(data, folder_track=track, file_stem=path.stem)
            if errors:
                bad += 1
                print(f"✗ {rel}")
                for e in errors:
                    print(f"    - {e}")
            else:
                print(f"✓ {rel}")
            entry = {
                "track": track,
                "id": path.stem,
                "file": rel,
            }
            if isinstance(data, dict) and not errors:
                entry.update({
                    "date": data["date"],
                    "level": data["level"],
                    "title": data["title"],
                    "titleKo": data["titleKo"],
                    "genre": data["genre"],
                    "genreKo": data.get("genreKo"),
                    "wordCount": data["wordCount"],
                    "hasAudio": data["audio"] is not None,
                })
            else:
                entry.update({
                    "date": path.stem,
                    "title": (data.get("title") if isinstance(data, dict) else None) or path.stem,
                    "errors": errors,
                })
            entries.append(entry)

    for p in root.rglob("*.json"):
        if p.name == "index.json" or p.parent.name in TRACKS:
            continue
        print(f"! 무시됨(트랙 폴더 밖): {p.relative_to(root)}")

    print(f"\n{total}개 중 {total - bad}개 통과, {bad}개 오류")

    if args.write_index and (bad == 0 or args.keep_going):
        entries.sort(key=lambda e: (e["track"], e["date"], e["id"]), reverse=True)
        index = {
            "version": 1,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "lessons": entries,
        }
        out = Path(args.write_index)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"index 작성: {out}")

    if bad and not args.keep_going:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
