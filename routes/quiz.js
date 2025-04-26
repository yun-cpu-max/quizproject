const express = require('express');
const router = express.Router();
const { Quiz } = require('../models/Quiz');

// 퀴즈 메인 페이지
router.get('/', (req, res) => {
    res.redirect('/');
});

// 특정 퀴즈 상세 페이지
router.get('/list/:id', async (req, res) => {
    const quizId = parseInt(req.params.id);

    // DB에서 퀴즈 및 문제 불러오기
    const quiz = await Quiz.getById(quizId);

    if (!quiz) {
        return res.redirect('/');
    }

    // 문제 목록
    const questions = quiz.questions;

    // 객관식 문제라면 각 문제에 options가 포함되어 있음
    res.render('quiz/list', { 
        user: req.session.user,
        quiz: quiz,
        questions: questions,
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

router.get('/play/:id', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        const count = parseInt(req.query.count) || 10;

        // DB에서 퀴즈 정보 및 문제, 선택지 불러오기
        const quiz = await Quiz.getById(quizId);
        if (!quiz) {
            throw new Error('퀴즈를 찾을 수 없습니다.');
        }
        const questions = quiz.questions;

        // 세션 초기화 (count 파라미터 변경, 새로운 퀴즈 시작 시)
        if (!req.session.quizId || req.session.quizId !== quizId || req.session.totalQuestions !== count) {
            req.session.quizId = quizId;
            req.session.currentQuestion = 1;
            req.session.totalQuestions = Math.min(count, questions.length);
            req.session.results = [];
        }

        const currentQuestionNum = req.session.currentQuestion;
        if (currentQuestionNum > req.session.totalQuestions) {
            return res.redirect('/quiz/final-result');
        }

        const currentQuestion = questions[currentQuestionNum - 1];
        if (!currentQuestion) {
            throw new Error('문제를 찾을 수 없습니다.');
        }

        const quizPlayData = {
            quizId: quizId,
            questionImage: "/rogo.png",
            questionText: currentQuestion.question,
            totalQuestions: req.session.totalQuestions,
            currentQuestion: currentQuestionNum,
            questionType: currentQuestion.question_type
        };

        if (currentQuestion.question_type === 'choice') {
            let options = currentQuestion.options || [];
            options = options.sort(() => Math.random() - 0.5);
            quizPlayData.options = options;
            return res.render('quiz/choice-play', quizPlayData);
        }

        res.render('quiz/play', quizPlayData);
    } catch (error) {
        console.error('퀴즈 플레이 페이지 에러:', error);
        res.redirect('/');
    }
});

// 퀴즈 정답 제출 처리
router.post('/submit', async (req, res) => {
    try {
        const { answer, questionType } = req.body;
        const currentQuestionNum = req.session.currentQuestion || 1;
        const quizId = req.session.quizId;

        // DB에서 퀴즈 및 문제 불러오기
        const quiz = await Quiz.getById(quizId);
        if (!quiz || !quiz.questions || quiz.questions.length === 0) {
            throw new Error('퀴즈를 찾을 수 없습니다.');
        }

        const currentQuestion = quiz.questions[currentQuestionNum - 1];
        if (!currentQuestion || currentQuestion.question_type !== questionType) {
            throw new Error('문제를 찾을 수 없습니다.');
        }

        let isCorrect = false;
        let responseData = {};

        if (questionType === 'choice') {
            // 객관식 답안 처리
            const correctOption = (currentQuestion.options || []).find(opt => opt.is_correct);
            isCorrect = answer === String(correctOption.id);
            responseData = {
                isCorrect,
                correctAnswer: String(correctOption.id)
            };
        } else {
            // 주관식 답안 처리
            isCorrect = answer.trim().toLowerCase() === currentQuestion.correct_answer.trim().toLowerCase();
            responseData = {
                isCorrect,
                correctAnswer: currentQuestion.correct_answer
            };
        }

        // 결과 저장
        if (!req.session.results) {
            req.session.results = [];
        }
        req.session.results.push({
            questionId: currentQuestion.id,
            userAnswer: answer,
            isCorrect
        });

        // 다음 문제로 이동
        req.session.currentQuestion = currentQuestionNum + 1;

        res.json(responseData);
    } catch (error) {
        console.error('답안 제출 에러:', error);
        res.status(500).json({ error: '답안 처리 중 오류가 발생했습니다.' });
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
router.get('/final-result', async (req, res) => {
    try {
        const user = req.session.user;
        const quizId = req.session.quizId;
        const results = req.session.results || [];
        const totalQuestions = req.session.totalQuestions || results.length;
        const correctCount = results.filter(r => r.isCorrect).length;

        // DB에 결과 저장 (로그인한 경우만)
        if (user && quizId) {
            await Quiz.saveResult({
                user_id: user.id,
                quiz_id: quizId,
                score: correctCount,
                total_questions: totalQuestions
            });
        }

        // 상위 % 계산 예시 (실제 통계는 추가 쿼리 필요)
        const percentage = Math.round((correctCount / totalQuestions) * 100);

        res.render('quiz/final-result', {
            user: user,
            results: {
                correctCount,
                totalQuizzes: totalQuestions,
                percentage
            }
        });
    } catch (error) {
        console.error('최종 결과 처리 에러:', error);
        res.redirect('/');
    }
});

module.exports = router; 