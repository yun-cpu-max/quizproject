const express = require('express');
const router = express.Router();
const quizData = require('../data/quizData');  // 퀴즈 데이터 가져오기
const testQuizData = require('../data/testQuizData');  // 테스트용 퀴즈 데이터
const db = require('../db'); // DB 연결 객체 불러오기

// 퀴즈 메인 페이지
router.get('/', (req, res) => {
    res.redirect('/');
});

// 특정 퀴즈 상세 페이지
router.get('/list/:id', (req, res) => {
    const quizId = parseInt(req.params.id);
    
    // quizData에서 해당 id의 퀴즈 찾기
    const quiz = quizData.quiz.find(q => q.id === quizId);
    
    if (!quiz) {
        return res.redirect('/');
    }
    
    // 퀴즈에 해당하는 문제들 찾기
    const questions = quizData.question.filter(q => q.quiz_id === quizId);
    
    // 객관식 문제인 경우 선택지도 가져오기
    if (quiz.category === 'choiceQuiz') {
        questions.forEach(question => {
            question.options = quizData.question_option.filter(opt => opt.question_id === question.id);
        });
    }
    
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
    res.render('quiz/create', { user: req.session.user, success: null, error: null });
});

// 퀴즈 생성 처리
router.post('/create', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const { title, description, category, questionType, questions } = req.body;
    const createdBy = req.session.user.id;

    // 1. 퀴즈 저장
    const quizQuery = 'INSERT INTO quiz (category, title, description) VALUES (?, ?, ?)';
    db.query(quizQuery, [category, title, description], (err, quizResult) => {
        if (err) {
            console.error('퀴즈 저장 실패:', err);
            return res.render('quiz/create', { user: req.session.user, error: '퀴즈 저장 중 오류가 발생했습니다.', success: null });
        }
        const quizId = quizResult.insertId;

        // 2. 문제 저장 (questions는 객체 배열)
        const questionArr = Object.values(questions);
        let totalQuestions = questionArr.length;
        let savedQuestions = 0;
        let hasError = false;

        questionArr.forEach((q, idx) => {
            // 문제 유형 결정
            let dbQuestionType = questionType === 'choice' ? 'multiple_choice' : 'short_answer';
            const questionQuery = 'INSERT INTO question (quiz_id, question, question_type, correct_answer, created_by) VALUES (?, ?, ?, ?, ?)';
            let correctAnswer = questionType === 'choice' ? '' : q.answer;
            db.query(questionQuery, [quizId, q.text, dbQuestionType, correctAnswer, createdBy], (err, questionResult) => {
                if (err) {
                    hasError = true;
                    console.error('문제 저장 실패:', err);
                    if (!hasError) {
                        hasError = true;
                        return res.render('quiz/create', { user: req.session.user, error: '문제 저장 중 오류가 발생했습니다.', success: null });
                    }
                }
                const questionId = questionResult.insertId;

                // 3. 객관식일 경우 선택지 저장
                if (questionType === 'choice') {
                    const options = [q.option1, q.option2, q.option3, q.option4];
                    const correctIdx = q.correct;
                    let savedOptions = 0;
                    options.forEach((opt, i) => {
                        const isCorrect = (correctIdx == (i+1)) ? 1 : 0;
                        const optionQuery = 'INSERT INTO question_option (question_id, option_text, is_correct, option_order) VALUES (?, ?, ?, ?)';
                        db.query(optionQuery, [questionId, opt, isCorrect, i+1], (err) => {
                            if (err) {
                                hasError = true;
                                console.error('선택지 저장 실패:', err);
                                if (!hasError) {
                                    hasError = true;
                                    return res.render('quiz/create', { user: req.session.user, error: '선택지 저장 중 오류가 발생했습니다.', success: null });
                                }
                            }
                            savedOptions++;
                            if (savedOptions === 4) {
                                savedQuestions++;
                                if (savedQuestions === totalQuestions && !hasError) {
                                    return res.render('quiz/create', { user: req.session.user, success: '퀴즈가 성공적으로 등록되었습니다!', error: null });
                                }
                            }
                        });
                    });
                } else {
                    // 주관식일 경우
                    savedQuestions++;
                    if (savedQuestions === totalQuestions && !hasError) {
                        return res.render('quiz/create', { user: req.session.user, success: '퀴즈가 성공적으로 등록되었습니다!', error: null });
                    }
                }
            });
        });
    });
});

