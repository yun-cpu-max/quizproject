const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const quizRouter = require('./routes/quiz');  // 퀴즈 라우터 추가
const db = require('./db');
const adminRouter = require('./routes/admin');
const { Quiz } = require('./models/Quiz'); // Quiz 모델 import
const multer = require('multer');
const path = require('path');

// Multer 설정
const thumbnailStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/thumbnails/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: thumbnailStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB 제한
    },
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
});

const app = express();
const PORT = 3000;

// MySQL 연결
db.connect((err) => {
    if (err) {
        console.error('MySQL 연결 실패:', err);
        return;
    }
    console.log('MySQL 연결 성공');
});

// EJS 설정
app.set("view engine", "ejs");
app.use(express.static("public")); // CSS, 이미지 파일 사용 가능
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // JSON 파싱 미들웨어 추가

// 세션 설정
app.use(session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// 샘플 데이터 (Machugi.io처럼 이미지 목록을 표시)
const images = [
  { title: "이미지 제목1", description: "이미지 설명1", src: "rogo.png" },
  { title: "이미지 제목2", description: "이미지 설명2", src: "rogo.png" },
  { title: "이미지 제목3", description: "이미지 설명3", src: "rogo.png" },
];

// 메인 페이지 라우트
app.get("/", (req, res) => {
    const sort = req.query.sort;
    const category = req.query.category;
    const search = req.query.search;
    
    // 기본 쿼리
    let query = 'SELECT * FROM quiz WHERE 1=1';
    const params = [];

    // 검색어 필터 적용
    if (search) {
        query += ' AND (title LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    // 카테고리 필터 적용
    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }

    // 정렬 적용
    if (sort === 'popular') {
        query += ' ORDER BY views DESC';
    } else if (sort === 'latest') {
        query += ' ORDER BY created_at DESC';
    }

    // 퀴즈 데이터 가져오기
    db.query(query, params, (err, quizResults) => {
        if (err) {
            console.error('퀴즈 조회 실패:', err);
            return res.status(500).send('서버 오류');
        }

        res.render("index", { 
            images: quizResults, 
            user: req.session.user,
            sort: sort,
            category: category,
            search: search
        });
    });
});

// 검색 기능 (사용자가 검색어 입력하면 필터링)
app.post("/search", async (req, res) => {
  const searchTerm = req.body.search.toLowerCase();
  const quizzes = await Quiz.getAll();
  const filteredImages = quizzes.filter(img =>
    img.title.toLowerCase().includes(searchTerm) || 
    (img.description || '').toLowerCase().includes(searchTerm)
  );
  res.render("index", { images: filteredImages, user: req.session.user });
});

// 로그인 페이지 렌더링
app.get('/login', (req, res) => {
    res.render('login', { user: req.session.user });
});

// 로그인 처리
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // MySQL에서 사용자 조회
    const query = 'SELECT * FROM user WHERE username = ? AND password = ? AND is_active = TRUE';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('로그인 쿼리 실패:', err);
            return res.render('login', { error: '로그인 처리 중 오류가 발생했습니다.' });
        }

        if (results.length > 0) {
            req.session.user = {
                id: results[0].id,
                username: results[0].username,
                email: results[0].email,
                role: results[0].role,
                is_active: results[0].is_active,
                created_at: results[0].created_at
            };
            res.redirect('/');
        } else {
            res.render('login', { error: '아이디 또는 비밀번호가 잘못되었습니다.' });
        }
    });
});

