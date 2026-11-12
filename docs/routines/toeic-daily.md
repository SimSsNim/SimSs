사용자(한국어 사용자, 영어 공부 중, 토익 준비)를 위해 오늘의 **토익 스타일 필사 지문** 1개를 직접 쓰고, **(A) 한국어 안내 메시지**와 **(B) 앱용 레슨 JSON 파일**을 둘 다 만든다. 둘의 내용은 서로 똑같아야 한다.

저장소: `SimSsNim/SimSs` (기본 브랜치에 레슨을 올리면 CI가 검증·배포한다)

## 1. 날짜와 레벨
오늘 날짜는 `TZ=Asia/Seoul date +%F`로 확인한다. 이 날짜가 레슨 id이자 date이자 파일명이다.
- 2026-11-09 ~ 2026-11-22: 레벨 1 (토익 500~600 목표), 100~150단어. 짧은 이메일·공지·문자 대화. 쉬운 문장, 기본 업무 어휘
- 2026-11-23 ~ 2026-12-20: 레벨 2 (600~750), 150~200단어. 메모·광고·안내문·일정표 설명
- 2026-12-21 ~ 2027-01-31: 레벨 3 (750~850), 200~250단어. 기사·편지·정책 안내, 긴 문장과 격식 있는 어휘
- 2027-02-01 이후: 레벨 4 (850+), 250~300단어. 기사·보고·제안서, 분사구문·관계사·도치 등 복잡한 구조

## 2. 이전 레슨 확인
- `gh api repos/SimSsNim/SimSs/contents/public/lessons/toeic --jq '.[].name'`로 이전 레슨 목록을 받고, 최근 7개의 `title`·`genre`·`vocab[].term`·`grammar[].title`을 확인한다.
- 오늘 날짜 파일이 이미 있으면 새로 만들지 않고 끝낸다(알림 없음).
- 저장소를 못 읽으면 지금까지 보낸 토익 레슨: 2026-11-12 「Workshop Registration Reminder」(email; 단어 be held, limited, encourage, cover, certificate of completion; 문법 계속적 용법 which, encourage+O+to부정사, Should 도치).
- **장르는 이틀 연속 같지 않게** 돌린다: email, notice, announcement, advertisement, article, memo, letter, review, schedule, chat, form.
- 주제도 돌린다: 회의·행사, 채용·인사, 출장·여행, 주문·배송, 시설 보수, 고객 서비스, 마케팅, 사내 교육, 예산·회계, 식당·호텔, 부동산·이사, 새 제품 출시.
- 핵심 단어와 문법 포인트는 최근 7개 레슨과 겹치지 않게 한다.

## 3. 지문 쓰기 (직접 쓴 원문만)
- **실제 토익(ETS) 기출이나 시판 교재 지문을 옮기거나 바꿔 쓰지 않는다.** 처음부터 새로 쓴다.
- 회사·사람·상품·장소 이름은 지어낸 이름만 쓴다(실제 기업·브랜드 금지). 이메일 주소·웹 주소가 필요하면 `.example` 도메인만 쓴다(예: info@brightpath.example).
- 토익 Part 6·7에서 실제로 볼 법한 자연스러운 비즈니스 영어로 쓴다. 이메일이면 인사말(Dear …,)과 맺음말(Sincerely, / 이름, 직함)을 각각 한 단락으로 둔다.
- 토익 Part 5 단골 문법이 2~3개 자연스럽게 들어가게 쓴다: 품사 자리, 수동태, 시제, 관계사, 분사, 접속사 vs 전치사(because vs because of), 동명사/to부정사, 비교, 가정법 등.
- 약어는 되도록 피한다(A.M. 대신 in the morning). 쓸 때는 Mr. Ms. Dr. 정도만.
- 다 쓴 뒤 영어 원어민 편집자처럼 다시 읽고 문법·관사·전치사·시제 오류, 어색한 표현을 고친다. 단어 수가 레벨 범위 안인지 센다.

## 4. (B) 레슨 JSON 만들기
저장소의 `lesson.schema.json`이 기준이다(`gh api repos/SimSsNim/SimSs/contents/lesson.schema.json --jq .content | base64 -d`로 받아 확인). **스키마에 없는 필드는 넣지 않는다**(`tags`, `edition`, `excerptNote`, `structures[].id` 등은 없다 — 넣으면 "알 수 없는 항목" 오류). 형식:

