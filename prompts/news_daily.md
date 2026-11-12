처리할 레벨: 3
가져올 뉴스 수: 1

사용자(한국어 사용자, 영어 공부 중)를 위해 오늘의 **영어 뉴스 필사 지문**을 '가져올 뉴스 수'만큼 만든다. 앱의 이야기 트랙 '뉴스' 칩에 나온다. 뉴스마다 **(B) 앱용 레슨 JSON 파일**을 만들고, 끝나면 **(A) 한국어 안내 메시지** 하나로 모아 보낸다.
뉴스 하나씩 끝까지(기사 → JSON → 검증 → 업로드) 처리한다. 하나가 실패해도 나머지는 계속하고, 실패한 것은 알림에 적는다.

## 1. 날짜·레벨·id
- 날짜: `TZ=Asia/Seoul date +%F`
- '처리할 레벨'이 여러 개면(예: `2, 3`) 뉴스를 그 레벨들에 번갈아 배정한다. 레벨은 기사 난이도에 맞춘다.
- id: 그날 첫 뉴스 = `<날짜>-L<레벨>-news`, 둘째 = `<날짜>-L<레벨>-news2`, 셋째 = `-news3` … (번호는 그날 전체 뉴스 순서, 레벨과 무관하게 이어서). 파일 = `public/lessons/general/<id>.json`. `track`은 `"general"`, `genre`는 반드시 `"news"`.
- 단어 수(발췌 기준): 레벨 1 = 100~200, 2 = 150~250, 3 = 200~300, 4 = 250~350. 기사가 길면 **첫 단락부터 자연스럽게 끝나는 단락까지** 발췌하고 `source.excerptNote`에 "첫 N단락"이라고 적는다.
- 그날 뉴스 파일이 이미 '가져올 뉴스 수'만큼 있으면 알림 없이 끝낸다.

## 2. 이미 보낸 기사 확인
- `gh api repos/SimSsNim/SimSs/contents/public/lessons/general --jq '.[].name'`로 목록을 받고, `-news`가 들어간 파일의 `title`·`source.url`을 확인해 **같은 기사를 다시 쓰지 않는다**. 주제도 최근 3일과 겹치지 않게(과학, 건강, 환경, 교육, 문화, 기술, 미국 생활, 역사 등 돌려가며).

## 3. 기사 고르기 (미국 정부 기관 발표문만 — 퍼블릭 도메인)
- 1순위 **NASA**: 최신 글 목록은 RSS `curl -sSL https://www.nasa.gov/feed/` (또는 `https://science.nasa.gov/feed/`)에서 받는다. 우주·지구·기후·항공·과학 기사.
- 2순위 **NOAA**: `curl -sSL https://www.noaa.gov/rss.xml`. 날씨·바다·기후·환경 기사.
- 둘 다 미국 정부 저작물이라 퍼블릭 도메인이다(`license`: `"us-government-work"`). `source.author`에는 기관 이름(예: "NASA"), `source.edition`에는 "NASA News"/"NOAA News"처럼 적는다.
- **쓰면 안 되는 글**: 본문에 다른 회사·대학·언론사가 쓴 글이라고 나오거나(예: "This article was originally published by …", "© …", 외부 기고), 통신사(AP·Reuters·AFP) 이름이 있는 것, 사진·영상 설명뿐인 것, 행사 일정·미디어 등록 안내(media accreditation)·연락처뿐인 공지, 계약·조달 공고. **기관 직원이 쓴 일반 기사·보도자료**만 쓴다.
- **최근 7일 안의 글**을 고른다(RSS의 pubDate로 확인). 7일 안에 쓸 만한 글이 없으면 30일 안에서 고른다.
- 레벨 감: 기관 글은 대체로 레벨 3~4다. 레벨 1~2를 맡으면 문장이 짧고 숫자·고유명사가 적은 기사(예: 교육용·학생용 글, 사진 소개 글의 본문)를 고르고, 앞부분을 짧게 발췌한다.
- 원문 확보: `curl -sSL <기사 주소>`로 HTML을 받아 기사 본문 단락만 뽑아 **글자 그대로** 쓴다. 사진 설명, 크레디트 줄, "Related Terms"·"Explore More" 같은 메뉴, 연락처·문의처(Media contact), "-end-" 표시는 본문에 넣지 않는다. 뽑은 본문을 다시 페이지와 비교해 한 글자라도 다르면 고친다(원문을 고쳐 맞추는 것은 금지). curl이 막히면 WebFetch로 단락별로 정확히 인용받아 모은 뒤 "글자 단위로 비교해 다른 점 나열, 같으면 IDENTICAL"로 대조해 IDENTICAL일 때만 쓴다.
- 음원: 보통 없다 → `"audio": null` (앱에서 TTS로 듣는다). 기사에 같은 내용을 읽는 기관 자체 mp3가 있을 때만 넣는다.
- 원문을 정확히 확보할 수 없으면 지어내거나 고치지 말고 다른 기사를 고른다.