// 로그아웃 처리
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// 랭킹 페이지 라우트
app.get('/ranking', async (req, res) => {
    const period = req.query.period || 'all'; // 기본값은 'all'

    try {
        // 1. 맞힌 문제 수 랭킹 (correctAnswersRanking)
        // SUM(qr.score) as correctAnswers: 각 사용자가 맞힌 총 문제 수
        // AVG(qr.score / qr.total_questions * 100) as accuracy: 사용자별 평균 정답률
        const correctAnswersQuery = `
            SELECT 
                u.username,
                SUM(qr.score) AS correctAnswers,
                AVG(qr.score / qr.total_questions * 100) AS accuracy
            FROM quiz_results qr
            JOIN user u ON qr.user_id = u.id
            ${getPeriodCondition('qr.created_at', period)}
            GROUP BY u.id, u.username
            ORDER BY correctAnswers DESC, accuracy DESC
            LIMIT 10; 
        `;

        // 2. 완료한 퀴즈 수 랭킹 (completedQuizRanking)
        // COUNT(DISTINCT qr.quiz_id) as completedQuizzes: 사용자별 완료한 총 퀴즈 수
        // AVG(qr.score) as averageScore: 사용자별 평균 퀴즈 점수
        const completedQuizQuery = `
            SELECT 
                u.username,
                COUNT(DISTINCT qr.quiz_id) AS completedQuizzes,
                AVG(qr.score) AS averageScore 
            FROM quiz_results qr
            JOIN user u ON qr.user_id = u.id
            ${getPeriodCondition('qr.created_at', period)}
            GROUP BY u.id, u.username
            ORDER BY completedQuizzes DESC, averageScore DESC
            LIMIT 10;
        `;

        // 3. 인기 퀴즈 랭킹 (popularQuizRanking)
        // COUNT(DISTINCT qr.user_id) as participantCount: 퀴즈별 참여자 수 (중복 제거)
        // AVG(qr.score) as averageScore: 퀴즈별 평균 점수
        const popularQuizQuery = `
            SELECT 
                q.title,
                q.category,
                COUNT(DISTINCT qr.user_id) AS participantCount,
                AVG(qr.score) AS averageScore
            FROM quiz q
            LEFT JOIN quiz_results qr ON q.id = qr.quiz_id
            ${getPeriodCondition('q.created_at', period, true)}
            GROUP BY q.id, q.title, q.category
            ORDER BY participantCount DESC, averageScore DESC
            LIMIT 10;
        `;
        
        // 기간 필터링 SQL 생성 함수
        function getPeriodCondition(dateField, periodValue, isQuizTable = false) {
            const baseTableAlias = isQuizTable ? '' : 'WHERE'; // quiz 테이블은 WHERE가 이미 있을 수 있음
            if (periodValue === 'monthly') {
                return `${baseTableAlias} ${dateField} >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`;
            } else if (periodValue === 'weekly') {
                return `${baseTableAlias} ${dateField} >= DATE_SUB(NOW(), INTERVAL 1 WEEK)`;
            }
            return ''; // 'all' 또는 기타: 조건 없음
        }

        const [correctAnswersRanking, completedQuizRanking, popularQuizRanking] = await Promise.all([
            new Promise((resolve, reject) => {
                db.query(correctAnswersQuery, (err, results) => {
                    if (err) return reject(err);
                    resolve(results.map(r => ({...r, accuracy: parseFloat(r.accuracy) || 0 })));
                });
            }),
            new Promise((resolve, reject) => {
                db.query(completedQuizQuery, (err, results) => {
                    if (err) return reject(err);
                    resolve(results.map(r => ({...r, averageScore: parseFloat(r.averageScore) || 0 })));
                });
            }),
            new Promise((resolve, reject) => {
                db.query(popularQuizQuery, (err, results) => {
                    if (err) return reject(err);
                    resolve(results.map(r => ({...r, averageScore: parseFloat(r.averageScore) || 0 })));
                });
            })
        ]);

        res.render('ranking', { 
            user: req.session.user,
            correctAnswersRanking,
            completedQuizRanking,
            popularQuizRanking,
            period: period // 현재 선택된 기간을 템플릿에 전달
        });

    } catch (error) {
        console.error("랭킹 데이터 조회 오류:", error);
        res.render('ranking', {
            user: req.session.user,
            correctAnswersRanking: [],
            completedQuizRanking: [],
            popularQuizRanking: [],
            period: period,
            error: "랭킹 정보를 불러오는 중 오류가 발생했습니다."
        });
    }
});

