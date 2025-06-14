const express = require('express');
const router = express.Router();
const { Quiz } = require('../models/Quiz');
const db = require('../db'); // DB 연결 객체 불러오기
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// 커스텀 storage: 필드명에 따라 폴더 분기
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 썸네일과 문제 이미지 모두 temp 폴더에 저장
        if (file.fieldname === 'thumbnailImage' || file.fieldname.startsWith('questionImage')) {
            const dir = path.join(__dirname, '../public/uploads/temp/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        } else {
            cb(new Error('Unknown fieldname: ' + file.fieldname));
        }
    },
    filename: function (req, file, cb) {
        const userId = req.session.user ? req.session.user.id : 'guest';
        if (!req.session.uploadTimestamp) {
            req.session.uploadTimestamp = Date.now();
        }
        const timestamp = req.session.uploadTimestamp;
        const ext = path.extname(file.originalname);
        if (file.fieldname === 'thumbnailImage') {
            cb(null, `user${userId}_${timestamp}${ext}`);
        } else if (file.fieldname.startsWith('questionImage')) {
            const match = file.fieldname.match(/questionImage(\d+)/);
            const idx = match ? match[1] : '0';
            cb(null, `qimg_${userId}_${timestamp}_${idx}${ext}`);
        } else {
            cb(new Error('Unknown fieldname: ' + file.fieldname));
        }
    }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

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

