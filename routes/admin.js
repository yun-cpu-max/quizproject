const express = require('express');
const router = express.Router();
const db = require('../db');
const { ensureAdmin } = require('../middleware/authMiddleware');

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

// 관리자 대시보드 페이지
router.get('/dashboard', ensureAdmin, async (req, res) => {
    try {
        // 1. 사용자 수 조회
        const userCountQuery = 'SELECT COUNT(*) AS count FROM user;';
        // 2. 전체 퀴즈 수 조회 (pending_quiz 제외, 실제 quiz 테이블 기준)
        const quizCountQuery = 'SELECT COUNT(*) AS count FROM quiz;';
        // 3. 승인 대기 퀴즈 수 조회
        const pendingCountQuery = 'SELECT COUNT(*) AS count FROM pending_quiz;'; // status 조건 제거
        // 4. 주간 평균 응시 (지난 7일간의 quiz_results 수 / 7) - 예시 단순화
        const weeklyAttemptsQuery = `
            SELECT COUNT(*) AS count 
            FROM quiz_results 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY);
        `;
        // 5. 승인 대기 퀴즈 목록 (최신순 5개) + 작성자 username
        const pendingQuizzesQuery = `
            SELECT pq.*, u.username AS created_by_username 
            FROM pending_quiz pq
            LEFT JOIN user u ON pq.created_by = u.id
            ORDER BY pq.created_at DESC 
            LIMIT 5;
        `; // status 조건 제거
        // 6. 인기 퀴즈 (응시 횟수 기준 TOP 5) - quiz_results 테이블을 quiz_id로 그룹화하여 count
        const popularQuizzesQuery = `
            SELECT q.id, q.title, COUNT(qr.id) AS attempt_count
            FROM quiz q
            JOIN quiz_results qr ON q.id = qr.quiz_id
            GROUP BY q.id, q.title
            ORDER BY attempt_count DESC
            LIMIT 5;
        `;

        const [userCountRows, quizCountRows, pendingCountRows, weeklyAttemptsRows, pendingQuizzes, popularQuizzes] = await Promise.all([
            db.promise().query(userCountQuery),
            db.promise().query(quizCountQuery),
            db.promise().query(pendingCountQuery),
            db.promise().query(weeklyAttemptsQuery),
            db.promise().query(pendingQuizzesQuery),
            db.promise().query(popularQuizzesQuery)
        ]);

        const userCount = userCountRows[0][0].count;
        const quizCount = quizCountRows[0][0].count;
        const pendingCount = pendingCountRows[0][0].count;
        const weeklyTotalAttempts = weeklyAttemptsRows[0][0].count;
        const weeklyAverageAttempts = weeklyTotalAttempts > 0 ? (weeklyTotalAttempts / 7).toFixed(1) : 0;

        res.render('admin/dashboard_admin', {
            layout: 'layout_admin', // 관리자용 레이아웃을 사용한다고 가정
            user: req.user, // 현재 로그인한 관리자 정보
            userCount,
            quizCount,
            pendingCount,
            weeklyAverageAttempts,
            pendingQuizzes: pendingQuizzes[0],
            popularQuizzes: popularQuizzes[0],
            // 필요한 경우, 실제 통계 그래프용 데이터도 여기에서 준비하여 전달
        });

    } catch (error) {
        console.error('관리자 대시보드 데이터 조회 오류:', error);
        res.status(500).send('서버 오류가 발생했습니다.');
    }
});

module.exports = router; 