// AJAX 요청을 위한 랭킹 API 엔드포인트
app.get('/api/ranking', async (req, res) => {
    const period = req.query.period || 'all';
    const type = req.query.type; // 'correctAnswers', 'completedQuiz', 'popularQuiz'

    if (!type) {
        return res.status(400).json({ error: '랭킹 타입을 지정해야 합니다.' });
    }

    // 기간 필터링 SQL 생성 함수 (server.js 내에 이미 존재해야 함)
    // 만약 별도 파일이나 스코프에 있다면, 접근 가능하도록 수정 필요
    function getPeriodCondition(dateField, periodValue, isQuizTable = false) {
        const baseTableAlias = isQuizTable ? '' : 'WHERE'; 
        if (periodValue === 'monthly') {
            return `${baseTableAlias} ${dateField} >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`;
        } else if (periodValue === 'weekly') {
            return `${baseTableAlias} ${dateField} >= DATE_SUB(NOW(), INTERVAL 1 WEEK)`;
        }
        return ''; 
    }

    let query = '';
    let queryParams = []; // 쿼리 파라미터 (필요시 사용)

    try {
        if (type === 'correctAnswers') {
            query = `
                SELECT 
                    u.username,
                    SUM(qr.score) AS correctAnswers,
                    AVG(qr.score / qr.total_questions * 100) AS accuracy
                FROM quiz_results qr
                JOIN user u ON qr.user_id = u.id
                ${getPeriodCondition('qr.created_at', period)}
                GROUP BY u.id, u.username
                ORDER BY correctAnswers DESC, accuracy DESC
                LIMIT 10;
            `;
        } else if (type === 'completedQuiz') {
            query = `
                SELECT 
                    u.username,
                    COUNT(DISTINCT qr.quiz_id) AS completedQuizzes,
                    AVG(qr.score) AS averageScore 
                FROM quiz_results qr
                JOIN user u ON qr.user_id = u.id
                ${getPeriodCondition('qr.created_at', period)}
                GROUP BY u.id, u.username
                ORDER BY completedQuizzes DESC, averageScore DESC
                LIMIT 10;
            `;
        } else if (type === 'popularQuiz') {
            query = `
                SELECT 
                    q.title,
                    q.category,
                    COUNT(DISTINCT qr.user_id) AS participantCount,
                    AVG(qr.score) AS averageScore
                FROM quiz q
                LEFT JOIN quiz_results qr ON q.id = qr.quiz_id
                ${getPeriodCondition('q.created_at', period, true)}
                GROUP BY q.id, q.title, q.category
                ORDER BY participantCount DESC, averageScore DESC
                LIMIT 10;
            `;
        } else {
            return res.status(400).json({ error: '잘못된 랭킹 타입입니다.' });
        }

        db.query(query, queryParams, (err, results) => {
            if (err) {
                console.error('API 랭킹 조회 실패:', err);
                return res.status(500).json({ error: '서버 오류로 랭킹 정보를 가져올 수 없습니다.' });
            }
            // 숫자 필드를 적절히 포맷팅 (기존 /ranking 라우트와 유사하게)
            const formattedResults = results.map(r => {
                if (r.accuracy !== undefined) r.accuracy = parseFloat(r.accuracy) || 0;
                if (r.averageScore !== undefined) r.averageScore = parseFloat(r.averageScore) || 0;
                return r;
            });
            res.json(formattedResults);
        });

    } catch (error) {
        console.error("API 랭킹 데이터 조회 오류:", error);
        res.status(500).json({ error: "랭킹 정보를 불러오는 중 오류가 발생했습니다." });
    }
});

