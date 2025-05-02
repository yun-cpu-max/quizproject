const express = require('express');
const router = express.Router();
const db = require('../db');

// 관리자 페이지
router.get('/', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/');
    }

    const itemsPerPage = 10;
    const userPage = parseInt(req.query.userPage) || 1;
    const quizPage = parseInt(req.query.quizPage) || 1;

    // pending_quiz 테이블에서 대기 퀴즈 전체 조회
    db.query('SELECT * FROM pending_quiz', (err, pendingQuizzes) => {
        if (err) return res.send('대기 퀴즈 조회 오류');

        // 퀴즈 데이터 파싱
        pendingQuizzes = pendingQuizzes.map(quiz => {
            try {
                // MySQL의 JSON 타입이 이미 파싱되어 있는 경우를 처리
                if (typeof quiz.questions === 'string') {
                    quiz.questions = JSON.parse(quiz.questions);
                }
                // questions가 undefined인 경우 빈 배열로 초기화
                if (!quiz.questions) {
                    quiz.questions = [];
                }
            } catch (e) {
                console.error('퀴즈 데이터 파싱 오류:', e);
                quiz.questions = [];
            }
            return quiz;
        });

        // 모든 유저 정보 (페이지네이션 적용)
        const userOffset = (userPage - 1) * itemsPerPage;
        db.query('SELECT id, username, email, role FROM user LIMIT ? OFFSET ?', 
            [itemsPerPage, userOffset], (err, users) => {
            if (err) return res.send('유저 조회 오류');

            // 전체 유저 수 조회
            db.query('SELECT COUNT(*) as total FROM user', (err, userCountResult) => {
                if (err) return res.send('유저 수 조회 오류');
                const totalUsers = userCountResult[0].total;
                const totalUserPages = Math.ceil(totalUsers / itemsPerPage);

                // 모든 퀴즈 정보 (페이지네이션 적용)
                const quizOffset = (quizPage - 1) * itemsPerPage;
                db.query('SELECT id, title, category FROM quiz LIMIT ? OFFSET ?', 
                    [itemsPerPage, quizOffset], (err, quizzes) => {
                    if (err) return res.send('퀴즈 조회 오류');

                    // 전체 퀴즈 수 조회
                    db.query('SELECT COUNT(*) as total FROM quiz', (err, quizCountResult) => {
                        if (err) return res.send('퀴즈 수 조회 오류');
                        const totalQuizzes = quizCountResult[0].total;
                        const totalQuizPages = Math.ceil(totalQuizzes / itemsPerPage);

                        res.render('admin', {
                            user: req.session.user,
                            pendingQuizzes,
                            users,
                            quizzes,
                            userPagination: {
                                currentPage: userPage,
                                totalPages: totalUserPages
                            },
                            quizPagination: {
                                currentPage: quizPage,
                                totalPages: totalQuizPages
                            },
                            successMessage: req.query.success || null,
                            error: req.query.error || null
                        });
                    });
                });
            });
        });
    });
});

// 퀴즈 승인
router.post('/approve', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/');
    }
    const id = parseInt(req.body.idx);
    // pending_quiz에서 해당 퀴즈 데이터 조회
    db.query('SELECT * FROM pending_quiz WHERE id = ?', [id], (err, results) => {
        if (err || results.length === 0) return res.redirect('/admin');
        const quiz = results[0];
        let questions;
        try {
            questions = JSON.parse(quiz.questions);
            if (!Array.isArray(questions)) questions = [];
        } catch (e) {
            questions = [];
        }
        questions = questions.filter(q => q); // null 제거
        // 1. quiz 테이블에 저장
        db.query('INSERT INTO quiz (category, title, description, thumbnail_url) VALUES (?, ?, ?, ?)',
            [quiz.category, quiz.title, quiz.description, quiz.thumbnail_url], (err, result) => {
            if (err) return res.send('퀴즈 저장 오류');
            const quizId = result.insertId;
            // 2. 문제 저장
            const questionArr = Object.values(questions);
            questionArr.forEach((q) => {
                if (!q) return;
                let dbQuestionType = q.option1 ? 'multiple_choice' : 'short_answer';
                const questionQuery = 'INSERT INTO question (quiz_id, question, question_type, correct_answer) VALUES (?, ?, ?, ?)';
                let correctAnswer = dbQuestionType === 'multiple_choice' ? '' : (q.answer || '');
                db.query(questionQuery, [quizId, q.text, dbQuestionType, correctAnswer], (err, questionResult) => {
                    if (err) return;
                    const questionId = questionResult.insertId;
                    if (dbQuestionType === 'multiple_choice') {
                        const options = [q.option1, q.option2, q.option3, q.option4];
                        const correctIdx = q.correct;
                        options.forEach((opt, i) => {
                            const isCorrect = (correctIdx == (i+1)) ? 1 : 0;
                            const optionQuery = 'INSERT INTO question_option (question_id, option_text, is_correct, option_order) VALUES (?, ?, ?, ?)';
                            db.query(optionQuery, [questionId, opt, isCorrect, i+1]);
                        });
                    }
                });
            });
            // 3. pending_quiz에서 삭제
            db.query('DELETE FROM pending_quiz WHERE id = ?', [id], () => {
                res.redirect('/admin');
            });
        });
    });
});

// 퀴즈 거절
router.post('/reject', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/');
    }
    const id = parseInt(req.body.idx);
    db.query('DELETE FROM pending_quiz WHERE id = ?', [id], () => {
        res.redirect('/admin');
    });
});

// 공지사항 작성
router.post('/notice', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/');
    }
    const { title, content } = req.body;
    db.query('INSERT INTO notice (title, content) VALUES (?, ?)', [title, content], (err) => {
        if (err) {
            console.error('공지사항 등록 실패:', err);
            return res.redirect('/admin?error=공지사항 등록에 실패했습니다.');
        }
        res.redirect('/notice?success=공지사항이 성공적으로 등록되었습니다.');
    });
});

module.exports = router; 