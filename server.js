const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const quizRouter = require('./routes/quiz');  // 퀴즈 라우터 추가
const quizData = require('./data/quizData');  // 퀴즈 데이터 가져오기
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

// public/uploads 폴더를 /uploads 경로로 정적 서빙
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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
