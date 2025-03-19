const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

// EJS 설정
app.set("view engine", "ejs");
app.use(express.static("public")); // CSS, 이미지 파일 사용 가능
app.use(bodyParser.urlencoded({ extended: true }));

// 샘플 데이터 (Machugi.io처럼 이미지 목록을 표시)
const images = [
  { title: "이미지 제목1", description: "이미지 설명1", src: "https://via.placeholder.com/250x200" },
  { title: "이미지 제목2", description: "이미지 설명2", src: "https://via.placeholder.com/250x200" },
  { title: "이미지 제목3", description: "이미지 설명3", src: "https://via.placeholder.com/250x200" },
];

// 메인 페이지 라우트
app.get("/", (req, res) => {
  res.render("index", { images });
});

// 검색 기능 (사용자가 검색어 입력하면 필터링)
app.post("/search", (req, res) => {
  const searchTerm = req.body.search.toLowerCase();
  const filteredImages = images.filter(img =>
    img.title.toLowerCase().includes(searchTerm) || img.description.toLowerCase().includes(searchTerm)
  );
  res.render("index", { images: filteredImages });
});

// 로그인 페이지 렌더링
app.get('/login', (req, res) => {
    res.render('login'); // login.ejs 파일을 렌더링
});

// 회원가입 페이지 렌더링
app.get('/signup', (req, res) => {
    res.render('signup'); // signup.ejs 파일을 렌더링
});

// 공지사항 페이지 렌더링
app.get('/notice', (req, res) => {
    res.render('notice'); // notice.ejs 파일을 렌더링
});

// 서버 실행
app.listen(PORT, () => console.log(`서버 실행 중입니다: http://localhost:${PORT}`));
