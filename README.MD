# 퀴즈 애플리케이션

## 프로젝트 개요
이 프로젝트는 주관식과 객관식 퀴즈를 지원하는 웹 기반 퀴즈 애플리케이션입니다.

## 기술 스택
- Node.js
- Express.js
- EJS 템플릿 엔진
- Jest (테스팅)

## 프로젝트 구조

```
quizproject1/
├── public/
│   ├── images/     # 이미지 리소스
│   └── style.css   # 메인 CSS 파일
├── routes/
│   └── quiz.js     # 퀴즈 라우팅
├── views/
│   ├── quiz/       # 퀴즈 관련 뷰
│   │   ├── create.ejs          # 퀴즈 생성
│   │   ├── final-result.ejs    # 최종 결과
│   │   ├── list.ejs            # 퀴즈 목록
│   │   ├── play.ejs            # 퀴즈 플레이
│   │   └── question-result.ejs # 문제별 결과
│   ├── index.ejs   # 메인 페이지
│   ├── login.ejs   # 로그인
│   ├── myprofile.ejs # 프로필
│   ├── notice.ejs  # 공지사항
│   └── signup.ejs  # 회원가입
├── data/
│   ├── factories/
│   │   └── quizFactory.js      # 퀴즈 객체 생성 팩토리
│   ├── builders/
│   │   └── resultBuilder.js    # 퀴즈 결과 생성 빌더
│   ├── validators/
│   │   ├── baseValidator.js    # 기본 검증 클래스
│   │   ├── textValidator.js    # 주관식 검증 클래스
│   │   └── choiceValidator.js  # 객관식 검증 클래스
│   ├── models/
│   │   ├── quizModel.js       # 퀴즈 데이터 모델
│   │   └── test/
│   │       └── quizModelTest.js
│   ├── quizTypes/
│   │   ├── baseQuiz.js        # 기본 퀴즈 클래스
│   │   ├── textQuiz.js        # 주관식 퀴즈 클래스
│   │   ├── choiceQuiz.js      # 객관식 퀴즈 클래스
│   │   └── test/
│   │       └── quizTest.js
│   └── utils/
│       └── errorHandler.js     # 에러 처리 유틸리티
└── app.js                      # 애플리케이션 진입점
```

## 개발 참고사항

### 퀴즈 데이터 구조
```javascript
// 퀴즈 목록 데이터 예시
const quizzes = [
    {
        id: 1,
        title: "시각적 효과 퀴즈",
        description: "이미지를 보고 답을 맞춰보세요",
        thumbnail: "/images/quiz1.jpg"
    },
    {
        id: 2,
        title: "테스트용 퀴즈",
        description: "3문제로 구성된 짧은 테스트입니다",
        thumbnail: "/rogo.png",
        totalQuestions: 3
    }
];
```

### 퀴즈 처리 로직
1. **퀴즈 목록 조회**
   - 기본 문제 수: 10문제
   - 특정 퀴즈는 고정 문제 수 지원 (예: 3문제)

2. **퀴즈 플레이**
   - 문제별 이미지 및 텍스트 표시
   - 선택지 무작위 섞기
   - 시간 제한 옵션

3. **답안 제출**
   - 주관식: 대소문자 구분 없음
   - 객관식: 단일/다중 선택 지원
   - 부분 점수 계산

## 구현된 기능

### 1. 디자인 패턴
- **팩토리 패턴**: `QuizFactory`를 통한 퀴즈 객체 생성
- **빌더 패턴**: `ResultBuilder`를 통한 퀴즈 결과 객체 생성
- **전략 패턴**: `Validator` 클래스들을 통한 유연한 검증 로직

### 2. 퀴즈 타입
#### BaseQuiz
- 공통 메서드 및 속성 정의
- 문제 데이터 검증
- 기본 결과 처리

#### TextQuiz (주관식)
- 텍스트 기반 답안 처리
- 대소문자 구분 없는 정답 검증
- 특수문자 및 공백 처리
- 최대 길이 제한

#### ChoiceQuiz (객관식)
- 다중 선택지 지원
- 선택지 무작위 출력
- 선택지 개수 제한
- 선택지 유효성 검증

### 3. 검증 시스템
- 입력값 검증
- 데이터 구조 검증
- 에러 처리 및 로깅

### 4. 테스트 시스템
- 단위 테스트
- 통합 테스트
- 결과 처리 테스트

## 시작하기

### 설치
```bash
npm install
```

### 테스트 실행
```bash
npm test
```

### 개발 서버 실행
```bash
npm run dev
```

## 다음 단계 개발 계획

### 1. 데이터베이스 연동
- 스키마 설계
- ORM 구현
- 데이터 마이그레이션

### 2. API 구현
- RESTful 엔드포인트
- 인증/인가
- 입력값 검증

### 3. 프론트엔드 개선
- UI 컴포넌트 개선
- 사용자 경험 최적화
- 반응형 디자인

## 기여하기
1. 이슈 생성
2. 브랜치 생성
3. 변경사항 커밋
4. 풀 리퀘스트 생성

## 라이선스
MIT License