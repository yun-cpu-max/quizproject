const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const quizRouter = require('./routes/quiz');  // 퀴즈 라우터 추가
const quizData = require('./data/quizData');  // 퀴즈 데이터 가져오기

const app = express();
const PORT = 3000;

// EJS 설정
app.set("view engine", "ejs");
app.use(express.static("public")); // CSS, 이미지 파일 사용 가능
app.use(bodyParser.urlencoded({ extended: true }));

// 세션 설정
app.use(session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: true
}));

// 임시 사용자 데이터
const users = [
    { username: 'test', password: 'test123' }
];

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
    console.log('로그인 시도:', { username, password }); // 디버깅용 로그
    
    const user = users.find(u => u.username === username && u.password === password);
    console.log('찾은 사용자:', user); // 디버깅용 로그
    
    if (user) {
        req.session.user = user;
        console.log('로그인 성공:', user); // 디버깅용 로그
        res.redirect('/');
    } else {
        console.log('로그인 실패'); // 디버깅용 로그
        res.render('login', { 
            error: '아이디 또는 비밀번호가 잘못되었습니다.',
            user: req.session.user 
        });
    }
});

// 로그아웃 처리
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// 회원가입 페이지 렌더링
app.get('/signup', (req, res) => {
    res.render('signup', { user: req.session.user });
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

// 퀴즈 라우터 추가
app.use('/quiz', quizRouter);

// 서버 실행
app.listen(PORT, () => console.log(`서버 실행 중입니다: http://localhost:${PORT}`));