// 퀴즈 생성 처리 (썸네일 + 문제 이미지)
router.post('/create', upload.any(), async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { title, description, category, questionType, questions, thumbnailType } = req.body;

    // 썸네일 처리
    let thumbnailUrl = '';
    const thumbnailFile = req.files.find(f => f.fieldname === 'thumbnailImage');
    if (thumbnailType === 'default') {
        thumbnailUrl = '/rogo.png';
    } else if (thumbnailType === 'custom' && thumbnailFile) {
        // temp 폴더에서 실제 저장 폴더로 이동
        const oldPath = path.join(__dirname, '..', 'public', 'uploads', 'temp', thumbnailFile.filename);
        const newPath = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails', thumbnailFile.filename);
        
        // thumbnails 디렉토리가 없으면 생성
        const thumbnailsDir = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails');
        if (!fs.existsSync(thumbnailsDir)) {
            fs.mkdirSync(thumbnailsDir, { recursive: true });
        }
        
        fs.renameSync(oldPath, newPath);
        thumbnailUrl = '/uploads/thumbnails/' + thumbnailFile.filename;
    }

    // 문제 이미지 처리 (프론트에서 문제별 이미지 업로드 구현 필요)
    let questionsArr = Object.values(questions).filter(q => q);
    questionsArr = questionsArr.map((q, idx) => {
        const qimg = req.files.find(f => f.fieldname === `questionImage${idx}`);
        if (qimg) {
            // temp 폴더 경로로만 저장
            q.image = '/uploads/temp/' + qimg.filename;
        }
        q.question_type = q.question_type || (questionType === 'choice' ? 'multiple_choice' : 'short_answer');
        return q;
    });

    const questionsJson = JSON.stringify(questionsArr);

    // DB 저장
    db.query(
        'INSERT INTO pending_quiz (category, title, description, thumbnail_url, questions, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [category, title, description, thumbnailUrl, questionsJson, req.session.user.id],
        (err) => {
            if (err) {
                return res.render('quiz/create', { user: req.session.user, error: '퀴즈 신청 저장 중 오류가 발생했습니다.', success: null });
            }
            return res.render('quiz/create', { user: req.session.user, success: '퀴즈 신청성공 검토후 등록', error: null });
        }
    );
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

        const quiz = await Quiz.getById(quizId);
        if (!quiz) {
            throw new Error('퀴즈를 찾을 수 없습니다.');
        }
        let questions;
        try {
            if (typeof quiz.questions === 'string') {
                questions = JSON.parse(quiz.questions);
            } else {
                questions = quiz.questions;
            }
            if (!Array.isArray(questions)) questions = [];
        } catch (e) {
            console.error('questions 파싱 오류:', e);
            questions = [];
        }

        if (reset || !req.session.quizId || req.session.quizId !== quizId || !req.session.questionOrder || req.session.totalQuestions !== count) {
            req.session.quizId = quizId;
            req.session.currentQuestion = 1;
            req.session.totalQuestions = Math.min(count, questions.length);
            const questionIds = questions.map(q => q.id);
            for (let i = questionIds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [questionIds[i], questionIds[j]] = [questionIds[j], questionIds[i]];
            }
            req.session.questionOrder = questionIds.slice(0, req.session.totalQuestions);
            req.session.results = [];
            req.session.resultSaved = false; 
        }

        const currentQuestionNum = req.session.currentQuestion;
        if (currentQuestionNum > req.session.totalQuestions) {
            return res.redirect('/quiz/final-result');
        }

        const currentQuestionId = req.session.questionOrder[currentQuestionNum - 1];
        const currentQuestion = questions.find(q => q.id === currentQuestionId);
        
        if (!currentQuestion) {
            throw new Error('현재 질문 객체를 찾을 수 없습니다. questions 배열이나 ID를 확인하세요.');
        }

        // 이미지 경로 결정 로직
        let determinedImagePath = null;
        const defaultImage = "/rogo.png";
        const questionImageBase = "/uploads/questions/";
        const thumbnailImageBase = "/uploads/thumbnails/";

        if (currentQuestion.question_img_url) {
            if (currentQuestion.question_img_url.startsWith('/')) {
                determinedImagePath = currentQuestion.question_img_url;
            } else {
                determinedImagePath = path.posix.join(questionImageBase, currentQuestion.question_img_url);
            }
        } else if (quiz.thumbnail_url) {
            if (quiz.thumbnail_url.startsWith('/')) {
                determinedImagePath = quiz.thumbnail_url;
            } else {
                determinedImagePath = path.posix.join(thumbnailImageBase, quiz.thumbnail_url);
            }
        }

        const imagePath = determinedImagePath || defaultImage;

        const quizPlayData = {
            quizId: quizId,
            questionImage: imagePath,
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

        res.render('quiz/play', { ...quizPlayData, user: req.session.user });
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

        // 문제별 답안 DB 저장
        db.query(
            'INSERT INTO question_responses (user_id, quiz_id, question_id, user_answer, is_correct, answered_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [user ? user.id : null, quizId, currentQuestion.id, answer, isCorrect ? 1 : 0],
            (err) => {
                if (err) console.error('문제별 답안 저장 오류:', err);
            }
        );

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


// 최종 결과 페이지
router.get('/final-result', async (req, res) => {
    try {
        const user = req.session.user;
        const quizId = req.session.quizId;
        const results = req.session.results || [];
        const totalQuestions = req.session.totalQuestions || results.length;
        const correctCount = results.filter(r => r.isCorrect).length;
        const userScore = correctCount; // 현재 사용자의 점수

        // 정답률 계산
        const accuracy = totalQuestions > 0 ? parseFloat(((correctCount / totalQuestions) * 100).toFixed(1)) : 0;

        let rankingPercentage = 100; // 기본값 (예: 데이터 부족 시)
        let displayMessage = "결과를 계산 중입니다..."; // 기본 메시지

        if (quizId && totalQuestions > 0) {
            const countStrictlyHigherQuery = `
                SELECT COUNT(*) AS count
                FROM quiz_results
                WHERE quiz_id = ? AND total_questions = ? AND score > ?;
            `;
            const totalEligibleAttemptsQuery = `
                SELECT COUNT(*) AS count
                FROM quiz_results
                WHERE quiz_id = ? AND total_questions = ?;
            `;

            // Promise를 사용하여 두 쿼리를 병렬로 실행
            const [higherResults, totalResults] = await Promise.all([
                new Promise((resolve, reject) => {
                    db.query(countStrictlyHigherQuery, [quizId, totalQuestions, userScore], (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows[0].count);
                    });
                }),
                new Promise((resolve, reject) => {
                    db.query(totalEligibleAttemptsQuery, [quizId, totalQuestions], (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows[0].count);
                    });
                })
            ]);

            const countStrictlyHigher = higherResults;
            const totalEligibleAttempts = totalResults;

            if (totalEligibleAttempts > 0) {
                // (나보다 잘한 사람 수 + 1) / 전체 시도자 수 * 100
                // 이 값은 작을수록 높은 순위
                rankingPercentage = ((countStrictlyHigher + 1) / totalEligibleAttempts) * 100;
                if (rankingPercentage > 100) rankingPercentage = 100; // 100%를 넘지 않도록
                if (rankingPercentage < 1 && totalEligibleAttempts > 0) rankingPercentage = 1; // 0%가 되지 않도록 (최소 상위 1%)
                
                // 메시지 예시 (템플릿에서 더 가공 가능)
                if (totalEligibleAttempts === 1 && countStrictlyHigher === 0) {
                    displayMessage = "첫 번째 도전자입니다! 멋진 시작이에요!";
                    rankingPercentage = 1; // 첫 도전자는 상위 1%로 표시 (또는 100% 중 원하는 방향으로)
                } else if (countStrictlyHigher === 0) {
                    displayMessage = "최상위권입니다! 정말 대단해요!";
                    rankingPercentage = 1; // 최고점은 상위 1%로 표시
                } else {
                    displayMessage = `상위 ${Math.ceil(rankingPercentage)}%의 성적입니다!`; 
                }
            } else {
                displayMessage = "아직 이 조건으로 퀴즈를 푼 사용자가 충분하지 않아 순위를 계산할 수 없습니다.";
                rankingPercentage = null; // 순위 계산 불가
            }
        } else {
            displayMessage = "퀴즈 정보가 부족하여 순위를 계산할 수 없습니다.";
            rankingPercentage = null;
        }

        res.render('quiz/final-result', {
            user: user,
            results: {
                correctCount,
                totalQuizzes: totalQuestions, // 변수명 일관성 (totalQuestions)
                accuracy: accuracy, // 추가된 정답률
                percentage: rankingPercentage, // 새로 계산된 순위 백분율
                displayMessage: displayMessage   // 추가 메시지
            },
            quizId
        });
    } catch (error) {
        console.error('최종 결과 처리 에러:', error);
        // 오류 발생 시 기본값으로 렌더링, 사용자에게 오류 안내
        res.render('quiz/final-result', {
            user: req.session.user,
            results: {
                correctCount: (req.session.results || []).filter(r => r.isCorrect).length,
                totalQuizzes: req.session.totalQuestions || (req.session.results || []).length,
                accuracy: 0, // 오류 시 정답률 0
                percentage: null, // 오류 시 순위 없음
                displayMessage: "결과를 불러오는 중 오류가 발생했습니다."
            },
            quizId: req.session.quizId,
            error: "결과 처리 중 오류가 발생했습니다."
        });
    }
});

