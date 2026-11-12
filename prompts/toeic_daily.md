처리할 레벨: 1, 2, 3, 4

사용자(한국어 사용자, 토익 준비 중)를 위해 **위 '처리할 레벨' 각각에 대해** 오늘의 토익 리딩 세트를 직접 쓴다. 레벨 하나 = 파일 3개:
- **Part 5**: 단문 빈칸 **10문제** (문장 10개)
- **Part 6**: 지문 1개에 빈칸 **5문제** (단어·구 4개 + 문장 넣기 1개)
- **Part 7**: 지문 1개에 독해 **3문제**

파일마다 원문·번역·단어·구조 분석·문법·문제를 모두 담고(앱의 모든 탭에서 쓰임), 검증하고, 저장소에 올린다. 끝나면 한국어 요약 메시지 하나와 알림 하나를 보낸다.
순서: 레벨 하나씩, 그 안에서 Part 5 → 6 → 7. 한 파일이 실패해도 나머지는 계속하고, 실패한 것은 알림에 적는다.

## 1. 날짜·레벨·파일
- 날짜: `TZ=Asia/Seoul date +%F`
- id = `<날짜>-L<레벨>-part5|part6|part7`, 파일 = `public/lessons/toeic/<id>.json`
- 그 파일이 저장소에 이미 있으면 건너뛴다. 처리할 것이 하나도 없으면 알림 없이 끝낸다.

| 레벨 | 목표 | Part 5 (10문장 합계) | Part 6 지문 | Part 7 지문 | 어휘·문법 수준 |
|---|---|---|---|---|---|
| 1 | 500~600 | 80~150단어, 문장당 8~15단어 | 80~130단어 | 100~150단어 | 기본 업무 어휘, 품사·시제·기본 전치사 |
| 2 | 600~750 | 100~180단어 | 100~150단어 | 150~200단어 | 수동태·관계사·to부정사/동명사·접속사 |
| 3 | 750~850 | 120~220단어 | 120~170단어 | 200~250단어 | 분사·분사구문·가정법·어휘 문제 비중↑ |
| 4 | 850+ | 150~260단어 | 140~190단어 | 250~300단어 | 도치·복합관계사·정교한 어휘·혼동 어휘 |

## 2. 이전 레슨 확인 (겹치지 않게)
- `gh api repos/SimSsNim/SimSs/contents/public/lessons/toeic --jq '.[].name'`로 목록을 받고, 같은 레벨의 최근 레슨들에서 `title`·`genre`·`vocab[].term`·`questions[].skill`·`questions[].choices`를 확인한다.
- Part 6·7 장르는 같은 레벨에서 이틀 연속 같지 않게: email, notice, announcement, advertisement, article, memo, letter, review, schedule, chat, form. 같은 날 Part 6과 7도 장르를 다르게.
- 주제도 돌린다: 회의·행사, 채용·인사, 출장·여행, 주문·배송, 시설 보수, 고객 서비스, 마케팅, 사내 교육, 예산·회계, 식당·호텔, 부동산·이사, 새 제품 출시.
- Part 5 문제 유형은 하루 10문제 안에서 섞는다: 품사(word-form) 3~4, 문법(시제·수동태·관계사·준동사 등, grammar) 2~3, 전치사·접속사(connector) 2, 어휘(vocabulary) 1~2. 최근 3일과 같은 정답 단어를 다시 쓰지 않는다.

## 3. 문제 쓰기 규칙 (직접 쓴 것만)
- **실제 토익(ETS) 기출이나 시판 교재 문제·지문을 옮기거나 바꿔 쓰지 않는다.** 회사·사람·상품 이름은 지어낸 것만.
- 자연스러운 비즈니스 영어. 다 쓴 뒤 원어민 편집자처럼 다시 읽고 문법·관사·전치사 오류를 고친다.
- **정답은 하나뿐이어야 한다.** 보기마다 빈칸에 넣어 읽어 보고, 오답이 문법적으로나 의미상으로 말이 되면 바꾼다(예: "until Friday"가 말이 되면 by/until을 같은 문제에 두지 않는다).
- 보기 4개는 서로 다르고, 품사 문제는 같은 어근(respons- → responsible, responsibly, responsibility, responsibilities)으로 만든다.
- 정답 위치(A~D)는 고르게 섞는다. 한 세트에서 같은 기호가 절반을 넘지 않게.
- Part 6: 빈칸 5개가 지문 순서대로 문제 1~5번. 문장 넣기 1개는 앞뒤 흐름으로만 풀리게 하고, 오답 문장 3개는 주제는 비슷하되 그 자리에 어색한 것.
- Part 7: 질문 3개는 유형을 섞는다 — 목적/주제(purpose), 세부(detail), 추론·사실 아닌 것·동의어 중 하나. 정답 보기는 본문 표현을 **바꿔 말한(패러프레이징)** 형태로. 근거 문장 id를 `evidenceSentenceIds`에 적는다.
- 해설(`explanationKo`)은 레벨에 맞는 쉬운 한국어로 "왜 정답인지 + 핵심 단서". 헷갈리는 오답은 `choiceNotesKo`에 이유를 적는다. `skill`에 유형 이름(예: "형용사 자리", "전치사 vs 접속사").
- 약어는 되도록 피한다(A.M. 대신 in the morning). Mr. Ms. Dr. 정도만.