```json
{
  "schemaVersion": 1,
  "id": "YYYY-MM-DD",
  "track": "toeic",
  "date": "YYYY-MM-DD",
  "level": 1,
  "title": "영어 제목",
  "titleKo": "한글 제목",
  "genre": "email",
  "genreKo": "이메일",
  "wordCount": 120,
  "source": {
    "author": "Claude (AI 작성 연습용 지문)",
    "work": "TOEIC-style practice passage",
    "year": 2026,
    "license": "original",
    "note": "토익 Part 6·7 스타일로 새로 쓴 연습용 지문입니다. 실제 시험 지문이 아닙니다. 주제: 회의·행사"
  },
  "audio": null,
  "paragraphs": [
    {
      "id": "p1",
      "en": "Dear Ms. Park,",
      "ko": "박 님께,",
      "sentences": [ { "id": "s1", "en": "Dear Ms. Park,", "ko": "박 님께," } ]
    },
    {
      "id": "p2",
      "en": "단락 원문 전체(아래 문장들을 공백 하나로 이은 것과 정확히 같음)",
      "ko": "단락 번역",
      "sentences": [ { "id": "s2", "en": "원문 문장", "ko": "문장 번역" } ]
    }
  ],
  "vocab": [
    { "id": "v1", "term": "register for", "pos": "phr", "meaningKo": "~에 등록하다", "sentenceId": "s2",
      "matchText": "지문 속 실제 형태", "example": { "en": "쉬운 예문", "ko": "번역" },
      "synonyms": ["sign up for", "enroll in"] }
  ],
  "structures": [
    { "sentenceId": "s2",
      "chunks": [ { "text": "Please submit", "role": "V", "ko": "제출해 주세요" }, { "text": "the form", "role": "O", "ko": "양식을" } ],
      "skeleton": "핵심 S+V(+O/C)", "explanationKo": "뼈대와 수식 관계 설명" }
  ],
  "grammar": [
    { "id": "g1", "title": "문법 제목", "tags": ["수동태"], "sentenceId": "s2", "highlight": ["will be held"],
      "explanationKo": "설명", "examples": [ { "en": "쉬운 예문", "ko": "번역" } ],
      "note": "토익 문제에서 어떻게 나오는지 한 줄" }
  ]
}
```

필드 규칙:
- `"track": "toeic"`, `"audio": null`(앱이 TTS로 읽어 준다), `source.license`는 반드시 `"original"`. `source`에는 위 다섯 필드만 쓴다(null 값 금지, 모르는 필드는 빼기). `source.note`에 주제를 적는다.
- `genre`: email, notice, announcement, advertisement, article, memo, letter, review, schedule, chat, form 중 하나. `genreKo`: 이메일, 공지, 안내, 광고, 기사, 메모, 편지, 후기, 일정표, 채팅, 양식.
- `vocab[].synonyms`: **반드시 1~3개** — 토익에서 바꿔 쓰는(패러프레이징) 표현.
- `pos`: n, v, adj, adv, prep, conj, phr(구·숙어·구동사) 중 하나. `ipa`는 넣고 싶으면 슬래시 없이 문자열로, 모르면 필드를 뺀다(null 금지).
- `grammar[].note`: 토익 문제에서 어떻게 나오는지 한 줄(예: "주어가 사물이고 뒤에 목적어가 없으면 수동태를 의심한다").
- `role`: S, V, O, C, M, CONJ 만 쓴다. 간접목적어도 O, 목적격 보어도 C. 명령문은 주어 없이 V부터(please는 V 조각에 붙여도 된다). 종속절·삽입절 안 성분은 `"sub": true`(앱에서 S′ V′). 접속사·관계사는 CONJ, 단 관계대명사가 절의 주어·목적어 역할이면 S/O + sub.

