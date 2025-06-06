const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');

// 알림 발송 헬퍼 함수
function sendNotificationToUser(userId, title, message, priority = 0, createdBy = 1) {
    return new Promise((resolve, reject) => {
        const insertNotificationQuery = `
            INSERT INTO notifications (title, message, notification_type, priority, is_system_wide, created_by)
            VALUES (?, ?, 'info', ?, 0, ?)
        `;
        
        db.query(insertNotificationQuery, [title, message, priority, createdBy], (err, result) => {
            if (err) {
                return reject(err);
            }
            
            const notificationId = result.insertId;
            
            const insertUserNotificationQuery = `
                INSERT INTO user_notifications (user_id, notification_id, is_read)
                VALUES (?, ?, 0)
            `;
            
            db.query(insertUserNotificationQuery, [userId, notificationId], (err) => {
                if (err) {
                    return reject(err);
                }
                resolve(notificationId);
            });
        });
    });
}

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

    // pending_quiz 테이블에서 대기 퀴즈 전체 조회 (신청자 이름 포함)
    db.query('SELECT pending_quiz.*, user.username FROM pending_quiz JOIN user ON pending_quiz.created_by = user.id', (err, pendingQuizzes) => {
        if (err) return res.send('대기 퀴즈 조회 오류: ' + err.message);

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
                            notificationMessage: req.query.notification || null,
                            error: req.query.error || null
                        });
                    });
                });
            });
        });
    });
});

