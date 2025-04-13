public
    images // 이미지 리소스 관리
    style.css // 메인 css 파일
routes
    라우터 역할
    quiz.js // 퀴즈 문제를 관리하는 파일
views
    quiz // 퀴즈 페이지를 관리하는 디렉토리
    create.ejs // 퀴즈 만들기
    final-result.ejs // 최종 결과
    list.ejs // 문제의 내용을 미리보고 문항의 개수 선택
    play.ejs // 메인 퀴즈
    question-result.ejs // 문항별 정답 표시
    result.ejs // 현재 사용중이지 않은 파일

index.ejs // 메인 페이지
login.ejs // 로그인
myprofile.ejs // 내 정보
notice.ejs // 공지사항
signup.ejs // 회원가입




====================임시====================
퀴즈 작성법

# quiz.js

// 퀴즈 메인 페이지
router.get('/', (req, res) => {
    // 샘플 퀴즈 데이터
    const quizzes = [
        {
            id: 1,
            title: "시각적 효과 퀴즈",
            description: "이미지를 보고 답을 맞춰보세요",
            thumbnail: "/images/quiz1.jpg"
        },
        {
            id: 2,
            title: "테스트용 퀴즈 2",
            description: "3문제로 구성된 짧은 테스트입니다",
            thumbnail: "/rogo.png",
            totalQuestions: 3  // 문제 수를 3개로 고정
        },
        {
            id: n,
            title: "n번 퀴즈의 제목",
            description: "n번 퀴즈의 설명",
            thumbnail: "썸네일 이미지 경로",
            totalQuestions: 문제 수수
        }
    ];
    
    res.render('quiz/list', { 
        user: req.session.user,
        quizzes: quizzes
    });
});

router.get('/play/:id', (req, res) => {
    try {
        const quizId = req.params.id;
        let count = parseInt(req.query.count) || 10; // 기본값 10문제
        
        // 퀴즈 ID가 2인 경우 (테스트용 퀴즈 2) 문제 수를 3개로 고정
        if (quizId === '2') {
            count = 3;
            
            // 테스트용 퀴즈 2의 문제 데이터
            const testQuiz2Data = {
                quizId: quizId,
                questionImage: "/rogo.png",
                questionText: `테스트 문제 ${req.session.currentQuestion}번`,
                totalQuestions: count,
                currentQuestion: req.session.currentQuestion || 1,
                answers: ["답1", "답2", "답3"] // 각 문제의 정답
            };
            
            res.render('quiz/play', testQuiz2Data);
            return;
        }
        
        // 기존 퀴즈 처리 로직...
    } catch (error) {
        console.error('퀴즈 플레이 페이지 에러:', error);
        res.redirect('/quiz');
    }
});

router.post('/submit/:id', (req, res) => {
    const answer = req.body.answer;
    const quizId = req.params.id;
    
    // 테스트용 퀴즈 2의 정답 처리
    if (quizId === '2') {
        const currentQuestion = req.session.currentQuestion || 1;
        const answers = ["답1", "답2", "답3"];
        const isCorrect = answer === answers[currentQuestion - 1];
        
        // 다음 문제로 진행
        req.session.currentQuestion = (currentQuestion + 1);
        
        // 마지막 문제인 경우
        if (currentQuestion >= 3) {
            res.redirect('/quiz/final-result');
            return;
        }
        
        res.redirect(`/quiz/result/${quizId}?correct=${isCorrect}`);
        return;
    }
    
    // 기존 정답 처리 로직...
});




# list.ejs

<% if (quiz.id === 2) { %>
    <div class="count-buttons mb-4">
        <a href="/quiz/play/2" class="count-button">
            3개 문제 풀기
        </a>
    </div>
<% } else { %>
    <!-- 기존 10, 20, 30, 50개 버튼 -->
    <div class="count-buttons mb-4">
        <a href="/quiz/play/<%= quiz.id %>?count=10" class="count-button">
            10개 풀기
        </a>
        <!-- ... 다른 버튼들 ... -->
    </div>
<% } %>

# 퀴즈 프로젝트

## 테스트용 하드코딩된 파일 목록

현재 개발 및 테스트를 위해 다음 파일들에 하드코딩된 데이터가 포함되어 있습니다:

1. `routes/quiz.js`
   - 샘플 퀴즈 데이터 (시각적 효과 퀴즈)
   - 테스트용 정답 "123"
   - 문제 수 카운트 로직

2. `views/quiz/list.ejs`
   - 이미지 경로 ('/rogo.png')
   - 퀴즈 ID 조건문 (ID === 2)
   - 문제 수 선택 버튼

3. `views/quiz/play.ejs`
   - 테스트용 문제 텍스트
   - 답안 제출 폼

### 참고사항
- 위 하드코딩된 부분들은 추후 데이터베이스 연동 시 제거/수정될 예정입니다.
- 테스트용 퀴즈 2는 3문제로 구성된 간단한 테스트를 위해 임시로 추가되었습니다.