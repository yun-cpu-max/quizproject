const BaseQuiz = require('./baseQuiz');
const { createError, handleError, ErrorCodes } = require('../utils/errorHandler');
const QuizResultBuilder = require('../builders/resultBuilder');

class TextQuiz extends BaseQuiz {
    static MAX_ANSWER_LENGTH = 255;  // VARCHAR(255) 제한

    constructor(quizData) {
        super(quizData);
    }

    validateInput(input) {
        if (!input) {
            throw createError('답안이 제공되지 않았습니다.', ErrorCodes.VALIDATION);
        }

        const sanitized = input.toString().trim();
        if (sanitized.length === 0) {
            throw createError('답안이 비어있습니다.', ErrorCodes.VALIDATION);
        }

        if (sanitized.length > TextQuiz.MAX_ANSWER_LENGTH) {
            throw createError(
                `답안은 최대 ${TextQuiz.MAX_ANSWER_LENGTH}자까지만 허용됩니다.`,
                ErrorCodes.VALIDATION,
                { maxLength: TextQuiz.MAX_ANSWER_LENGTH, actualLength: sanitized.length }
            );
        }

        return sanitized;
    }

    getQuestionData(question) {
        try {
            // BaseQuiz의 validateQuestionData 사용
            this.validateQuestionData(question);
            
            return {
                type: 'text',
                questionId: question.id,
                questionImage: question.image || "/rogo.png",
                questionText: question.text
            };
        } catch (error) {
            throw createError(
                '문제 데이터 처리 중 오류가 발생했습니다.',
                ErrorCodes.PROCESSING,
                { originalError: error.message }
            );
        }
    }

    validateAnswer(userAnswer, correctAnswer) {
        if (correctAnswer === null || correctAnswer === undefined) {
            throw createError('정답이 설정되지 않았습니다.', ErrorCodes.DATA);
        }

        try {
            const sanitizedUserAnswer = this.validateInput(userAnswer);
            const sanitizedCorrectAnswer = this.validateInput(correctAnswer);
            
            return sanitizedUserAnswer.toLowerCase() === sanitizedCorrectAnswer.toLowerCase();
        } catch (error) {
            return handleError(error, 'TextQuiz.validateAnswer');
        }
    }

    processResult(isCorrect, correctAnswer, options, resultData) {
        if (!resultData) {
            throw createError('결과 데이터가 제공되지 않았습니다.', ErrorCodes.DATA);
        }

        try {
            const sanitizedUserAnswer = this.validateInput(resultData.userAnswer);
            const sanitizedCorrectAnswer = this.validateInput(correctAnswer);
            
            const normalizedUserAnswer = sanitizedUserAnswer.toLowerCase();
            const normalizedCorrectAnswer = sanitizedCorrectAnswer.toLowerCase();

            return new QuizResultBuilder()
                .setBasicInfo(isCorrect, correctAnswer)
                .setTimeInfo(resultData.timeSpent, resultData.submittedAt)
                .setAnswerType('text')
                .setTextAnswerDetails(resultData.userAnswer, normalizedUserAnswer)
                .build();
        } catch (error) {
            return handleError(error, 'TextQuiz.processResult');
        }
    }
}

module.exports = TextQuiz; 