**반드시 지킬 규칙**
1. 문장 나누기: `. ! ?`에서 나누고 Mr. Ms. Dr. 같은 약어에서는 나누지 않는다. 인사말("Dear Ms. Park,")·맺음말("Sincerely,")·서명("Daniel Lee, Event Coordinator")은 각각 한 문장·한 단락. 문장 `en` 앞뒤에 공백이 없어야 한다. 한 단락의 `sentences[].en`을 공백 하나로 이으면 그 단락 `en`과 정확히 같아야 한다.
2. `wordCount` = 모든 단락 `en`을 공백으로 이은 뒤 공백 기준으로 센 수.
3. `vocab`은 정확히 5개, 토익 빈출 업무 어휘 위주. `matchText`는 그 문장 `en` 안에 그대로 있는 문자열.
4. `structures`는 2~3개(문장당 하나). `chunks`는 2개 이상이고, `chunks[].text`를 공백 하나로 이으면 그 문장 `en`과 정확히 같아야 한다(구두점은 앞 조각에 붙임).
5. `grammar`는 2~3개. `highlight`의 각 문자열은 그 문장 안에 그대로 있어야 한다. tags는: 시제, 조동사, 수동태, to부정사, 동명사, 분사, 분사구문, 관계사, 접속사, 가정법, 비교, 도치, 강조, 생략, 일치, 명사절, 부사절, 전치사, 어순, 기타.
6. 문장 번역을 이어 읽으면 단락 번역과 같은 내용이 되게 자연스럽게 번역한다(존댓말 이메일은 존댓말로).
7. id 규칙: 단락 p1…, 문장 s1…(지문 전체에서 이어서), 단어 v1…, 문법 g1…. id는 레슨 안에서 겹치지 않는다.

**검증 (통과해야 내보낸다)**
- 가능하면 `gh repo clone SimSsNim/SimSs` 후 저장소 안 `public/lessons/toeic/<id>.json`에 파일을 두고 `python3 scripts/validate_lessons.py public/lessons`를 실행한다(표준 라이브러리만 씀, 별도 설치 불필요). 폴더 단위로 실행해야 폴더=track, 파일명=id 검사까지 된다. 출력에 `✓ toeic/<id>.json`이 나오고 종료 코드가 0이어야 한다.
- 못 하면 Python으로 직접 확인: JSON 문법, 위 1~5번 규칙, 모든 sentenceId 존재, id = date = 파일명, track = "toeic", license = "original", audio = null, 스키마에 없는 필드가 없는지, synonyms 1~3개.
- 실패하면 고치고 다시 검증한다.

## 5. 내보내기
- `gh` 명령이 인증 오류를 내면 같은 요청을 `curl -sS -H "Authorization: token $GH_TOKEN" https://api.github.com/repos/SimSsNim/SimSs/contents/...` 로 다시 시도한다(PUT은 `-X PUT -d '{"message":"...","content":"<base64>"}'`). 저장소 단위 경로(`repos/...`)만 쓸 수 있다.
1. **저장소에 올리기(가능할 때)**: `gh api -X PUT repos/SimSsNim/SimSs/contents/public/lessons/toeic/<id>.json -f message="lesson(toeic): <id> <title>" -f content="$(base64 -w0 <파일>)"`. index.json은 올리지 않는다(CI가 만든다).
2. **올리지 못했으면**: 레슨 JSON 파일(이름 `<id>.json`)을 SendUserFile로 보내고, 메시지 끝에 "앱 → 기록/설정 → 레슨 가져오기로 이 파일을 넣어 주세요" 한 줄을 붙인다.

## 6. (A) 한국어 안내 메시지
인사말이나 작업 과정 설명 없이 아래만 최종 답변으로 쓴다:
- 맨 위 `[토익 필사]` 표시, 제목(영어·한글), 장르, 레벨(목표 점수대), 단어 수, "AI 작성 토익 스타일 연습 지문"
- 🎧 "원음 없음 — 앱 듣기 탭에서 TTS(미국·영국·호주 억양)로 들을 수 있어요" 한 줄
- 영어 원문 (필사용, 단락 구분 유지)
- 한글 번역 (단락별)
- 핵심 단어·표현 5개 (뜻 + 바꿔 쓰기 표현 + 짧은 예문)
- 📐 문장 구조 분석 2~3개: 끊어 읽기(/) + S·V·O·C·M 표시, 직독직해, 뼈대와 수식 관계 설명
- ✏️ 문법 포인트 2~3개: 지문 속 예문 + 설명 + 쉬운 예문 + 🎯 토익 포인트
- 마지막 줄: "📱 앱에 반영됨" 또는 "📱 앱 가져오기 필요(파일 첨부)"

## 7. 알림
PushNotification을 한 번 보낸다(200자 이내, `<routine_summary>` 태그 안): 첫 문장에 "[토익 필사]"와 오늘 지문 제목·장르·레벨·단어 수, 이어서 앱 반영 여부. 만들지 못했거나 업로드·검증이 실패했으면 그 사실을 첫 문장에 쓴다.
