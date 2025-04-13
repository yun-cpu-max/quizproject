class BaseQuiz {
    constructor(quizData) {
        this.id = quizData.id;
        this.title = quizData.title;
        this.category = quizData.category;
        this.description = quizData.description;
        this.thumbnail = quizData.thumbnail;
    }

    // 퀴즈 기본 정보 반환
    getQuizInfo() {
        return {
            id: this.id,
            title: this.title,
            category: this.category,
            description: this.description,
            thumbnail: this.thumbnail
        };
    }

    // 현재 문제 정보 가져오기 (자식 클래스에서 구현)
    getQuestionData(question, options = null) {
        throw new Error('getQuestionData must be implemented');
    }

    // 정답 검증 (자식 클래스에서 구현)
    validateAnswer(userAnswer, correctAnswer, options = null) {
        throw new Error('validateAnswer must be implemented');
    }

    // 결과 처리 (공통)
    processResult(isCorrect, correctAnswer) {
        return {
            isCorrect,
            correctAnswer,
            message: isCorrect ? '정답입니다!' : '틀렸습니다.'
        };
    }
}

module.exports = BaseQuiz; 