## 4. JSON 형식 (`lesson.schema.json`, schemaVersion 2)
공통(일반 트랙과 같음): `paragraphs`, `sentences`(**정답이 들어간 완성 문장**), `vocab`, `structures`, `grammar`. 토익만 추가: `chapter`, `questions`.

```json
{
  "schemaVersion": 2, "track": "toeic", "chapter": "part5", "id": "2026-11-12-L1-part5", "date": "2026-11-12", "level": 1,
  "title": "Part 5 Practice Set", "titleKo": "Part 5 단문 빈칸 10문제", "genre": "sentences", "tags": ["TOEIC Part 5"],
  "source": { "work": "TOEIC-style practice set", "author": "Claude (AI 작성 연습용 지문)", "translator": null, "year": 2026,
              "edition": "original", "url": null, "license": "original", "excerptNote": null },
  "audio": null,
  "wordCount": 109,
  "paragraphs": [ { "id": "p1", "sentenceIds": ["s1"], "ko": "번역" } ],
  "sentences":  [ { "id": "s1", "paragraphId": "p1", "en": "The new coffee machine in the break room is very easy to use.", "ko": "번역", "audioStartSec": null, "audioEndSec": null } ],
  "vocab": [ { "id": "v1", "term": "break room", "pos": "noun", "meaningKo": "휴게실", "ipa": null, "synonyms": ["lounge"],
               "matchText": "break room", "sentenceId": "s1", "example": { "en": "", "ko": "" } } ],
  "structures": [ { "id": "st1", "sentenceId": "s7", "chunks": [ { "text": "The hotel", "role": "S", "ko": "그 호텔은" } ], "skeleton": "", "explanation": "" } ],
  "grammar": [ { "id": "g1", "title": "", "tags": ["품사"], "sentenceId": "s5", "highlight": ["is responsible"], "explanation": "", "example": { "en": "", "ko": "" }, "note": "토익 포인트 한 줄" } ],
  "glossary": { "단어key": { "lemma": "", "pos": "noun", "ko": "", "form": null } },
  "questions": [
    { "id": "q1", "number": 1, "type": "part5-word-form", "prompt": null,
      "blank": { "sentenceId": "s1", "answerText": "easy" },
      "choices": [ {"key":"A","text":"ease"}, {"key":"B","text":"easy"}, {"key":"C","text":"easily"}, {"key":"D","text":"easiness"} ],
      "answer": "B", "explanationKo": "be동사 + very 뒤는 형용사 자리.", "choiceNotesKo": { "C": "부사는 동사를 꾸민다." }, "skill": "형용사 자리" }
  ]
}
```
Part 7 문제는 `"prompt": "What is the purpose of the e-mail?"`, `"evidenceSentenceIds": ["s2"]`, `blank` 없음.
Part 6 문장 넣기는 `"type": "part6-sentence"`, `blank.answerText` = 그 문장 전체, 정답 보기 = 그 문장.

**반드시 지킬 규칙** (검증 스크립트가 확인함)
1. 문장 나누기: `. ! ?`에서 나누고 Mr. Ms. Dr. 같은 약어에서는 나누지 않는다. 이메일 인사말·맺음말·서명은 각각 한 단락. 한 문단의 문장을 공백 하나로 이으면 그 문단 원문과 정확히 같다.
2. **Part 5**: 문장 10개, 문단 10개(문단마다 한 문장), 문장마다 문제 하나. genre = "sentences".
3. **Part 5·6 빈칸**: `blank.answerText`는 그 문장 안에 **정확히 한 번** 나오고, 정답 보기 text와 같다(대소문자 무시). 앱이 이 부분을 `-------`로 바꿔 문제를 만든다. `prompt`는 null.
4. 문제 수: Part 5 = 10, Part 6 = 5(그중 part6-sentence 정확히 1개), Part 7 = 3. `number`는 1부터 차례대로. type은 그 Part 접두사(part5-/part6-/part7-)만.
5. `vocab`: Part 5는 3~5개, Part 6·7은 5개. 모든 토익 단어에 `synonyms` 1~3개. `matchText`는 그 문장 안에 그대로.
6. `structures`: Part 5는 1~3개, Part 6·7은 2~3개. `chunks[].text`를 공백 하나로 이으면 그 문장과 정확히 같다(구두점은 앞 조각에). 명령문은 V부터, 종속절 성분은 `"sub": true`, 접속사·관계사는 `CONJ`.
7. `grammar` 2~3개. `highlight`는 그 문장 안에 그대로. `note`에 토익 포인트. tags: 시제, 조동사, 수동태, to부정사, 동명사, 분사, 분사구문, 관계사, 접속사, 가정법, 비교, 도치, 강조, 생략, 일치, 명사절, 부사절, 전치사, 어순, 품사, 대명사, 어휘, 기타.
8. `wordCount` = 전체 문장을 공백으로 이어 공백 기준으로 센 수, 위 표의 범위 안.
9. `audio`는 null. id·파일명·폴더 규칙은 1번 표대로.