// 알림 관련 API
// 사용자의 알림 목록 조회
app.get('/api/notifications', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const userId = req.session.user.id;
    const query = `
        SELECT 
            n.id,
            n.title,
            n.message,
            n.priority,
            n.created_at,
            un.is_read,
            un.read_at
        FROM notifications n
        JOIN user_notifications un ON n.id = un.notification_id
        WHERE un.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 50
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('알림 조회 실패:', err);
            return res.status(500).json({ error: '알림을 불러오는 중 오류가 발생했습니다.' });
        }

        // 시간 포맷팅
        const notifications = results.map(notification => {
            const now = new Date();
            const createdAt = new Date(notification.created_at);
            const diffInMinutes = Math.floor((now - createdAt) / (1000 * 60));
            
            let timeAgo;
            if (diffInMinutes < 1) {
                timeAgo = '방금 전';
            } else if (diffInMinutes < 60) {
                timeAgo = `${diffInMinutes}분 전`;
            } else if (diffInMinutes < 1440) {
                timeAgo = `${Math.floor(diffInMinutes / 60)}시간 전`;
            } else {
                timeAgo = `${Math.floor(diffInMinutes / 1440)}일 전`;
            }

            return {
                id: notification.id,
                title: notification.title,
                message: notification.message,
                priority: notification.priority,
                time: timeAgo,
                read: notification.is_read === 1
            };
        });

        res.json(notifications);
    });
});

// 알림 읽음 처리
app.post('/api/notifications/:id/read', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const userId = req.session.user.id;
    const notificationId = req.params.id;

    const query = `
        UPDATE user_notifications 
        SET is_read = 1, read_at = NOW() 
        WHERE user_id = ? AND notification_id = ?
    `;

    db.query(query, [userId, notificationId], (err, results) => {
        if (err) {
            console.error('알림 읽음 처리 실패:', err);
            return res.status(500).json({ error: '알림 처리 중 오류가 발생했습니다.' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
        }

        res.json({ success: true });
    });
});

// 모든 알림 읽음 처리 (중요 알림 제외)
app.post('/api/notifications/read-all', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const userId = req.session.user.id;
    const query = `
        UPDATE user_notifications un
        JOIN notifications n ON un.notification_id = n.id
        SET un.is_read = 1, un.read_at = NOW() 
        WHERE un.user_id = ? AND un.is_read = 0 AND n.priority = 0
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('전체 알림 읽음 처리 실패:', err);
            return res.status(500).json({ error: '알림 처리 중 오류가 발생했습니다.' });
        }

        res.json({ success: true, updatedCount: results.affectedRows });
    });
});

// 읽은 알림 일괄 삭제 (특정 라우트를 먼저 정의)
app.delete('/api/notifications/read', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const userId = req.session.user.id;
    console.log(`[읽은 알림 삭제] 사용자 ID: ${userId}`);
    
    const query = `
        DELETE FROM user_notifications 
        WHERE user_id = ? AND is_read = 1
    `;
    
    console.log('[읽은 알림 삭제] 실행할 쿼리:', query);

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('[읽은 알림 삭제] 데이터베이스 오류:', err);
            return res.status(500).json({ error: '알림 삭제 중 오류가 발생했습니다.' });
        }

        console.log(`[읽은 알림 삭제] 영향받은 행 수: ${results.affectedRows}`);
        res.json({ success: true, deletedCount: results.affectedRows });
    });
});

// 선택된 알림들 삭제
app.delete('/api/notifications', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const userId = req.session.user.id;
    const { notificationIds } = req.body;
    
    console.log(`[선택 삭제] 사용자 ID: ${userId}, 알림 IDs:`, notificationIds);

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
        console.log('[선택 삭제] 잘못된 요청 데이터');
        return res.status(400).json({ error: '삭제할 알림을 선택해주세요.' });
    }

    const placeholders = notificationIds.map(() => '?').join(',');
    const query = `
        DELETE FROM user_notifications 
        WHERE user_id = ? AND notification_id IN (${placeholders})
    `;
    
    console.log('[선택 삭제] 실행할 쿼리:', query);
    console.log('[선택 삭제] 쿼리 파라미터:', [userId, ...notificationIds]);

    db.query(query, [userId, ...notificationIds], (err, results) => {
        if (err) {
            console.error('[선택 삭제] 데이터베이스 오류:', err);
            return res.status(500).json({ error: '알림 삭제 중 오류가 발생했습니다.' });
        }

        console.log(`[선택 삭제] 영향받은 행 수: ${results.affectedRows}`);
        res.json({ success: true, deletedCount: results.affectedRows });
    });
});

