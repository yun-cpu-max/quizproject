const express = require('express');
const router = express.Router();
const { Quiz } = require('../models/Quiz');
const db = require('../db'); // DB 연결 객체 불러오기
const path = require('path');
const multer = require('multer');
const upload = multer({
    dest: path.join(__dirname, '../public/uploads/'),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// 퀴즈 메인 페이지
router.get('/', (req, res) => {
    res.redirect('/');
});

// 특정 퀴즈 상세 페이지
router.get('/list/:id', (req, res) => {
    const quizId = req.params.id;
    
    // 조회수 증가
    db.query('UPDATE quiz SET views = views + 1 WHERE id = ?', [quizId], (err) => {
        if (err) {
            console.error('조회수 업데이트 실패:', err);
        }
        
        // 퀴즈 정보 조회
        db.query('SELECT * FROM quiz WHERE id = ?', [quizId], (err, results) => {
            if (err || results.length === 0) {
                return res.redirect('/');
            }
            const quiz = results[0];
            // 문제 개수 조회
            db.query('SELECT COUNT(*) AS count FROM question WHERE quiz_id = ?', [quizId], (err, qResults) => {
                const questionCount = (qResults && qResults[0]) ? qResults[0].count : 0;
                res.render('quiz/list', { quiz: quiz, user: req.session.user, questionCount });
            });
        });
    });
});

// 퀴즈 생성 페이지
router.get('/create', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('quiz/create', { user: req.session.user, success: null, error: null });
});

// 퀴즈 생성 처리
router.post('/create', upload.single('thumbnailImage'), (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const { title, description, category, questionType, questions, thumbnailType } = req.body;
    // 썸네일 경로 결정
    let thumbnailUrl = '';
    if (thumbnailType === 'default') {
        thumbnailUrl = '/rogo.png';
    } else if (thumbnailType === 'custom' && req.file) {
        thumbnailUrl = '/uploads/' + req.file.filename;
    }

    // questions를 배열로 변환 후 null 값 제거
    let questionsArr = Object.values(questions).filter(q => q);
    const questionsJson = JSON.stringify(questionsArr);

    // pending_quiz 테이블에 저장
    db.query('INSERT INTO pending_quiz (category, title, description, thumbnail_url, questions, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [category, title, description, thumbnailUrl, questionsJson, req.session.user.id], (err) => {
        if (err) {
            console.error('퀴즈 신청 저장 실패:', err);
            return res.render('quiz/create', { user: req.session.user, error: '퀴즈 신청 저장 중 오류가 발생했습니다.', success: null });
        }
        return res.render('quiz/create', { user: req.session.user, success: '퀴즈 신청성공 검토후 등록', error: null });
    });
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
        const reset = req.query.reset === '1';

        // DB에서 퀴즈 정보 및 문제, 선택지 불러오기
        const quiz = await Quiz.getById(quizId);
        if (!quiz) {
            throw new Error('퀴즈를 찾을 수 없습니다.');
        }
        let questions;
        try {
            questions = JSON.parse(quiz.questions);
            console.log('파싱된 questions:', questions);
            if (!Array.isArray(questions)) questions = [];
        } catch (e) {
            console.error('questions 파싱 오류:', e);
            questions = [];
        }

        // reset 파라미터가 있거나, 기존 조건에 해당하면 세션 초기화
        if (reset || !req.session.quizId || req.session.quizId !== quizId || !req.session.questionOrder || req.session.totalQuestions !== count) {
            req.session.quizId = quizId;
            req.session.currentQuestion = 1;
            req.session.totalQuestions = Math.min(count, questions.length);
            // 문제 id 배열을 랜덤하게 섞어서 세션에 저장
            const questionIds = questions.map(q => q.id);
            for (let i = questionIds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [questionIds[i], questionIds[j]] = [questionIds[j], questionIds[i]];
            }
            req.session.questionOrder = questionIds.slice(0, req.session.totalQuestions);
            req.session.results = [];
            req.session.resultSaved = false; // 결과 저장 플래그 초기화
        }

        const currentQuestionNum = req.session.currentQuestion;
        if (currentQuestionNum > req.session.totalQuestions) {
            return res.redirect('/quiz/final-result');
        }

        // 세션의 랜덤 문제 id 배열에서 현재 문제 id를 가져옴
        const currentQuestionId = req.session.questionOrder[currentQuestionNum - 1];
        const currentQuestion = questions.find(q => q.id === currentQuestionId);
        if (!currentQuestion) {
            throw new Error('문제를 찾을 수 없습니다.');
        }

        const quizPlayData = {
            quizId: quizId,
            questionImage: "/rogo.png",
            questionText: currentQuestion.question,
            totalQuestions: req.session.totalQuestions,
            currentQuestion: currentQuestionNum,
            questionType: currentQuestion.question_type,
            category: quiz.category
        };

        if (currentQuestion.question_type === 'multiple_choice') {
            let options = currentQuestion.options || [];
            options = options.sort(() => Math.random() - 0.5);
            quizPlayData.options = options;
            return res.render('quiz/choice-play', { ...quizPlayData, user: req.session.user });
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
        const questionOrder = req.session.questionOrder;
        const user = req.session.user;

        // 디버깅: 세션 상태 로그
        console.log('[SUBMIT] resultSaved:', req.session.resultSaved, '| currentQuestion:', currentQuestionNum, '| totalQuestions:', req.session.totalQuestions);

        // DB에서 퀴즈 및 문제 불러오기
        const quiz = await Quiz.getById(quizId);
        if (!quiz || !quiz.questions || quiz.questions.length === 0) {
            throw new Error('퀴즈를 찾을 수 없습니다.');
        }

        // 세션의 랜덤 문제 id 배열에서 현재 문제 id를 가져옴
        const currentQuestionId = questionOrder[currentQuestionNum - 1];
        const currentQuestion = quiz.questions.find(q => q.id === currentQuestionId);
        if (!currentQuestion || currentQuestion.question_type !== questionType) {
            throw new Error('문제를 찾을 수 없습니다.');
        }

        let isCorrect = false;
        let responseData = {};

        if (questionType === 'multiple_choice') {
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

        // 마지막 문제 제출 시 DB에 결과 저장 (로그인한 경우만, 중복 방지)
        if (user && quizId && currentQuestionNum === req.session.totalQuestions && !req.session.resultSaved) {
            const correctCount = req.session.results.filter(r => r.isCorrect).length;
            await Quiz.saveResult({
                user_id: user.id,
                quiz_id: quizId,
                score: correctCount,
                total_questions: req.session.totalQuestions
            });
            req.session.resultSaved = true; // 결과 저장 플래그
        }

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

        // 디버깅: 세션 상태 로그
        console.log('[FINAL-RESULT] resultSaved:', req.session.resultSaved, '| results.length:', results.length, '| correctCount:', correctCount);

        // 상위 % 계산 예시 (실제 통계는 추가 쿼리 필요)
        const percentage = Math.round((correctCount / totalQuestions) * 100);

        res.render('quiz/final-result', {
            user: user,
            results: {
                correctCount,
                totalQuizzes: totalQuestions,
                percentage
            },
            quizId
        });
    } catch (error) {
        console.error('최종 결과 처리 에러:', error);
        res.redirect('/');
    }
});

// 대시보드(전체 통계) 라우트
router.get('/dashboard/:quizId', async (req, res) => {
    const quizId = parseInt(req.params.quizId);
    const stats = await Quiz.getStatsByQuizId(quizId);
    res.render('quiz/dashboard', { stats, quizId });
});

module.exports = router;

