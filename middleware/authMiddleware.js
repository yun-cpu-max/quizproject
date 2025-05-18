function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/login');
}

function ensureAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        // req.user를 다음 미들웨어나 라우트 핸들러에서 사용할 수 있도록 설정 (선택 사항)
        req.user = req.session.user;
        return next();
    }
    // 관리자가 아니면, 권한 없음 페이지 또는 홈페이지로 리다이렉트
    // res.status(403).send('접근 권한이 없습니다.');
    res.redirect('/'); 
}

module.exports = {
    ensureAuthenticated,
    ensureAdmin
}; 