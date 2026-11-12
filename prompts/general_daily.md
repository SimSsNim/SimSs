처리할 레벨: 1, 2, 3, 4
안내 메시지에 전문을 넣을 레벨: 1
레벨당 이야기 수: 3

사용자(한국어 사용자, 영어 공부 중)를 위해 오늘의 영어 필사용 이야기를 **위 '처리할 레벨' 각각에 '레벨당 이야기 수'만큼(기본 3편)** 만든다. 이야기마다 **(B) 앱용 레슨 JSON 파일**을 만들고, 끝나면 **(A) 한국어 안내 메시지** 하나로 모아 보낸다. 메시지와 JSON의 내용은 서로 똑같아야 한다.
레벨 하나씩, 그 안에서 이야기 한 편씩 끝까지(지문 → JSON → 검증 → 업로드) 처리한다. 한 편이 실패해도 다음 편·다음 레벨은 계속하고, 실패한 것은 알림에 적는다. (뉴스는 따로 `prompts/news_daily.md`가 만든다. 여기서는 genre에 news를 쓰지 않는다.)

## 1. 날짜와 레벨
오늘 날짜는 `TZ=Asia/Seoul date +%F`로 확인한다. 레슨 id: 그날 그 레벨의 1편 = `<날짜>-L<레벨>`, 2편 = `<날짜>-L<레벨>-2`, 3편 = `<날짜>-L<레벨>-3` (예: `2026-11-12-L2`, `2026-11-12-L2-2`), 파일 = `public/lessons/general/<id>.json`.
- 레벨 1 (중1~2): 100~150단어, 짧고 쉬운 문장 — 짧은 우화·동화
- 레벨 2 (중3): 150~200단어 — 우화·동화·쉬운 단편
- 레벨 3 (고1~2): 200~250단어 — 단편소설·에세이 발췌
- 레벨 4 (고3·수능): 250~300단어 — 단편·에세이·연설 발췌