// 특정 퀴즈 상세 정보 조회
router.get('/quizzes/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const quizId = parseInt(req.params.id);
    if (isNaN(quizId)) {
        return res.status(400).json({ message: 'Invalid quiz ID' });
    }

    try {
        // 1. 퀴즈 기본 정보 조회
        const quizResult = await new Promise((resolve, reject) => {
            db.query('SELECT id, category, title, description FROM quiz WHERE id = ?', [quizId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (quizResult.length === 0) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const quiz = quizResult[0];
        const questions = [];

        // 2. 해당 퀴즈의 문제 목록 조회
        const questionsResult = await new Promise((resolve, reject) => {
            db.query('SELECT id, question, question_type, correct_answer, question_img_url FROM question WHERE quiz_id = ?', [quizId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        // 3. 각 문제에 대한 상세 정보 (객관식 보기 등) 조회
        for (const question of questionsResult) {
            let options = null;
            if (question.question_type === 'multiple_choice') {
                options = await new Promise((resolve, reject) => {
                    db.query('SELECT id, option_text, is_correct, option_order FROM question_option WHERE question_id = ? ORDER BY option_order', [question.id], (err, results) => {
                        if (err) return reject(err);
                        resolve(results);
                    });
                });
                 // is_correct가 1인 option의 option_order를 correct로 사용
                 const correctOption = options.find(opt => opt.is_correct);
                 question.correct = correctOption ? correctOption.option_order : null;
                 question.options = options.map(opt => ({ num: opt.option_order, text: opt.option_text }));
                 // question 테이블의 correct_answer는 주관식에만 사용되므로 객관식에선 null 또는 undefined 처리
                 delete question.correct_answer; // 불필요한 정보 제거

            } else if (question.question_type === 'short_answer') {
                 // 주관식은 options 필요 없음
                 // question 테이블의 correct_answer를 answer로 사용
                 question.answer = question.correct_answer;
                 delete question.correct_answer; // 필드 이름 통일
            }
             // 공통 필드 이름 통일
             question.text = question.question;
             delete question.question; // 필드 이름 통일

            questions.push(question);
        }

        // 4. 최종 데이터 응답
        res.json({ ...quiz, questions });

    } catch (err) {
        console.error('Error fetching quiz details:', err);
        res.status(500).json({ message: 'Error fetching quiz details' });
    }
});

// 퀴즈 승인
router.post('/approve', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/');
    }
    const id = parseInt(req.body.idx);
    console.log(`[퀴즈 승인] 관리자 ID: ${req.session.user.id}, 퀴즈 ID: ${id}`);
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
        // 썸네일이 temp 폴더에 있으면 thumbnails 폴더로 이동
        let thumbnailUrl = quiz.thumbnail_url;
        if (thumbnailUrl && thumbnailUrl.startsWith('/uploads/temp/')) {
            const fileName = path.basename(thumbnailUrl);
            const oldPath = path.join(__dirname, '../public', thumbnailUrl.replace(/\//g, path.sep));
            const thumbnailsDir = path.join(__dirname, '../public/uploads/thumbnails/');
            if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });
            const newPath = path.join(thumbnailsDir, fileName);
            try {
                fs.copyFileSync(oldPath, newPath);
                fs.unlinkSync(oldPath);
                thumbnailUrl = '/uploads/thumbnails/' + fileName;
            } catch (e) {
                console.error('썸네일 이미지 이동 실패:', e);
            }
        }
        db.query(
            'INSERT INTO quiz (category, title, description, thumbnail_url, created_by) VALUES (?, ?, ?, ?, ?)',
            [quiz.category, quiz.title, quiz.description, thumbnailUrl, quiz.created_by],
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
                        // 문제 이미지가 임시 폴더에 있으면 실제 폴더로 이동
                        let questionImageUrl = q.question_img_url || q.image || null;
                        if (questionImageUrl && questionImageUrl.startsWith('/uploads/temp/')) {
                            const fileName = path.basename(questionImageUrl);
                            const oldPath = path.join(__dirname, '../public', questionImageUrl.replace(/\//g, path.sep));
                            const questionsDir = path.join(__dirname, '../public/uploads/questions/');
                            if (!fs.existsSync(questionsDir)) fs.mkdirSync(questionsDir, { recursive: true });
                            const newPath = path.join(questionsDir, fileName);
                            try {
                                fs.copyFileSync(oldPath, newPath);
                                fs.unlinkSync(oldPath);
                                questionImageUrl = '/uploads/questions/' + fileName;
                            } catch (e) {
                                console.error('문제 이미지 이동 실패:', e);
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
                                questionImageUrl // 실제 경로로 저장
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
                    .then(async () => {
                        console.log('모든 문제 저장 완료');
                        
                        // 퀴즈 작성자에게 승인 알림 발송
                        try {
                            const notificationTitle = "신청한 퀴즈가 승인되었습니다.";
                            const notificationMessage = `${quiz.title} 퀴즈가 승인받아 성공적으로 등록되었습니다.`;
                            
                            await sendNotificationToUser(quiz.created_by, notificationTitle, notificationMessage, 1, req.session.user.id);
                            console.log('퀴즈 승인 알림 발송 완료:', quiz.created_by);
                        } catch (notificationError) {
                            console.error('퀴즈 승인 알림 발송 실패:', notificationError);
                        }
                        
                        db.query('DELETE FROM pending_quiz WHERE id = ?', [id], () => {
                            res.redirect('/admin?success=퀴즈가 성공적으로 승인되었습니다.');
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
router.post('/reject', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/');
    }
    const id = parseInt(req.body.idx);
    const rejectReason = req.body.rejectReason || '승인 기준에 부합하지 않습니다.';

    // 1. pending_quiz에서 해당 퀴즈 데이터 조회
    db.query('SELECT * FROM pending_quiz WHERE id = ?', [id], async (err, results) => {
        if (err || results.length === 0) {
            db.query('DELETE FROM pending_quiz WHERE id = ?', [id], () => {
                return res.redirect('/admin');
            });
            return;
        }
        const quiz = results[0];
        
        // 퀴즈 작성자에게 거절 알림 발송
        try {
            const notificationTitle = "신청한 퀴즈가 거절되었습니다.";
            const notificationMessage = `${quiz.title} 퀴즈가 거절되었습니다.\n\n거절 사유: ${rejectReason}`;
            
            await sendNotificationToUser(quiz.created_by, notificationTitle, notificationMessage, 1, req.session.user.id);
        } catch (notificationError) {
            console.error('퀴즈 거절 알림 발송 실패:', notificationError);
        }

        // 2. 문제 이미지 삭제
        let questions = [];
        try {
            questions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
            if (!Array.isArray(questions)) questions = [];
        } catch (e) {
            questions = [];
        }
        questions.forEach(q => {
            const imgUrl = q.question_img_url || q.image;
            if (imgUrl && imgUrl.startsWith('/uploads/temp/')) {
                const filePath = path.join(__dirname, '../public', imgUrl.replace(/\//g, path.sep));
                if (fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch (e) { }
                }
            }
        });

        // 3. 썸네일 이미지 삭제 (임시폴더에 있을 때만)
        if (quiz.thumbnail_url && quiz.thumbnail_url.startsWith('/uploads/temp/')) {
            const thumbPath = path.join(__dirname, '../public', quiz.thumbnail_url.replace(/\//g, path.sep));
            if (fs.existsSync(thumbPath)) {
                try { fs.unlinkSync(thumbPath); } catch (e) { }
            }
        }

        // 4. DB에서 삭제
        db.query('DELETE FROM pending_quiz WHERE id = ?', [id], () => {
            res.redirect('/admin?success=퀴즈가 거절되었습니다.');
        });
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

// 알림 등록
router.post('/notification', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/');
    }

    const { targetType, targetUsers, title, message, isImportant } = req.body;
    const createdBy = req.session.user.id;
    const priority = isImportant ? 1 : 0; // 1: 중요, 0: 일반
    const isSystemWide = targetType === 'all' ? 1 : 0;

    // 알림 생성
    const insertNotificationQuery = `
        INSERT INTO notifications (title, message, notification_type, priority, is_system_wide, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(insertNotificationQuery, [title, message, 'info', priority, isSystemWide, createdBy], (err, result) => {
        if (err) {
            console.error('알림 등록 실패:', err);
            return res.redirect('/admin?error=알림 등록에 실패했습니다.');
        }

        const notificationId = result.insertId;

        if (targetType === 'all') {
            // 모든 유저에게 알림
            const insertUserNotificationsQuery = `
                INSERT INTO user_notifications (user_id, notification_id, is_read)
                SELECT id, ?, 0 FROM user WHERE role != 'admin'
            `;
            
            db.query(insertUserNotificationsQuery, [notificationId], (err) => {
                if (err) {
                    console.error('전체 유저 알림 등록 실패:', err);
                    return res.redirect('/admin?error=전체 유저 알림 등록에 실패했습니다.');
                }
                res.redirect('/admin?notification=모든 유저에게 알림이 성공적으로 등록되었습니다.');
            });
        } else if (targetType === 'specific' && targetUsers) {
            // 특정 유저들에게 알림
            const userIds = Array.isArray(targetUsers) ? targetUsers : [targetUsers];
            
            if (userIds.length === 0) {
                return res.redirect('/admin?error=대상 유저를 선택해주세요.');
            }

            const insertUserNotificationsQuery = `
                INSERT INTO user_notifications (user_id, notification_id, is_read)
                VALUES ?
            `;
            
            const values = userIds.map(userId => [userId, notificationId, 0]);
            
            db.query(insertUserNotificationsQuery, [values], (err) => {
                if (err) {
                    console.error('특정 유저 알림 등록 실패:', err);
                    return res.redirect('/admin?error=특정 유저 알림 등록에 실패했습니다.');
                }
                res.redirect(`/admin?notification=${userIds.length}명의 유저에게 알림이 성공적으로 등록되었습니다.`);
            });
        } else {
            res.redirect('/admin?error=대상을 선택해주세요.');
        }
    });
});

module.exports = router; 