// 특정 알림 삭제 (마지막에 정의하여 다른 라우트와 충돌 방지)
app.delete('/api/notifications/:id', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const userId = req.session.user.id;
    const notificationId = req.params.id;
    
    console.log(`[개별 삭제] 사용자 ID: ${userId}, 알림 ID: ${notificationId}`);

    const query = `
        DELETE FROM user_notifications 
        WHERE user_id = ? AND notification_id = ?
    `;

    db.query(query, [userId, notificationId], (err, results) => {
        if (err) {
            console.error('[개별 삭제] 데이터베이스 오류:', err);
            return res.status(500).json({ error: '알림 삭제 중 오류가 발생했습니다.' });
        }

        console.log(`[개별 삭제] 영향받은 행 수: ${results.affectedRows}`);
        
        if (results.affectedRows === 0) {
            console.log('[개별 삭제] 삭제할 알림을 찾을 수 없음');
            return res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
        }

        console.log('[개별 삭제] 성공적으로 삭제됨');
        res.json({ success: true, deletedCount: results.affectedRows });
    });
});

// 회원가입 페이지 렌더링
app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

// 공지사항 페이지 렌더링
app.get('/notice', (req, res) => {
    db.query('SELECT * FROM notice ORDER BY created_at DESC', (err, notices) => {
        if (err) {
            console.error('공지사항 조회 실패:', err);
            notices = [];
        }
        res.render('notice', { user: req.session.user, notices: notices });
    });
});

// 프로필 페이지 렌더링
app.get('/myprofile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('myprofile', { user: req.session.user });
});

// 회원가입 처리
app.post('/signup', (req, res) => {
    const { username, email, password } = req.body;
    
    // 중복 사용자 확인
    const checkQuery = 'SELECT * FROM user WHERE username = ? OR email = ?';
    db.query(checkQuery, [username, email], (err, results) => {
        if (err) {
            console.error('중복 확인 쿼리 실패:', err);
            return res.render('signup', { error: '회원가입 처리 중 오류가 발생했습니다.' });
        }

        if (results.length > 0) {
            return res.render('signup', { error: '이미 존재하는 아이디 또는 이메일입니다.' });
        }

        // 새 사용자 추가
        const insertQuery = 'INSERT INTO user (username, email, password, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())';
        db.query(insertQuery, [username, email, password, 'user'], (err, results) => {
            if (err) {
                console.error('회원가입 쿼리 실패:', err);
                return res.render('signup', { error: '회원가입 처리 중 오류가 발생했습니다.' });
            }

            res.redirect('/login');
        });
    });
});

// 정보 수정 페이지 렌더링
app.get('/edit-profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('edit-profile', { 
        user: req.session.user,
        error: null,
        success: null
    });
});

