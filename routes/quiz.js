const express = require('express');
const router = express.Router();
const quizData = require('../data/quizData');  // 퀴즈 데이터 가져오기

// 퀴즈 메인 페이지
router.get('/', (req, res) => {
    res.render('quiz/list', { 
        user: req.session.user,
        quizzes: quizData,
        isSingleQuiz: false
    });
});

// 특정 퀴즈 상세 페이지
router.get('/list/:id', (req, res) => {
    const quizId = parseInt(req.params.id);
    
    // quizData 배열에서 해당 id의 퀴즈 찾기
    const quiz = quizData.find(img => img.id === quizId);
    
    if (!quiz) {
        return res.redirect('/quiz');
    }
    
    res.render('quiz/list', { 
        user: req.session.user,
        quiz: quiz,
        isSingleQuiz: true
    });
});

// 퀴즈 생성 페이지
router.get('/create', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('quiz/create', { user: req.session.user });
});

// 퀴즈 생성 처리
router.post('/create', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    // 퀴즈 생성 로직 구현
    // req.body에서 퀴즈 데이터 추출
    res.redirect('/quiz');
});

// 퀴즈 플레이 페이지
router.get('/play', (req, res) => {
    // ID가 없는 경우 메인 페이지로 리다이렉트
    res.redirect('/quiz');
});

router.get('/play/:id', (req, res) => {
    try {
        const quizId = req.params.id;
        const count = parseInt(req.query.count) || 10; // 기본값 10문제
        
        // 퀴즈 데이터 (실제로는 DB에서 가져와야 함)
        const quizData = {
            quizId: quizId,
            questionImage: "/rogo.png",  // 임시로 로고 이미지 사용
            questionText: "정답이 123인 테스트 문항",
            totalQuestions: count,
            currentQuestion: 1
        };
        
        // 세션에 총 문제 수 저장
        req.session.totalQuestions = count;
        req.session.currentQuestion = 1;
        
        res.render('quiz/play', quizData);
    } catch (error) {
        console.error('퀴즈 플레이 페이지 에러:', error);
        res.redirect('/quiz');
    }
});

// 퀴즈 정답 제출 처리
router.post('/submit/:id', (req, res) => {
    const answer = req.body.answer;
    const quizId = req.params.id;
    
    // 정답 체크 로직
    const isCorrect = answer === "123"; // 실제로는 DB에서 정답을 확인해야 함
    
    if (isCorrect) {
        res.redirect(`/quiz/result/${quizId}?correct=true`);
    } else {
        res.redirect(`/quiz/result/${quizId}?correct=false`);
    }
});

// 개별 문제 결과 페이지
router.get('/result/:id', (req, res) => {
    const isCorrect = req.query.correct === 'true';
    const quizId = parseInt(req.params.id);
    const nextQuizId = quizId + 1;
    const totalQuizzes = 10; // 실제로는 DB에서 가져와야 함
    
    // 마지막 문제인 경우
    if (quizId >= totalQuizzes) {
        res.redirect('/quiz/final-result');
        return;
    }
    
    res.render('quiz/question-result', {
        user: req.session.user,
        isCorrect: isCorrect,
        nextQuizId: nextQuizId,
        currentQuizId: quizId,
        totalQuizzes: totalQuizzes
    });
});

// 최종 결과 페이지
router.get('/final-result', (req, res) => {
    // 실제로는 세션이나 DB에서 사용자의 퀴즈 결과를 가져와야 함
    const sampleResults = {
        correctCount: 6,
        totalQuizzes: 10,
        percentage: 30
    };
    
    res.render('quiz/final-result', {
        user: req.session.user,
        results: sampleResults
    });
});

module.exports = router; 