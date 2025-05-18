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
    const userSearchId = req.query.userSearchId || '';
    const userSearchName = req.query.userSearchName || '';
    const quizSearchId = req.query.quizSearchId || '';
    const quizSearchTitle = req.query.quizSearchTitle || '';

    // pending_quiz 테이블에서 대기 퀴즈 전체 조회
    db.query('SELECT * FROM pending_quiz', (err, pendingQuizzes) => {
        if (err) return res.send('대기 퀴즈 조회 오류');

        // 퀴즈 데이터 파싱
        pendingQuizzes = pendingQuizzes.map(quiz => {
            let questions = [];
            if (Array.isArray(quiz.questions)) {
                questions = quiz.questions;
            } else if (typeof quiz.questions === 'string') {
                try {
                    questions = JSON.parse(quiz.questions);
                } catch (e) {
                    questions = [];
                }
            }
            return { ...quiz, questions };
        });

        // 유저 검색 조건 구성
        let userQuery = 'SELECT id, username, email, role FROM user';
        let userCountQuery = 'SELECT COUNT(*) as total FROM user';
        const userParams = [];
        
        if (userSearchId || userSearchName) {
            const conditions = [];
            if (userSearchId) {
                conditions.push('id LIKE ?');
                userParams.push(`%${userSearchId}%`);
            }
            if (userSearchName) {
                conditions.push('username LIKE ?');
                userParams.push(`%${userSearchName}%`);
            }
            const whereClause = conditions.join(' AND ');
            userQuery += ` WHERE ${whereClause}`;
            userCountQuery += ` WHERE ${whereClause}`;
        }
        
        userQuery += ' LIMIT ? OFFSET ?';
        userParams.push(itemsPerPage, (userPage - 1) * itemsPerPage);

        // 퀴즈 검색 조건 구성
        let quizQuery = 'SELECT id, title, category FROM quiz';
        let quizCountQuery = 'SELECT COUNT(*) as total FROM quiz';
        const quizParams = [];
        
        if (quizSearchId || quizSearchTitle) {
            const conditions = [];
            if (quizSearchId) {
                conditions.push('id LIKE ?');
                quizParams.push(`%${quizSearchId}%`);
            }
            if (quizSearchTitle) {
                conditions.push('title LIKE ?');
                quizParams.push(`%${quizSearchTitle}%`);
            }
            const whereClause = conditions.join(' AND ');
            quizQuery += ` WHERE ${whereClause}`;
            quizCountQuery += ` WHERE ${whereClause}`;
        }
        
        quizQuery += ' LIMIT ? OFFSET ?';
        quizParams.push(itemsPerPage, (quizPage - 1) * itemsPerPage);

        // 모든 유저 정보 (페이지네이션 적용)
        db.query(userQuery, userParams, (err, users) => {
            if (err) return res.send('유저 조회 오류');

            // 전체 유저 수 조회
            db.query(userCountQuery, userParams.slice(0, -2), (err, userCountResult) => {
                if (err) return res.send('유저 수 조회 오류');
                const totalUsers = userCountResult[0].total;
                const totalUserPages = Math.ceil(totalUsers / itemsPerPage);

                // 모든 퀴즈 정보 (페이지네이션 적용)
                db.query(quizQuery, quizParams, (err, quizzes) => {
                    if (err) return res.send('퀴즈 조회 오류');

                    // 전체 퀴즈 수 조회
                    db.query(quizCountQuery, quizParams.slice(0, -2), (err, quizCountResult) => {
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
                            userSearchId,
                            userSearchName,
                            quizSearchId,
                            quizSearchTitle,
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
            questions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
            if (!Array.isArray(questions)) questions = [];
        } catch (e) {
            questions = [];
        }
        console.log('파싱 후 questions:', questions, Array.isArray(questions), questions.length);

        if (questions.length === 0) {
            console.error('문제 데이터가 비어있음. pending_quiz만 삭제');
            db.query('DELETE FROM pending_quiz WHERE id = ?', [id], () => {
                res.redirect('/admin');
            });
            return;
        }

        // 1. quiz 테이블에 저장
        db.query(
            'INSERT INTO quiz (category, title, description, thumbnail_url, created_by) VALUES (?, ?, ?, ?, ?)',
            [quiz.category, quiz.title, quiz.description, quiz.thumbnail_url, quiz.created_by],
            (err, result) => {
                if (err) {
                    console.error('퀴즈 저장 오류:', err);
                    return res.redirect('/admin?error=퀴즈 저장 오류');
                }
                const quizId = result.insertId; // 진짜 quiz_id!

                // 2. question 테이블에 저장
                const insertQuestions = questions.map((q) => {
                    return new Promise((resolve, reject) => {
                        if (!q) return resolve();
                        if (!q.text || !q.question_type) {
                            console.error('필수값 누락: text 또는 question_type', q);
                            return resolve();
                        }
                        let correctAnswer = '';
                        if (q.question_type === 'multiple_choice') {
                            const options = [q.option1, q.option2, q.option3, q.option4];
                            const correctIdx = parseInt(q.correct, 10) - 1;
                            correctAnswer = options[correctIdx] || '';
                            if (!correctAnswer) {
                                console.error('객관식 정답 누락: correct_answer', q);
                                return resolve();
                            }
                        } else {
                            correctAnswer = q.answer || '';
                            if (!correctAnswer) {
                                console.error('주관식 정답 누락: correct_answer', q);
                                return resolve();
                            }
                        }
                        db.query(
                            'INSERT INTO question (quiz_id, question, question_type, correct_answer, created_by, question_img_url) VALUES (?, ?, ?, ?, ?, ?)',
                            [
                                quizId, // quiz 테이블의 id 사용!
                                q.text,
                                q.question_type,
                                correctAnswer,
                                q.created_by || quiz.created_by,
                                q.question_img_url || quiz.thumbnail_url
                            ],
                            (err, questionResult) => {
                                if (err) {
                                    console.error('문제 저장 오류(개별):', err, q);
                                    return reject(err);
                                }
                                const questionId = questionResult.insertId;
                                console.log('문제 저장 성공:', { questionId, ...q });
                                if (q.question_type === 'multiple_choice') {
                                    const options = [q.option1, q.option2, q.option3, q.option4];
                                    const correctIdx = q.correct;
                                    options.forEach((opt, i) => {
                                        const isCorrect = (correctIdx == (i+1)) ? 1 : 0;
                                        const optionQuery = 'INSERT INTO question_option (question_id, option_text, is_correct, option_order) VALUES (?, ?, ?, ?)';
                                        db.query(optionQuery, [questionId, opt, isCorrect, i+1]);
                                    });
                                }
                                resolve();
                            }
                        );
                    });
                });

                Promise.all(insertQuestions)
                    .then(() => {
                        console.log('모든 문제 저장 완료');
                        db.query('DELETE FROM pending_quiz WHERE id = ?', [id], () => {
                            res.redirect('/admin');
                        });
                    })
                    .catch((err) => {
                        console.error('문제 저장 중 오류 발생(전체):', err);
                        res.send('문제 저장 중 오류 발생: ' + err);
                    });
            }
        );
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