// 정보 수정 처리
app.post('/edit-profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const { username, email, currentPassword } = req.body;
    const userId = req.session.user.id;

    // 현재 비밀번호 확인
    const checkPasswordQuery = 'SELECT * FROM user WHERE id = ? AND password = ?';
    db.query(checkPasswordQuery, [userId, currentPassword], (err, results) => {
        if (err) {
            console.error('비밀번호 확인 실패:', err);
            return res.render('edit-profile', {
                user: req.session.user,
                error: '서버 오류가 발생했습니다.',
                success: null
            });
        }

        if (results.length === 0) {
            return res.render('edit-profile', {
                user: req.session.user,
                error: '현재 비밀번호가 일치하지 않습니다.',
                success: null
            });
        }

        // 중복 확인 (자신의 아이디는 제외)
        const checkQuery = 'SELECT * FROM user WHERE (username = ? OR email = ?) AND id != ?';
        db.query(checkQuery, [username, email, userId], (err, results) => {
            if (err) {
                console.error('중복 확인 실패:', err);
                return res.render('edit-profile', {
                    user: req.session.user,
                    error: '서버 오류가 발생했습니다.',
                    success: null
                });
            }

            if (results.length > 0) {
                return res.render('edit-profile', {
                    user: req.session.user,
                    error: '이미 사용 중인 아이디 또는 이메일입니다.',
                    success: null
                });
            }

            // 정보 업데이트
            const updateQuery = 'UPDATE user SET username = ?, email = ?, updated_at = NOW() WHERE id = ?';
            db.query(updateQuery, [username, email, userId], (err, result) => {
                if (err) {
                    console.error('정보 수정 실패:', err);
                    return res.render('edit-profile', {
                        user: req.session.user,
                        error: '정보 수정 중 오류가 발생했습니다.',
                        success: null
                    });
                }

                // 세션 업데이트
                req.session.user.username = username;
                req.session.user.email = email;
                
                res.render('edit-profile', {
                    user: req.session.user,
                    error: null,
                    success: '정보가 성공적으로 수정되었습니다.'
                });
            });
        });
    });
});

// 비밀번호 변경 페이지 렌더링
app.get('/change-password', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('change-password', { 
        user: req.session.user,
        error: null,
        success: null
    });
});

// 비밀번호 변경 처리
app.post('/change-password', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user.id;

    // 새 비밀번호 확인
    if (newPassword !== confirmPassword) {
        return res.render('change-password', {
            user: req.session.user,
            error: '새 비밀번호가 일치하지 않습니다.',
            success: null
        });
    }

    // 현재 비밀번호 확인
    const checkQuery = 'SELECT * FROM user WHERE id = ? AND password = ?';
    db.query(checkQuery, [userId, currentPassword], (err, results) => {
        if (err) {
            console.error('비밀번호 확인 실패:', err);
            return res.render('change-password', {
                user: req.session.user,
                error: '서버 오류가 발생했습니다.',
                success: null
            });
        }

        if (results.length === 0) {
            return res.render('change-password', {
                user: req.session.user,
                error: '현재 비밀번호가 일치하지 않습니다.',
                success: null
            });
        }

        // 비밀번호 업데이트
        const updateQuery = 'UPDATE user SET password = ?, updated_at = NOW() WHERE id = ?';
        db.query(updateQuery, [newPassword, userId], (err, result) => {
            if (err) {
                console.error('비밀번호 변경 실패:', err);
                return res.render('change-password', {
                    user: req.session.user,
                    error: '비밀번호 변경 중 오류가 발생했습니다.',
                    success: null
                });
            }

            res.render('change-password', {
                user: req.session.user,
                error: null,
                success: '비밀번호가 성공적으로 변경되었습니다.'
            });
        });
    });
});

// 퀴즈 라우터 추가
app.use('/quiz', quizRouter);
app.use('/admin', adminRouter);

// 퀴즈 생성 처리
app.post('/quiz/create', upload.single('thumbnailImage'), (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const { title, description, questionType, created_by } = req.body;
    const thumbnail_url = req.file ? '/uploads/thumbnails/' + req.file.filename : '/uploads/thumbnails/rogo.png';
    // pending_quiz 테이블에 퀴즈 정보 저장
    const insertQuizQuery = `
        INSERT INTO pending_quiz (title, description, thumbnail_url, created_by) 
        VALUES (?, ?, ?, ?)
    `;
    db.query(insertQuizQuery, [title, description, thumbnail_url, req.session.user.id], (err, result) => {
        if (err) {
            console.error('퀴즈 생성 실패:', err);
            return res.render('quiz/create', { 
                error: '퀴즈 생성에 실패했습니다.', 
                success: null,
                user: req.session.user 
            });
        }
        res.redirect('/');
    });
});

// 서버 실행
app.listen(PORT, () => console.log(`서버 실행 중입니다: http://localhost:${PORT}`));

module.exports.db = db;
