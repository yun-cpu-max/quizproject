const TextQuiz = require('../quizTypes/textQuiz');
const ChoiceQuiz = require('../quizTypes/choiceQuiz');
const { createError, ErrorCodes } = require('../utils/errorHandler');

class QuizFactory {
    static createQuiz(type, quizData) {
        const quizTypes = {
            text: TextQuiz,
            choice: ChoiceQuiz
        };
        
        const QuizClass = quizTypes[type];
        if (!QuizClass) {
            throw createError(
                '지원하지 않는 퀴즈 타입입니다.',
                ErrorCodes.VALIDATION,
                { type }
            );
        }
        
        return new QuizClass(quizData);
    }
}

module.exports = QuizFactory; 