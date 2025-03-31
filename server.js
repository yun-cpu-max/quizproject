const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");

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
  { 
    id: 1,
    title: "이미지 제목1", 
    description: "이미지 설명1", 
    src: "/images/rogo.png",  // 절대 경로로 수정
    questions: "퀴즈 설명입니다."
  },
  { 
    id: 2,
    title: "이미지 제목2", 
    description: "이미지 설명2", 
    src: "/images/rogo.png",
    questions: "퀴즈 설명입니다."
  },
  { 
    id: 3,
    title: "이미지 제목3", 
    description: "이미지 설명3", 
    src: "/images/rogo.png",
    questions: "퀴즈 설명입니다."
  }
];

// 메인 페이지 라우트
app.get("/", (req, res) => {
  res.render("index", { images, user: req.session.user });
});

// 검색 기능 수정
app.post("/search", (req, res) => {
  const searchTerm = req.body.search.toLowerCase();
  const filteredImages = images.filter(img =>
    img.title.toLowerCase().includes(searchTerm) || 
    img.description.toLowerCase().includes(searchTerm)
  );
  res.render("index", { images: filteredImages });
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

// 퀴즈 상세 페이지 라우트 추가
app.get("/quiz/:id", (req, res) => {
  const quizId = parseInt(req.params.id);
  const quiz = images.find(q => q.id === quizId);
  
  if (!quiz) {
    return res.render('404', { message: "퀴즈를 찾을 수 없습니다" });
  }
  
  res.render("quiz", { quiz, user: req.session.user });
});

// 퀴즈 상세 페이지 라우트 추가
app.get("/quiz/:id", (req, res) => {
  const quizId = parseInt(req.params.id);
  const quiz = images.find(q => q.id === quizId);
  
  if (!quiz) {
    return res.render('404', { message: "퀴즈를 찾을 수 없습니다" });
  }
  
  res.render("quiz", { quiz, user: req.session.user });
});

// 서버 실행
app.listen(PORT, () => console.log(`서버 실행 중입니다: http://localhost:${PORT}`));