// 퀴즈 플레이 페이지
router.get('/play', (req, res) => {
    // ID가 없는 경우 메인 페이지로 리다이렉트
    res.redirect('/quiz');
});

router.get('/play/:id', (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        const count = parseInt(req.query.count) || 10;
        
        // 퀴즈 정보 가져오기
        const quiz = quizData.quiz.find(q => q.id === quizId);
        if (!quiz) {
            throw new Error('퀴즈를 찾을 수 없습니다.');
        }

        // 해당 퀴즈의 문제들 가져오기
        const questions = quizData.question.filter(q => q.quiz_id === quizId);
        
        // URL의 count 파라미터가 변경되었거나 새로운 퀴즈를 시작할 경우 세션 초기화
        if (!req.session.quizId || 
            req.session.quizId !== quizId || 
            req.session.totalQuestions !== count) {
            
            req.session.quizId = quizId;
            req.session.currentQuestion = 1;
            req.session.totalQuestions = Math.min(count, questions.length);
            req.session.results = [];
        }

        const currentQuestionNum = req.session.currentQuestion;
        
        // 퀴즈 완료 체크
        if (currentQuestionNum > req.session.totalQuestions) {
            return res.redirect('/quiz/final-result');
        }

        const currentQuestion = questions[currentQuestionNum - 1];
        if (!currentQuestion) {
            throw new Error('문제를 찾을 수 없습니다.');
        }
        
        // 퀴즈 데이터 준비
        const quizPlayData = {
            quizId: quizId,
            questionImage: "/rogo.png",
            questionText: currentQuestion.question,
            totalQuestions: req.session.totalQuestions,
            currentQuestion: currentQuestionNum,
            questionType: currentQuestion.question_type
        };

        // 객관식 문제인 경우 선택지 추가 및 무작위 섞기
        if (currentQuestion.question_type === 'choice') {
            let options = quizData.question_option
                .filter(opt => opt.question_id === currentQuestion.id);
            
            // 선택지 무작위 섞기
            options = options.sort(() => Math.random() - 0.5);
            
            quizPlayData.options = options;
            
            // 객관식 템플릿 렌더링
            return res.render('quiz/choice-play', quizPlayData);
        }
        
        // 주관식 템플릿 렌더링
        res.render('quiz/play', quizPlayData);
    } catch (error) {
        console.error('퀴즈 플레이 페이지 에러:', error);
        res.redirect('/');
    }
});

// 퀴즈 정답 제출 처리
router.post('/submit', (req, res) => {
    try {
        const { answer, questionType } = req.body;
        const currentQuestionNum = req.session.currentQuestion || 1;
        const quizId = req.session.quizId;

        // 현재 문제 정보 가져오기
        const questions = quizData.question.filter(q => q.quiz_id === quizId);
        if (!questions || questions.length === 0) {
            throw new Error('퀴즈를 찾을 수 없습니다.');
        }

        const currentQuestion = questions[currentQuestionNum - 1];
        if (!currentQuestion || currentQuestion.question_type !== questionType) {
            throw new Error('문제를 찾을 수 없습니다.');
        }

        let isCorrect = false;
        let responseData = {};

        if (questionType === 'choice') {
            // 객관식 답안 처리
            const correctOption = quizData.question_option.find(opt => 
                opt.question_id === currentQuestion.id && 
                opt.is_correct
            );

            isCorrect = answer === correctOption.id.toString();
            responseData = {
                isCorrect,
                correctAnswer: correctOption.id.toString()
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