## 2. 이미 보낸 작품 확인
- 먼저 `gh api repos/SimSsNim/SimSs/contents/public/lessons/general --jq '.[].name'`로 저장소에 있는 레슨 파일 목록을 받고, 각 파일의 `title`·`source.excerptNote`를 확인해 **모든 레벨에서** 이미 보낸 작품·부분을 피한다. 같은 날 다른 편·다른 레벨이 같은 작품을 쓰지 않는다.
- 오늘 그 레벨에 이미 있는 편(`-L<레벨>`, `-2`, `-3` …)은 건너뛰고 빈 번호만 만든다. 처리할 것이 하나도 없으면 알림 없이 끝낸다.
- 저장소를 못 읽으면 이 목록을 기준으로 한다: 2026-11-09 「The Lion and the Mouse」(Vol.01 #19), 2026-11-11 「The Goose That Laid the Golden Eggs」(Vol.01 #02), 2026-11-12 「The Fox and the Crow」(Vol.01 #09, 레벨 1). 같은 Volume 안에서도 매일 다른 트랙을 고른다.

## 3. 지문 고르기 (퍼블릭 도메인 원문만)
- 1순위: 퍼블릭 도메인 고전 — 이솝 우화, 그림 동화, 안데르센 동화(PD 번역), 오 헨리·마크 트웨인 단편, 링컨 등 역사적 연설문 등 1929년 이전 작품. 레벨이 낮을수록 짧은 우화·동화, 높을수록 단편·에세이·연설 발췌.
- 듣기 자료가 중요하다: 가능하면 LibriVox에 낭독 음원이 있는 작품을 고르고, 지문은 그 음원과 같은 번역본/판본에서 가져온다. (예: LibriVox 'Aesop's Fables, Volume 01~' 는 V. S. Vernon Jones 번역(1912, Project Gutenberg #11339). Volume 01 페이지: https://librivox.org/aesops-fables-volume-1-fables-1-25 , mp3: https://www.archive.org/download/aesop_fables_volume_one_librivox/fables_01_NN_aesop.mp3 , 저용량: …_NN_aesop_64kb.mp3) WebSearch로 LibriVox 페이지를 찾고 WebFetch로 트랙 번호·낭독자·길이·mp3 링크를 확인한다.
- 원문 확보: 먼저 `curl -sSL`로 Gutenberg 원문(HTML 또는 .txt)을 직접 받아 그 텍스트에서 정확히 잘라 쓴다(이 환경에서 gutenberg.org·librivox.org·archive.org 접속이 허용돼 있다). curl이 막히면 WebFetch로 Gutenberg HTML(예: https://gutenberg.org/files/11339/11339-h/11339-h.htm)에 "N번째 문장을 120자 이하 조각으로 정확히 인용"처럼 나눠 요청해 모은 뒤, 완성한 전문을 다시 WebFetch에 "이 텍스트와 페이지 원문을 글자 단위로 비교해 다른 점을 모두 나열, 같으면 IDENTICAL"로 대조한다. IDENTICAL이 나와야 쓴다.
- 2순위: VOA Learning English(미국 정부 저작물, 음원 포함). 전문을 정확히 확보할 수 있을 때만.
- 원문을 정확히 알 수 없으면 지어내거나 고치지 말고 다른 작품을 고른다. 긴 글은 자연스럽게 끝나는 단락 단위로 발췌하고, 음원에서 그 부분이 대략 몇 분쯤인지 적는다.

## 4. (B) 레슨 JSON 만들기
저장소의 `lesson.schema.json`을 따른다(가능하면 `gh api`로 받아서 확인). 요점:

```json
{
  "schemaVersion": 2, "track": "general", "id": "YYYY-MM-DD-L1", "date": "YYYY-MM-DD", "level": 1,
  "title": "영어 제목", "titleKo": "한글 제목", "genre": "fable|fairy-tale|short-story|speech|essay", "tags": ["Aesop", "fable"],
  "source": { "work": "", "author": "", "translator": "또는 null", "year": 1912,
              "edition": "Project Gutenberg #11339", "url": "", "license": "public-domain | us-government-work", "excerptNote": "발췌 위치 또는 null" },
  "audio": { "mp3": "", "mp3Low": "또는 null", "pageUrl": "", "reader": "", "durationSec": 96,
             "startSec": "발췌면 대략 시작 초, 아니면 null", "endSec": null, "note": "트랙 번호 등" },   // 음원 없으면 "audio": null
  "wordCount": 136,
  "paragraphs": [ { "id": "p1", "sentenceIds": ["s1","s2"], "ko": "단락 번역" } ],
  "sentences":  [ { "id": "s1", "paragraphId": "p1", "en": "원문 문장", "ko": "문장 번역", "audioStartSec": null, "audioEndSec": null } ],
  "vocab": [ { "id": "v1", "term": "사전형", "pos": "verb|noun|adjective|adverb|preposition|conjunction|phrase|idiom|phrasal-verb",
               "meaningKo": "", "ipa": "/.../ 또는 null", "matchText": "지문 속 실제 형태", "sentenceId": "s1",
               "example": { "en": "", "ko": "" } } ],
  "structures": [ { "id": "st1", "sentenceId": "s1",
                    "chunks": [ { "text": "A Crow", "role": "S|V|O|IO|C|OC|M|CONJ", "sub": false, "ko": "직독직해 조각" } ],
                    "skeleton": "핵심 S+V", "explanation": "" } ],
  "grammar": [ { "id": "g1", "title": "", "tags": ["시제"], "sentenceId": "s1", "highlight": ["was sitting"],
                 "explanation": "", "example": { "en": "", "ko": "" }, "note": null } ]
}
```
(위 `//` 주석과 "또는 …" 설명은 실제 파일에 넣지 않는다.)

**반드시 지킬 규칙**
1. 문장 나누기: `. ! ?`(따옴표 안 포함)에서 나눈다. 단 Mr. Mrs. Ms. Dr. St. a.m. p.m. U.S. 같은 약어의 마침표에서는 나누지 않는다. 닫는 따옴표는 앞 문장에 붙인다. 한 문단의 `sentences[].en`을 공백 하나로 이으면 원문 문단과 **글자·구두점·따옴표까지 정확히** 같아야 한다. 단락 구분은 원문 그대로.
2. `wordCount` = 전체 문장을 공백으로 이은 뒤 공백 기준으로 센 수.
3. `vocab`은 정확히 5개. `matchText`는 그 문장 안에 그대로 있는 문자열.
4. `structures`는 2~3개. `chunks[].text`를 공백 하나로 이으면 그 문장 `en`과 정확히 같아야 한다(쉼표·마침표·따옴표는 앞 조각에 붙인다). 종속절·삽입절 안 성분은 `"sub": true`. 접속사·관계사는 `CONJ`.
5. `grammar`는 2~3개. `highlight`의 각 문자열은 그 문장 안에 그대로 있어야 한다. tags는 다음 중에서: 시제, 조동사, 수동태, to부정사, 동명사, 분사, 분사구문, 관계사, 접속사, 가정법, 비교, 도치, 강조, 생략, 일치, 명사절, 부사절, 전치사, 어순, 품사, 대명사, 어휘, 기타.
6. 문장 번역(`sentences[].ko`)을 이어 읽으면 단락 번역(`paragraphs[].ko`)과 같은 내용이 되게 직접 자연스럽게 번역한다.
7. id 규칙: 단락 p1…, 문장 s1…(전체 지문에서 이어서 번호), 단어 v1…, 구조 st1…, 문법 g1….
8. 설명 난이도는 레벨에 맞춘다.

**검증 (통과해야 내보낸다)**
- 가능하면 `gh repo clone SimSsNim/SimSs` 후 `pip install jsonschema --break-system-packages` 하고 `python3 scripts/validate_lessons.py public/lessons/general/<id>.json`을 실행한다.
- 저장소를 못 받으면 Python으로 직접 확인한다: JSON 문법, 1~5번 규칙(문장 잇기 = 원문, chunks 잇기 = 문장, matchText·highlight 포함 여부, wordCount, 개수), 모든 sentenceId가 실제로 있는지, id 규칙(위 1번) = 파일명, track = "general", 폴더 = general, 단어 수가 그 레벨 범위 안.
- 실패하면 고쳐서 다시 검증한다. 원문 자체를 고쳐서 맞추는 것은 금지.

## 5. 내보내기
- `gh` 명령이 인증 오류를 내면 같은 요청을 `curl -sS -H "Authorization: token $GH_TOKEN" https://api.github.com/repos/SimSsNim/SimSs/contents/...` 로 다시 시도한다(PUT은 `-X PUT -d '{"message":"...","content":"<base64>"}'`). 저장소 단위 경로(`repos/...`)만 쓸 수 있다.
1. **저장소에 올리기(가능할 때)**: `gh api -X PUT repos/SimSsNim/SimSs/contents/public/lessons/general/<id>.json -f message="lesson(general): <id> <title>" -f content="$(base64 -w0 <파일>)"`. (index.json은 올리지 않는다 — CI가 만든다.) 성공하면 커밋 링크를 기록한다.
2. **올리지 못했으면**: 레슨 JSON 파일을 SendUserFile로 보내고, (A) 메시지 끝에 "앱 → 기록/설정 → 레슨 가져오기로 이 파일을 넣어 주세요" 한 줄을 붙인다.

## 6. (A) 한국어 안내 메시지 (최종 답변으로 한 번)
인사말이나 작업 과정 설명 없이 아래만:
- 맨 위: 오늘 만든 이야기마다 한 줄 요약 — `L1-1 「제목」 136단어 🎧1:36` 식. 실패한 것은 "L3-2 실패: 이유".
- 그다음, **'안내 메시지에 전문을 넣을 레벨'** 의 1편만 아래 전체 형식으로 쓴다(그 레벨을 이번에 처리하지 않았으면 생략). 나머지는 요약 줄만 — 전체 내용은 앱에서 본다.
- 제목, 출처(작가/번역자/연도), 레벨, 단어 수, 원문 링크
- 🎧 듣기 링크 (mp3 직접 링크 + LibriVox 페이지, 낭독자, 길이). 음원을 못 찾으면 한 줄로 밝힌다.
- 영어 원문 (필사용, 단락 구분 유지)
- 한글 번역 (단락별)
- 핵심 단어·표현 5개 (뜻 + 짧은 예문)
- 📐 문장 구조 분석 2~3개: 끊어 읽기(/) + S·V·O·C·M 표시, 직독직해, 뼈대와 수식 관계 설명
- ✏️ 문법 포인트 2~3개: 지문 속 예문 + 설명 + 쉬운 예문
- 마지막 줄: "📱 앱에 반영됨" 또는 "📱 앱 가져오기 필요(파일 첨부)" (레벨별로 다르면 레벨별로)

## 7. 알림
PushNotification을 한 번 보낸다(200자 이내, `<routine_summary>` 태그 안): 첫 문장에 "[이야기]"와 만든 편 수(예: "L1~L4 12편 완료"), 이어서 전문 레벨의 작품명과 앱 반영 여부. 지문을 못 만들었거나(원문 확보 실패 등) 저장소 업로드·검증이 실패했으면 그 사실을 첫 문장에 쓴다.
