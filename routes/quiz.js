const express = require('express');
const router = express.Router();

// 퀴즈 메인 페이지
router.get('/', (req, res) => {
    // 샘플 퀴즈 데이터
    const quizzes = [
        {
            id: 1,
            title: "시각적 효과 퀴즈",
            description: "이미지를 보고 답을 맞춰보세요",
            thumbnail: "/images/quiz1.jpg"
        }
    ];
    
    res.render('quiz/index', { 
        user: req.session.user,
        quizzes: quizzes
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
router.get('/play/:id', (req, res) => {
    // 샘플 퀴즈 데이터
    const quizId = req.params.id;
    const quizData = {
        quizId: quizId,
        questionImage: "/images/sample-question.jpg",
        questionText: "샘플 문제입니다."
    };
    
    res.render('quiz/play', quizData);
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

// 퀴즈 결과 페이지
router.get('/result/:id', (req, res) => {
    const isCorrect = req.query.correct === 'true';
    
    res.render('quiz/result', {
        user: req.session.user,
        isCorrect: isCorrect,
        correctAnswer: "123"
    });
});

module.exports = router; 