// 대시보드(전체 통계) 라우트
router.get('/dashboard/:quizId', async (req, res) => {
    const quizId = parseInt(req.params.quizId);
    
    try {
        const quiz = await Quiz.getById(quizId); // 퀴즈 정보 조회
        if (!quiz) {
            // 퀴즈를 찾을 수 없는 경우, 적절한 에러 처리 또는 리다이렉션
            return res.redirect('/'); 
        }

    const stats = await Quiz.getStatsByQuizId(quizId);

        // 정렬 파라미터 처리
        let order = req.query.order || 'rate_desc';
        let orderBy = 'correct_rate DESC, qr.question_id ASC';
        if (order === 'id_asc') orderBy = 'qr.question_id ASC';
        if (order === 'id_desc') orderBy = 'qr.question_id DESC';
        if (order === 'rate_asc') orderBy = 'correct_rate ASC, qr.question_id ASC';

        // 랭킹 데이터 조회 (상위 5명)
        const rankingQuery = `
            SELECT u.username, qr.score
            FROM quiz_results qr
            JOIN user u ON qr.user_id = u.id
            WHERE qr.quiz_id = ?
            ORDER BY qr.score DESC, qr.created_at ASC
            LIMIT 5;
        `;

        // 추천 퀴즈 조회 (동일 카테고리, 최신 3개, 현재 퀴즈 제외)
        const recommendedQuizzesQuery = `
            SELECT id, title, thumbnail_url
            FROM quiz
            WHERE category = ? AND id != ?
            ORDER BY created_at DESC
            LIMIT 3;
        `;

        const [questionStats, rankings, recommendedQuizzes] = await Promise.all([
            new Promise((resolve, reject) => {
                db.query(
                    `SELECT qr.question_id, q.question, 
                            COUNT(*) AS total, 
                            SUM(qr.is_correct) AS correct, 
                            ROUND(SUM(qr.is_correct)/COUNT(*)*100,1) AS correct_rate
                       FROM question_responses qr
                       JOIN question q ON qr.question_id = q.id
                      WHERE qr.quiz_id = ?
                   GROUP BY qr.question_id, q.question
                   ORDER BY ${orderBy}`,
                    [quizId],
                    (err, results) => {
                        if (err) return reject(err);
                        resolve(results || []);
                    }
                );
            }),
            new Promise((resolve, reject) => {
                db.query(rankingQuery, [quizId], (err, results) => {
                    if (err) return reject(err);
                    resolve(results || []);
                });
            }),
            new Promise((resolve, reject) => {
                db.query(recommendedQuizzesQuery, [quiz.category, quizId], (err, results) => {
                    if (err) return reject(err);
                    resolve(results || []);
                });
            })
        ]);

        stats.questionStats = questionStats;

        res.render('quiz/dashboard', { 
            quiz: quiz,
            stats, 
            rankings,
            recommendedQuizzes, // 추천 퀴즈 정보 전달
            quizId, 
            order,
            user: req.session.user || null // 사용자 세션 정보 안전하게 전달
        });

    } catch (error) {
        console.error("대시보드 데이터 조회 오류:", error);
        // 오류 발생 시 사용자에게 알림 또는 기본 페이지로 리다이렉션
        res.status(500).send("데이터를 불러오는 중 오류가 발생했습니다.");
    }
});