**모든 단어 뜻 (`glossary`, 필수)** — 앱에서 지문의 아무 단어나 누르면 이 뜻이 나온다.
- 단어 목록: `python3 scripts/glossary_words.py <파일>` (저장소를 못 받으면 같은 규칙으로 직접: 문장 `en`에서 정규식 `[A-Za-z0-9]+(?:[’'\-][A-Za-z0-9]+)*`로 뽑고, ’ → ', 소문자, 숫자만 된 것은 빼고, 처음 나온 순서, 중복 없이).
- 목록의 **모든 key를 빠짐없이, 더도 덜도 없이** 넣는다: `"glossary": { "ripples": { "lemma": "ripple", "pos": "noun", "ko": "잔물결, 파문", "form": "복수형" }, "the": { "lemma": "the", "pos": "determiner", "ko": "그 (정관사)" } }`
- `lemma` 사전형(고유명사는 원래 대소문자), `pos`: noun, verb, adjective, adverb, preposition, conjunction, pronoun, determiner, auxiliary, interjection, proper-noun, number, phrase 중 하나. `ko`: **이 지문에서 쓰인 뜻**을 짧게(1~3개, 30자 안팎). `form`: 사전형이 아닐 때만(복수형, 과거형, 과거분사, 현재분사(-ing), 3인칭 단수, 비교급, 최상급, 소유격, 줄임말 …). 고유명사는 한글 읽기 + 무엇인지.

**검증 (통과해야 올린다)**
- `gh repo clone SimSsNim/SimSs` → `pip install jsonschema --break-system-packages` → `python3 scripts/validate_lessons.py public/lessons/toeic/<id>.json`.
- 저장소를 못 받으면 위 1~9번과 glossary key 목록을 Python으로 직접 확인한다.
- 실패하면 고치고 다시 검증한다.

## 5. 내보내기
- `gh` 명령이 인증 오류를 내면 같은 요청을 `curl -sS -H "Authorization: token $GH_TOKEN" https://api.github.com/repos/SimSsNim/SimSs/contents/...` 로 다시 시도한다(PUT은 `-X PUT -d '{"message":"...","content":"<base64>"}'`). 저장소 단위 경로(`repos/...`)만 쓸 수 있다.
1. **저장소에 올리기**: 파일마다 `gh api -X PUT repos/SimSsNim/SimSs/contents/public/lessons/toeic/<id>.json -f message="lesson(toeic): <id>" -f content="$(base64 -w0 <파일>)"`. index.json은 올리지 않는다(CI가 만든다).
2. **올리지 못했으면**: 만든 JSON 파일들을 SendUserFile로 한 번에 보내고 메시지 끝에 "앱 → 기록/설정 → 레슨 가져오기로 이 파일들을 넣어 주세요"를 붙인다.

## 6. 한국어 안내 메시지 (최종 답변으로 한 번)
인사말·작업 과정 설명 없이:
- `[토익 Part 5·6·7]` 오늘 날짜
- 레벨별 한 줄: `L1 (500~600) · Part 5 10문제 · Part 6 「Elevator Inspection Notice」 5문제 · Part 7 「Workshop Registration Confirmation」 3문제`
- 실패한 파일이 있으면 무엇이 왜 실패했는지 한 줄씩
- "문제 풀이·해설·단어·구조 분석은 앱에서 Part를 골라 보세요. 듣기는 앱에서 TTS(미국·영국·호주 억양)"
- 마지막 줄: "📱 앱에 반영됨" 또는 "📱 앱 가져오기 필요(파일 첨부)"

## 7. 알림
PushNotification 한 번(200자 이내, `<routine_summary>` 태그 안): 첫 문장에 "[토익]"과 결과(예: "L1~L4 12세트 72문제 완료" 또는 "L3 Part 6 실패"), 이어서 앱 반영 여부.
