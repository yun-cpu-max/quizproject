const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const quizRouter = require('./routes/quiz');  // 퀴즈 라우터 추가
const quizData = require('./data/quizData');  // 퀴즈 데이터 가져오기
const mysql = require('mysql2');

const app = express();
const PORT = 3000;

// MySQL 연결 설정
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',        // MySQL 사용자 이름
    password: 'mysql@24!',        // MySQL 비밀번호
    database: 'quiz_db'  // 데이터베이스 이름
});

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
  res.render("index", { images: quizData, user: req.session.user });
});

// 검색 기능 (사용자가 검색어 입력하면 필터링)
app.post("/search", (req, res) => {
  const searchTerm = req.body.search.toLowerCase();
  const filteredImages = quizData.filter(img =>
    img.title.toLowerCase().includes(searchTerm) || img.description.toLowerCase().includes(searchTerm)
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
    res.render('notice', { user: req.session.user });
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

// 퀴즈 라우터 추가
app.use('/quiz', quizRouter);

// 서버 실행
app.listen(PORT, () => console.log(`서버 실행 중입니다: http://localhost:${PORT}`));