// 사용자별 퀴즈 대시보드 (나의 퀴즈 활동 페이지)
router.get('/dashboard_user', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const userId = req.session.user.id;

    try {
        // 1. 총 응시 퀴즈 수
        const totalQuizzesQuery = `
            SELECT COUNT(DISTINCT qr.quiz_id) AS totalQuizzes
            FROM quiz_results qr
            WHERE qr.user_id = ?;
        `;

        // 2. 평균 점수 및 전체 정답률
        const overallStatsQuery = `
            SELECT 
                COALESCE(AVG(qr.score / qr.total_questions * 100), 0) AS averageScore,
                COALESCE(SUM(qr.score) * 100.0 / SUM(qr.total_questions), 0) AS correctRate
            FROM quiz_results qr
            WHERE qr.user_id = ?;
        `;
        
        // 3. 최근 응시 기록 (최근 5개)
        const recentAttemptsQuery = `
            SELECT 
                q.title AS quizTitle,
                qr.created_at AS attemptDate,
                qr.score,
                qr.total_questions AS totalQuestions,
                (qr.score * 100.0 / qr.total_questions) AS correctPercentage,
                qr.quiz_id as quizId 
            FROM quiz_results qr
            JOIN quiz q ON qr.quiz_id = q.id
            WHERE qr.user_id = ?
            ORDER BY qr.created_at DESC
            LIMIT 5;
        `;

        // 4. 오답 복습 (최근 5개 틀린 문제)
        const wrongAnswersQuery = `
            SELECT 
                q.title AS quizTitle,
                qs.id AS questionId,
                qs.question AS questionText,
                q_res.user_answer AS myAnswer,
                qs.correct_answer AS subjectiveCorrectAnswer, 
                qs.question_type AS questionType,
                q_res.answered_at as answeredDate,
                q.id as quizId,
                (SELECT COUNT(*) + 1 FROM question q_inner WHERE q_inner.quiz_id = q.id AND q_inner.id < qs.id) AS questionNumber
            FROM question_responses q_res
            JOIN question qs ON q_res.question_id = qs.id
            JOIN quiz q ON q_res.quiz_id = q.id
            WHERE q_res.user_id = ? AND q_res.is_correct = 0
            ORDER BY q_res.answered_at DESC
            LIMIT 5;
        `;

        // 5. 카테고리별 응시 횟수 (차트용)
        const categoryChartQuery = `
            SELECT
                q.category,
                COUNT(qr.id) AS attemptCount
            FROM
                quiz_results qr
            INNER JOIN
                quiz q ON qr.quiz_id = q.id
            WHERE
                qr.user_id = ?
            GROUP BY
                q.category;
        `;

        // 6. 월별 응시 횟수 (차트용)
        const monthlyChartQuery = `
            SELECT
                DATE_FORMAT(qr.created_at, '%Y-%m') AS attemptMonth,
                COUNT(qr.id) AS attemptCount
            FROM
                quiz_results qr
            WHERE
                qr.user_id = ?
            GROUP BY
                attemptMonth
            ORDER BY
                attemptMonth ASC;
        `;

        const promises = [
            new Promise((resolve, reject) => {
                db.query(totalQuizzesQuery, [userId], (err, results) => {
                    if (err) return reject(err);
                    resolve(results[0] ? results[0].totalQuizzes : 0);
                });
            }),
            new Promise((resolve, reject) => {
                db.query(overallStatsQuery, [userId], (err, results) => {
                    if (err) return reject(err);
                    resolve(results[0] || { averageScore: 0, correctRate: 0 });
                });
            }),
            new Promise((resolve, reject) => {
                db.query(recentAttemptsQuery, [userId], (err, results) => {
                    if (err) return reject(err);
                    const formattedResults = results.map(attempt => ({
                        ...attempt,
                        attemptDate: new Date(attempt.attemptDate).toLocaleDateString('ko-KR'),
                        rate: parseFloat(attempt.correctPercentage).toFixed(1) + '%'
                    }));
                    resolve(formattedResults);
                });
            }),
            new Promise((resolve, reject) => { // Promise for wrongAnswers
                db.query(wrongAnswersQuery, [userId], (err, wrongAnswerItems) => {
                    if (err) return reject(err);
                    if (!wrongAnswerItems || wrongAnswerItems.length === 0) return resolve([]);

                    const multipleChoiceItems = wrongAnswerItems.filter(item => item.questionType === 'multiple_choice');
                    
                    const multipleChoiceQuestionIds = multipleChoiceItems.map(item => item.questionId);
                    const userAnswerOptionIds = multipleChoiceItems
                        .map(item => parseInt(item.myAnswer, 10))
                        .filter(id => !isNaN(id));

                    let correctOptionsMap = {};    
                    let userAnswerTextsMap = {};   

                    const detailFetchingPromises = [];

                    if (multipleChoiceQuestionIds.length > 0) {
                        detailFetchingPromises.push(new Promise((resInternal, rejInternal) => {
                            const correctOptionsQuery = `
                                SELECT question_id, option_text 
                                FROM question_option 
                                WHERE question_id IN (?) AND is_correct = 1;
                            `;
                            db.query(correctOptionsQuery, [multipleChoiceQuestionIds], (optErr, correctOptions) => {
                                if (optErr) {
                                    console.error("Error fetching correct options for wrong answers:", optErr);
                                } else if (correctOptions){
                                    correctOptions.forEach(opt => {
                                        correctOptionsMap[opt.question_id] = opt.option_text;
                                    });
                                }
                                resInternal();
                            });
                        }));
                    }

                    if (userAnswerOptionIds.length > 0) {
                        detailFetchingPromises.push(new Promise((resInternal, rejInternal) => {
                            const userAnswerTextsQuery = `
                                SELECT id, option_text 
                                FROM question_option 
                                WHERE id IN (?);
                            `;
                            db.query(userAnswerTextsQuery, [userAnswerOptionIds], (optErr, userAnswerOptions) => {
                                if (optErr) {
                                    console.error("Error fetching user answer option texts:", optErr);
                                } else if (userAnswerOptions){
                                    userAnswerOptions.forEach(opt => {
                                        userAnswerTextsMap[opt.id] = opt.option_text;
                                    });
                                }
                                resInternal();
                            });
                        }));
                    }

                    Promise.all(detailFetchingPromises).then(() => {
                        const formattedResults = wrongAnswerItems.map(item => {
                            let correctAnswerDisplay = item.subjectiveCorrectAnswer; 
                            let myAnswerDisplay = item.myAnswer;                     

                            if (item.questionType === 'multiple_choice') {
                                correctAnswerDisplay = correctOptionsMap[item.questionId] || "정답 정보 오류";
                                
                                const userAnswerId = parseInt(item.myAnswer, 10);
                                myAnswerDisplay = userAnswerTextsMap[userAnswerId] || item.myAnswer; 
                            }
                            return {
                                quizTitle: item.quizTitle,
                                questionNumber: item.questionNumber,
                                questionText: item.questionText,
                                myAnswer: myAnswerDisplay, 
                                correctAnswer: correctAnswerDisplay,
                                explanation: "해설이 제공되지 않는 문제입니다.", // 기본 해설
                                quizId: item.quizId,
                                questionId: item.questionId
                            };
                        });
                        resolve(formattedResults);
                    }).catch(detailErr => {
                        console.error("Error in Promise.all for detail fetching:", detailErr);
                        const fallbackResults = wrongAnswerItems.map(item => ({ // 폴백 데이터 매핑
                            quizTitle: item.quizTitle,
                            questionNumber: item.questionNumber,
                            questionText: item.questionText,
                            myAnswer: item.myAnswer, 
                            correctAnswer: item.subjectiveCorrectAnswer, 
                            explanation: "해설 정보를 불러오는데 실패했습니다.",
                            quizId: item.quizId,
                            questionId: item.questionId
                        }));
                        resolve(fallbackResults); 
                    });
                });
            }),
            // 차트 데이터용 Promise 추가
            new Promise((resolve, reject) => {
                db.query(categoryChartQuery, [userId], (err, results) => {
                    if (err) return reject(err);
                    resolve({
                        labels: results.map(row => row.category),
                        data: results.map(row => row.attemptCount)
                    });
                });
            }),
            new Promise((resolve, reject) => {
                db.query(monthlyChartQuery, [userId], (err, results) => {
                    if (err) return reject(err);
                    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
                    resolve({
                        labels: results.map(row => {
                            const monthIndex = parseInt(row.attemptMonth.substring(5, 7), 10) - 1;
                            return monthNames[monthIndex];
                        }),
                        data: results.map(row => row.attemptCount)
                    });
                });
            })
        ];
        
        const [
            totalQuizzes, 
            overallStats, 
            recentAttempts, 
            wrongAnswers, 
            categoryChartData, 
            monthlyChartData
        ] = await Promise.all(promises);

        res.render('quiz/dashboard_user', {
            user: req.session.user,
            totalQuizzes: totalQuizzes,
            averageScore: parseFloat(overallStats.averageScore).toFixed(1),
            correctRate: parseFloat(overallStats.correctRate).toFixed(1),
            recentAttempts: recentAttempts,
            wrongAnswers: wrongAnswers,
            categoryChartData: categoryChartData,
            monthlyChartData: monthlyChartData,
            error: null
        });

    } catch (error) {
        console.error("사용자 대시보드 데이터 조회 오류:", error);
        res.render('quiz/dashboard_user', {
            user: req.session.user,
            totalQuizzes: 0,
            averageScore: '0',
            correctRate: '0',
            recentAttempts: [],
            wrongAnswers: [],
            categoryChartData: { labels: [], data: [] },
            monthlyChartData: { labels: [], data: [] },
            error: "데이터를 불러오는 중 오류가 발생했습니다."
        });
    }
});