## 4. (B) 레슨 JSON 만들기
저장소의 `lesson.schema.json`을 따른다(가능하면 `gh api`로 받아서 확인). 요점:

```json
{
  "schemaVersion": 2, "track": "general", "id": "YYYY-MM-DD-L3-news", "date": "YYYY-MM-DD", "level": 3,
  "title": "영어 제목", "titleKo": "한글 제목", "genre": "news", "tags": ["NASA", "space"],
  "source": { "work": "기사 제목", "author": "NASA", "translator": null, "year": 2026,
              "edition": "NASA News", "url": "기사 주소", "license": "us-government-work", "excerptNote": "첫 N단락 발췌 또는 null" },
  "audio": null,
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
9. 기사 날짜·사람 이름·숫자는 원문 그대로. 번역에서도 바꾸지 않는다.

**검증 (통과해야 내보낸다)**
- 가능하면 `gh repo clone SimSsNim/SimSs` 후 `pip install jsonschema --break-system-packages` 하고 `python3 scripts/validate_lessons.py public/lessons/general/<id>.json`을 실행한다.
- 저장소를 못 받으면 Python으로 직접 확인한다: JSON 문법, 1~5번 규칙(문장 잇기 = 원문, chunks 잇기 = 문장, matchText·highlight 포함 여부, wordCount, 개수), 모든 sentenceId가 실제로 있는지, id 규칙(위 1번) = 파일명, track = "general", 폴더 = general, genre = "news", 단어 수가 뉴스 레벨 범위 안.
- 실패하면 고쳐서 다시 검증한다. 원문 자체를 고쳐서 맞추는 것은 금지.

## 5. 내보내기
- `gh` 명령이 인증 오류를 내면 같은 요청을 `curl -sS -H "Authorization: token $GH_TOKEN" https://api.github.com/repos/SimSsNim/SimSs/contents/...` 로 다시 시도한다(PUT은 `-X PUT -d '{"message":"...","content":"<base64>"}'`). 저장소 단위 경로(`repos/...`)만 쓸 수 있다.
1. **저장소에 올리기(가능할 때)**: `gh api -X PUT repos/SimSsNim/SimSs/contents/public/lessons/general/<id>.json -f message="lesson(news): <id> <title>" -f content="$(base64 -w0 <파일>)"`. (index.json은 올리지 않는다 — CI가 만든다.) 성공하면 커밋 링크를 기록한다.
2. **올리지 못했으면**: 레슨 JSON 파일을 SendUserFile로 보내고, (A) 메시지 끝에 "앱 → 기록/설정 → 레슨 가져오기로 이 파일을 넣어 주세요" 한 줄을 붙인다.

## 6. (A) 한국어 안내 메시지 (최종 답변으로 한 번)
인사말이나 작업 과정 설명 없이:
- 맨 위: 뉴스마다 한 줄 — `뉴스1 L3 「제목」 238단어 (NASA, 11월 10일 기사)`. 실패한 것은 "뉴스2 실패: 이유".
- 첫 번째 뉴스만 자세히: 제목, 출처(기관 이름, 기사 날짜, 기사 링크), 레벨, 단어 수, 영어 원문(단락 유지), 한글 번역(단락별), 핵심 단어 5개(뜻 + 짧은 예문), 📐 문장 구조 2~3개, ✏️ 문법 포인트 2~3개.
- 마지막 줄: "📱 앱에 반영됨 (이야기 → 뉴스)" 또는 "📱 앱 가져오기 필요(파일 첨부)"

## 7. 알림
PushNotification을 한 번 보낸다(200자 이내, `<routine_summary>` 태그 안): 첫 문장에 "[뉴스]"와 결과(예: "1개 완료" 또는 "실패: 원문 확보 못 함"), 이어서 첫 뉴스 제목과 앱 반영 여부.
