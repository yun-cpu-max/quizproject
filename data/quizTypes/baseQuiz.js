const { createError, handleError, ErrorCodes } = require('../utils/errorHandler');
const { QuestionValidator } = require('../validators/questionValidator');

class BaseQuiz {
    constructor(quizData) {
        if (!quizData) {
            throw createError('퀴즈 데이터가 제공되지 않았습니다.', ErrorCodes.DATA);
        }

        if (!quizData.id || typeof quizData.id !== 'number') {
            throw createError('유효하지 않은 퀴즈 ID입니다.', ErrorCodes.DATA);
        }

        this.id = quizData.id;
        this.title = quizData.title || '제목 없음';
        this.description = quizData.description || '';
    }

    // 퀴즈 기본 정보 반환
    getQuizInfo() {
        try {
            return {
                id: this.id,
                title: this.title,
                description: this.description
            };
        } catch (error) {
            return handleError(error, 'BaseQuiz.getQuizInfo');
        }
    }

    // 현재 문제 정보 가져오기 (자식 클래스에서 구현)
    getQuestionData(question, options = null) {
        throw createError(
            'getQuestionData 메서드가 구현되지 않았습니다.',
            ErrorCodes.PROCESSING,
            { className: this.constructor.name }
        );
    }

    // 정답 검증 (자식 클래스에서 구현)
    validateAnswer(userAnswer, correctAnswer, options = null) {
        throw createError(
            'validateAnswer 메서드가 구현되지 않았습니다.',
            ErrorCodes.PROCESSING,
            { className: this.constructor.name }
        );
    }

    // 결과 처리 (자식 클래스에서 재정의 가능)
    processResult(isCorrect, correctAnswer) {
        return {
            isCorrect,
            correctAnswer
        };
    }

    // 유효성 검사 헬퍼 메서드
    validateQuestionData(question) {
        return QuestionValidator.validate(question, this.constructor.name.toLowerCase().replace('quiz', ''));
    }
}

module.exports = BaseQuiz; 