// 퀴즈 소유권 확인 미들웨어
function checkQuizOwnership(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const quizId = req.params.id;
    const userId = req.session.user.id;
    
    db.query('SELECT created_by FROM quiz WHERE id = ?', [quizId], (err, results) => {
        if (err || results.length === 0) {
            return res.redirect('/');
        }
        
        const quiz = results[0];
        if (quiz.created_by !== userId && req.session.user.role !== 'admin') {
            return res.status(403).send('수정 권한이 없습니다.');
        }
        
        next();
    });
}

// 퀴즈 수정 페이지
router.get('/edit/:id', checkQuizOwnership, (req, res) => {
    const quizId = req.params.id;
    
    // 퀴즈 기본 정보 조회
    db.query('SELECT * FROM quiz WHERE id = ?', [quizId], (err, quizResults) => {
        if (err || quizResults.length === 0) {
            return res.redirect('/');
        }
        
        const quiz = quizResults[0];
        
        // 문제들 조회
        db.query('SELECT * FROM question WHERE quiz_id = ? ORDER BY id', [quizId], (err, questions) => {
            if (err) {
                return res.render('quiz/edit', { 
                    quiz, 
                    questions: [], 
                    user: req.session.user, 
                    error: '문제를 불러오는데 실패했습니다.' 
                });
            }
            
            // 각 문제의 선택지들 조회
            const questionIds = questions.map(q => q.id);
            if (questionIds.length > 0) {
                db.query(
                    'SELECT * FROM question_option WHERE question_id IN (?) ORDER BY question_id, option_order', 
                    [questionIds], 
                    (err, options) => {
                        if (err) {
                            return res.render('quiz/edit', { 
                                quiz, 
                                questions, 
                                user: req.session.user, 
                                error: '선택지를 불러오는데 실패했습니다.' 
                            });
                        }
                        
                        // 문제별로 선택지 그룹화
                        const optionsByQuestion = {};
                        options.forEach(option => {
                            if (!optionsByQuestion[option.question_id]) {
                                optionsByQuestion[option.question_id] = [];
                            }
                            optionsByQuestion[option.question_id].push(option);
                        });
                        
                        // 문제에 선택지 정보 추가
                        questions.forEach(question => {
                            question.options = optionsByQuestion[question.id] || [];
                        });
                        
                        res.render('quiz/edit', { 
                            quiz, 
                            questions, 
                            user: req.session.user, 
                            error: null 
                        });
                    }
                );
            } else {
                res.render('quiz/edit', { 
                    quiz, 
                    questions, 
                    user: req.session.user, 
                    error: null 
                });
            }
        });
    });
});

