사용자(한국어 사용자, 영어 공부 중)를 위해 오늘의 영어 필사용 지문 1개를 만들고, **(A) 한국어 안내 메시지**와 **(B) 앱용 레슨 JSON 파일**을 둘 다 만든다. 둘의 내용(원문·번역·단어·구조·문법)은 서로 똑같아야 한다.

저장소: `SimSsNim/SimSs` (기본 브랜치에 레슨을 올리면 CI가 검증·배포한다)

## 1. 날짜와 레벨
오늘 날짜는 `TZ=Asia/Seoul date +%F`로 확인한다. 이 날짜가 레슨 id이자 date이자 파일명이다.
- 2026-11-09 ~ 2026-11-22: 레벨 1 (중1~2), 100~150단어, 짧고 쉬운 문장
- 2026-11-23 ~ 2026-12-20: 레벨 2 (중3), 150~200단어
- 2026-12-21 ~ 2027-01-31: 레벨 3 (고1~2), 200~250단어
- 2027-02-01 이후: 레벨 4 (고3·수능), 250~300단어

## 2. 이미 보낸 작품 확인
- 먼저 `gh api repos/SimSsNim/SimSs/contents/public/lessons/general --jq '.[].name'`로 저장소의 레슨 파일 목록을 받고, 필요하면 각 파일의 `title`을 확인해 이미 보낸 작품을 피한다.
- 오늘 날짜 파일이 이미 있으면 새로 만들지 않고 "오늘 레슨은 이미 있음"으로 끝낸다(알림 없음).
- 저장소를 못 읽으면 이 목록을 기준으로 한다: 2026-11-09 「The Lion and the Mouse」(Vol.01 #19), 2026-11-11 「The Goose That Laid the Golden Eggs」(Vol.01 #02), 2026-11-12 「The Fox and the Crow」(Vol.01 #09). 같은 Volume 안에서도 매일 다른 트랙을 고른다.

## 3. 지문 고르기 (퍼블릭 도메인 원문만)
- 1순위: 퍼블릭 도메인 고전 — 이솝 우화, 그림 동화, 안데르센 동화(PD 번역), 오 헨리·마크 트웨인 단편, 링컨 등 역사적 연설문 등 1929년 이전 작품. 레벨이 낮을수록 짧은 우화·동화, 높을수록 단편·에세이·연설 발췌.
- 듣기 자료가 중요하다: 가능하면 LibriVox에 낭독 음원이 있는 작품을 고르고, 지문은 그 음원과 같은 번역본/판본에서 가져온다. (예: LibriVox 'Aesop's Fables, Volume 01~' 는 V. S. Vernon Jones 번역(1912, Project Gutenberg #11339). Volume 01 페이지: https://librivox.org/aesops-fables-volume-1-fables-1-25 , mp3: https://www.archive.org/download/aesop_fables_volume_one_librivox/fables_01_NN_aesop.mp3 , 저용량: …_NN_aesop_64kb.mp3) WebSearch로 LibriVox 페이지를 찾고 WebFetch로 트랙 번호·낭독자·길이·mp3 링크를 확인한다. mp3 주소는 반드시 `https://`로 쓴다.
- 원문 확보: Gutenberg 직접 다운로드(curl)는 막혀 있을 수 있다. WebFetch로 Gutenberg HTML(예: https://gutenberg.org/files/11339/11339-h/11339-h.htm)에 "N번째 문장을 120자 이하 조각으로 정확히 인용"처럼 나눠 요청해 모은 뒤, 완성한 전문을 다시 WebFetch에 "이 텍스트와 페이지 원문을 글자 단위로 비교해 다른 점을 모두 나열, 같으면 IDENTICAL"로 대조한다. IDENTICAL이 나와야 쓴다.
- 2순위: VOA Learning English(미국 정부 저작물, 음원 포함, license는 `us-government-work`). 전문을 정확히 확보할 수 있을 때만.
- 원문을 정확히 알 수 없으면 지어내거나 고치지 말고 다른 작품을 고른다. 긴 글은 자연스럽게 끝나는 단락 단위로 발췌하고, 음원에서 그 부분이 대략 몇 분쯤인지 적는다.

## 4. (B) 레슨 JSON 만들기
저장소의 `lesson.schema.json`이 기준이다(`gh api repos/SimSsNim/SimSs/contents/lesson.schema.json --jq .content | base64 -d`로 받아 확인). **스키마에 없는 필드는 넣지 않는다**(검증에서 "알 수 없는 항목" 오류가 난다). 형식:

```json
{
  "schemaVersion": 1,
  "id": "YYYY-MM-DD",
  "track": "general",
  "date": "YYYY-MM-DD",
  "level": 1,
  "title": "영어 제목",
  "titleKo": "한글 제목",
  "genre": "fable",
  "genreKo": "우화",
  "wordCount": 136,
  "source": {
    "author": "Aesop",
    "work": "Aesop's Fables",
    "translator": "V. S. Vernon Jones",
    "year": 1912,
    "url": "https://www.gutenberg.org/ebooks/11339",
    "license": "public-domain",
    "note": "Project Gutenberg #11339 · LibriVox Vol.01 #09 · 발췌면 발췌 위치"
  },
  "audio": {
    "mp3": "https://www.archive.org/download/.../fables_01_09_aesop.mp3",
    "mp3Low": "https://www.archive.org/download/.../fables_01_09_aesop_64kb.mp3",
    "reader": "낭독자 이름",
    "durationSec": 96,
    "librivoxUrl": "https://librivox.org/aesops-fables-volume-1-fables-1-25"
  },
  "paragraphs": [
    {
      "id": "p1",
      "en": "단락 원문 전체(아래 문장들을 공백 하나로 이은 것과 정확히 같음)",
      "ko": "단락 번역",
      "sentences": [
        { "id": "s1", "en": "원문 문장", "ko": "문장 번역", "audioStartSec": null, "audioEndSec": null }
      ]
    }
  ],
  "vocab": [
    { "id": "v1", "term": "사전형", "pos": "v", "ipa": "ˈsetl", "meaningKo": "뜻", "sentenceId": "s1",
      "matchText": "지문 속 실제 형태", "example": { "en": "쉬운 예문", "ko": "번역" } }
  ],
  "structures": [
    { "sentenceId": "s1",
      "chunks": [ { "text": "A Crow", "role": "S", "ko": "까마귀는" }, { "text": "who", "role": "S", "sub": true, "ko": "그것은" } ],
      "skeleton": "핵심 S+V(+O/C)", "explanationKo": "뼈대와 수식 관계 설명" }
  ],
  "grammar": [
    { "id": "g1", "title": "문법 제목", "tags": ["시제"], "sentenceId": "s1", "highlight": ["was sitting"],
      "explanationKo": "설명", "examples": [ { "en": "쉬운 예문", "ko": "번역" } ], "note": "주의할 점(없으면 이 필드를 빼기)" }
  ]
}
```

필드 규칙:
- 음원을 못 찾으면 `"audio": null`. 음원이 있으면 `mp3`는 필수, 나머지(`mp3Low`, `reader`, `durationSec`, `librivoxUrl`)는 모르면 `null`.
- 발췌라서 음원에서 본문이 중간에 시작하면, 첫 문장의 `audioStartSec`에 대략 시작 초를 넣는다(나머지 문장은 null). 발췌 위치·트랙 번호는 `source.note`에 적는다.
- `source.license`: 고전은 `public-domain`, VOA는 `us-government-work`. `translator`·`year`·`url`·`note`는 모르면 필드를 뺀다(null 금지).
- `genre`: fable, fairy-tale, short-story, speech, essay, news 중 하나. `genreKo`: 우화, 동화, 단편, 연설, 수필, 뉴스.
- `pos`: n, v, adj, adv, prep, conj, phr(구·숙어·구동사) 중 하나. `ipa`는 모르면 필드를 뺀다(null 금지). 슬래시 없이 쓴다.
- `role`: S, V, O, C, M, CONJ 만 쓴다. 간접목적어도 O, 목적격 보어도 C로 쓴다. 종속절·삽입절 안 성분은 `"sub": true`(앱에서 S′ V′로 보임). 접속사·관계사는 CONJ, 단 관계대명사가 절의 주어·목적어 역할이면 S/O + sub.
- `note`가 없으면 필드를 뺀다.

**반드시 지킬 규칙**
1. 문장 나누기: `. ! ?`(따옴표 안 포함)에서 나눈다. 단 Mr. Mrs. Ms. Dr. St. a.m. p.m. U.S. 같은 약어의 마침표에서는 나누지 않는다. 닫는 따옴표는 앞 문장에 붙인다. 문장 `en` 앞뒤에 공백이 없어야 한다. 한 단락의 `sentences[].en`을 공백 하나로 이으면 그 단락 `en`과 **글자·구두점·따옴표까지 정확히** 같아야 하고, 단락 `en`은 원문 단락 그대로다. 단락 구분은 원문 그대로.
2. `wordCount` = 모든 단락 `en`을 공백으로 이은 뒤 공백 기준으로 센 수.
3. `vocab`은 정확히 5개. `matchText`는 그 문장 `en` 안에 그대로 있는 문자열.
4. `structures`는 2~3개(문장당 하나). `chunks`는 2개 이상이고, `chunks[].text`를 공백 하나로 이으면 그 문장 `en`과 정확히 같아야 한다(쉼표·마침표·따옴표는 앞 조각에 붙인다).
5. `grammar`는 2~3개. `highlight`의 각 문자열은 그 문장 안에 그대로 있어야 한다. tags는 다음 중에서: 시제, 조동사, 수동태, to부정사, 동명사, 분사, 분사구문, 관계사, 접속사, 가정법, 비교, 도치, 강조, 생략, 일치, 명사절, 부사절, 전치사, 어순, 기타.
6. 문장 번역(`sentences[].ko`)을 이어 읽으면 단락 번역(`paragraphs[].ko`)과 같은 내용이 되게 직접 자연스럽게 번역한다.
7. id 규칙: 단락 p1…, 문장 s1…(전체 지문에서 이어서 번호), 단어 v1…, 문법 g1…. id는 레슨 안에서 겹치지 않는다.
8. 설명 난이도는 레벨에 맞춘다.

**검증 (통과해야 내보낸다)**
- 가능하면 `gh repo clone SimSsNim/SimSs` 후 저장소 안 `public/lessons/general/<id>.json`에 파일을 두고 `python3 scripts/validate_lessons.py public/lessons`를 실행한다(표준 라이브러리만 씀, 별도 설치 불필요). 폴더 단위로 실행해야 폴더=track, 파일명=id 검사까지 된다. 출력에 `✓ general/<id>.json`이 나오고 종료 코드가 0이어야 한다.
- 저장소를 못 받으면 Python으로 직접 확인한다: JSON 문법, 위 1~5번 규칙(문장 잇기 = 단락 en, chunks 잇기 = 문장, matchText·highlight 포함 여부, wordCount, 개수), 모든 sentenceId가 실제로 있는지, id = date = 파일명, track = "general", 스키마에 없는 필드가 없는지, license가 public-domain 또는 us-government-work인지.
- 실패하면 고쳐서 다시 검증한다. 원문 자체를 고쳐서 맞추는 것은 금지.

## 5. 내보내기
- `gh` 명령이 인증 오류를 내면 같은 요청을 `curl -sS -H "Authorization: token $GH_TOKEN" https://api.github.com/repos/SimSsNim/SimSs/contents/...` 로 다시 시도한다(PUT은 `-X PUT -d '{"message":"...","content":"<base64>"}'`). 저장소 단위 경로(`repos/...`)만 쓸 수 있다.
1. **저장소에 올리기(가능할 때)**: `gh api -X PUT repos/SimSsNim/SimSs/contents/public/lessons/general/<id>.json -f message="lesson(general): <id> <title>" -f content="$(base64 -w0 <파일>)"`. (index.json은 올리지 않는다 — CI가 만든다.) 성공하면 커밋 링크를 기록한다.
2. **올리지 못했으면**: 레슨 JSON 파일(이름 `<id>.json`)을 SendUserFile로 보내고, (A) 메시지 끝에 "앱 → 기록/설정 → 레슨 가져오기로 이 파일을 넣어 주세요" 한 줄을 붙인다.

## 6. (A) 한국어 안내 메시지
인사말이나 작업 과정 설명 없이 아래만 최종 답변으로 쓴다:
- 제목, 출처(작가/번역자/연도), 레벨, 단어 수, 원문 링크
- 🎧 듣기 링크 (mp3 직접 링크 + LibriVox 페이지, 낭독자, 길이). 음원을 못 찾으면 한 줄로 밝힌다.
- 영어 원문 (필사용, 단락 구분 유지)
- 한글 번역 (단락별)
- 핵심 단어·표현 5개 (뜻 + 짧은 예문)
- 📐 문장 구조 분석 2~3개: 끊어 읽기(/) + S·V·O·C·M 표시, 직독직해, 뼈대와 수식 관계 설명
- ✏️ 문법 포인트 2~3개: 지문 속 예문 + 설명 + 쉬운 예문
- 마지막 줄: "📱 앱에 반영됨" 또는 "📱 앱 가져오기 필요(파일 첨부)"

## 7. 알림
PushNotification을 한 번 보낸다(200자 이내, `<routine_summary>` 태그 안): 첫 문장에 "[일반 필사]"와 오늘 작품명·레벨·단어 수, 이어서 mp3 링크와 앱 반영 여부. 지문을 못 만들었거나(원문 확보 실패 등) 저장소 업로드·검증이 실패했으면 그 사실을 첫 문장에 쓴다.