// 퀴즈 수정 처리
router.post('/edit/:id', checkQuizOwnership, upload.any(), (req, res) => {
    const quizId = req.params.id;
    const { title, description, category, questions, thumbnailType } = req.body;
    
    // 썸네일 처리
    let thumbnailUrl = '';
    const thumbnailFile = req.files.find(f => f.fieldname === 'thumbnailImage');
    
    if (thumbnailType === 'default') {
        thumbnailUrl = '/rogo.png';
    } else if (thumbnailType === 'custom' && thumbnailFile) {
        // temp 폴더에서 실제 저장 폴더로 이동
        const oldPath = path.join(__dirname, '..', 'public', 'uploads', 'temp', thumbnailFile.filename);
        const newPath = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails', thumbnailFile.filename);
        
        // thumbnails 디렉토리가 없으면 생성
        const thumbnailsDir = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails');
        if (!fs.existsSync(thumbnailsDir)) {
            fs.mkdirSync(thumbnailsDir, { recursive: true });
        }
        
        fs.renameSync(oldPath, newPath);
        thumbnailUrl = '/uploads/thumbnails/' + thumbnailFile.filename;
    } else if (thumbnailType === 'keep') {
        // 기존 썸네일 유지
        db.query('SELECT thumbnail_url FROM quiz WHERE id = ?', [quizId], (err, results) => {
            if (!err && results.length > 0) {
                thumbnailUrl = results[0].thumbnail_url;
            }
        });
    }
    
    // 문제 데이터 처리
    let questionsArr = [];
    if (questions) {
        questionsArr = Object.values(questions).filter(q => q && q.text);
        questionsArr = questionsArr.map((q, idx) => {
            const qimg = req.files.find(f => f.fieldname === `questions[${idx + 1}][image]`);
            if (qimg) {
                // temp 폴더에서 실제 저장 폴더로 이동
                const oldPath = path.join(__dirname, '..', 'public', 'uploads', 'temp', qimg.filename);
                const newPath = path.join(__dirname, '..', 'public', 'uploads', 'questions', qimg.filename);
                
                // questions 디렉토리가 없으면 생성
                const questionsDir = path.join(__dirname, '..', 'public', 'uploads', 'questions');
                if (!fs.existsSync(questionsDir)) {
                    fs.mkdirSync(questionsDir, { recursive: true });
                }
                
                fs.renameSync(oldPath, newPath);
                q.image = '/uploads/questions/' + qimg.filename;
            }
            return q;
        });
    }
    
    // 트랜잭션 시작
    db.beginTransaction((err) => {
        if (err) {
            console.error('트랜잭션 시작 오류:', err);
            return res.render('quiz/edit', { 
                error: '수정 중 오류가 발생했습니다.', 
                user: req.session.user,
                quiz: { id: quizId },
                questions: []
            });
        }
        
        // 1. 퀴즈 기본 정보 업데이트
        const updateQuizQuery = thumbnailType === 'keep' 
            ? 'UPDATE quiz SET title = ?, description = ?, category = ? WHERE id = ?'
            : 'UPDATE quiz SET title = ?, description = ?, category = ?, thumbnail_url = ? WHERE id = ?';
        
        const updateQuizParams = thumbnailType === 'keep' 
            ? [title, description, category, quizId]
            : [title, description, category, thumbnailUrl, quizId];
        
        db.query(updateQuizQuery, updateQuizParams, (err) => {
            if (err) {
                console.error('퀴즈 정보 업데이트 오류:', err);
                return db.rollback(() => {
                    res.render('quiz/edit', { 
                        error: '퀴즈 정보 수정에 실패했습니다.', 
                        user: req.session.user,
                        quiz: { id: quizId },
                        questions: []
                    });
                });
            }
            
            // 2. 기존 문제들과 선택지들 삭제
            db.query('DELETE FROM question_responses WHERE question_id IN (SELECT id FROM question WHERE quiz_id = ?)', [quizId], (err) => {
                if (err) {
                    console.error('기존 응답 기록 삭제 오류:', err);
                    return db.rollback(() => {
                        res.render('quiz/edit', { 
                            error: '기존 응답 기록 삭제에 실패했습니다.', 
                            user: req.session.user,
                            quiz: { id: quizId },
                            questions: []
                        });
                    });
                }
                
                db.query('DELETE FROM question_option WHERE question_id IN (SELECT id FROM question WHERE quiz_id = ?)', [quizId], (err) => {
                    if (err) {
                        console.error('기존 선택지 삭제 오류:', err);
                        return db.rollback(() => {
                            res.render('quiz/edit', { 
                                error: '기존 선택지 삭제에 실패했습니다.', 
                                user: req.session.user,
                                quiz: { id: quizId },
                                questions: []
                            });
                        });
                    }
                    
                    db.query('DELETE FROM question WHERE quiz_id = ?', [quizId], (err) => {
                        if (err) {
                            console.error('기존 문제 삭제 오류:', err);
                            return db.rollback(() => {
                                res.render('quiz/edit', { 
                                    error: '기존 문제 삭제에 실패했습니다.', 
                                    user: req.session.user,
                                    quiz: { id: quizId },
                                    questions: []
                                });
                            });
                        }
                        
                        // 3. 새로운 문제들 추가
                        insertNewQuestions(quizId, questionsArr, req.files, req.session.user.id, db, (success) => {
                            if (success) {
                                db.commit((err) => {
                                    if (err) {
                                        console.error('커밋 오류:', err);
                                        return db.rollback(() => {
                                            res.render('quiz/edit', { 
                                                error: '수정 완료 처리에 실패했습니다.', 
                                                user: req.session.user,
                                                quiz: { id: quizId },
                                                questions: []
                                            });
                                        });
                                    }
                                    res.redirect(`/quiz/list/${quizId}?updated=1`);
                                });
                            } else {
                                db.rollback(() => {
                                    res.render('quiz/edit', { 
                                        error: '새로운 문제 추가에 실패했습니다.', 
                                        user: req.session.user,
                                        quiz: { id: quizId },
                                        questions: []
                                    });
                                });
                            }
                        });
                    });
                });
            });
        });
    });
});

// 새로운 문제들을 삽입하는 헬퍼 함수
function insertNewQuestions(quizId, questionsArr, files, userId, db, callback) {
    if (!questionsArr || questionsArr.length === 0) {
        return callback(false);
    }
    
    let completedQuestions = 0;
    let hasError = false;
    
    const processQuestion = (question, index) => {
        return new Promise((resolve, reject) => {
            const questionType = question.answer ? 'short_answer' : 'multiple_choice';
            const correctAnswer = question.answer || '';
            const questionImage = question.image || null;
            
            // 문제 삽입
            db.query(
                'INSERT INTO question (quiz_id, question, question_type, correct_answer, created_by, question_img_url) VALUES (?, ?, ?, ?, ?, ?)',
                [quizId, question.text, questionType, correctAnswer, userId, questionImage],
                (err, result) => {
                    if (err) {
                        console.error('문제 삽입 오류:', err);
                        reject(err);
                        return;
                    }
                    
                    const questionId = result.insertId;
                    
                    // 객관식인 경우 선택지 삽입
                    if (questionType === 'multiple_choice') {
                        const options = [
                            { text: question.option1, order: 1, isCorrect: question.correct === '1' },
                            { text: question.option2, order: 2, isCorrect: question.correct === '2' },
                            { text: question.option3, order: 3, isCorrect: question.correct === '3' },
                            { text: question.option4, order: 4, isCorrect: question.correct === '4' }
                        ];
                        
                        const optionPromises = options.map(option => {
                            return new Promise((resolveOption, rejectOption) => {
                                db.query(
                                    'INSERT INTO question_option (question_id, option_text, is_correct, option_order) VALUES (?, ?, ?, ?)',
                                    [questionId, option.text, option.isCorrect ? 1 : 0, option.order],
                                    (err) => {
                                        if (err) {
                                            console.error('선택지 삽입 오류:', err);
                                            rejectOption(err);
                                            return;
                                        }
                                        resolveOption();
                                    }
                                );
                            });
                        });
                        
                        Promise.all(optionPromises)
                            .then(() => resolve())
                            .catch(err => reject(err));
                    } else {
                        // 주관식인 경우
                        resolve();
                    }
                }
            );
        });
    };
    
    // 모든 문제를 순차적으로 처리
    const processAllQuestions = async () => {
        try {
            for (let i = 0; i < questionsArr.length; i++) {
                await processQuestion(questionsArr[i], i);
            }
            callback(true);
        } catch (err) {
            console.error('문제 처리 중 오류 발생:', err);
            callback(false);
        }
    };
    
    processAllQuestions();
}

// 내가 만든 퀴즈 목록 페이지
router.get('/my-quizzes', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const userId = req.session.user.id;
    
    db.query(
        'SELECT id, title, category, description, thumbnail_url, created_at, views FROM quiz WHERE created_by = ? ORDER BY created_at DESC',
        [userId],
        (err, results) => {
            if (err) {
                console.error('내 퀴즈 목록 조회 오류:', err);
                return res.render('quiz/my-quizzes', { 
                    quizzes: [], 
                    user: req.session.user, 
                    error: '퀴즈 목록을 불러오는데 실패했습니다.' 
                });
            }
            
            res.render('quiz/my-quizzes', { 
                quizzes: results, 
                user: req.session.user, 
                error: null 
            });
        }
    );
});

module.exports = router;

