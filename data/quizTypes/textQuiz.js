const BaseQuiz = require('./baseQuiz');

class TextQuiz extends BaseQuiz {
    constructor(quizData) {
        super(quizData);
    }

    getQuestionData(question) {
        return {
            type: 'text',
            questionImage: "/rogo.png",  // 기본 이미지
            questionText: question.question,
            inputType: 'text',
            placeholder: '답안을 입력하세요'
        };
    }

    validateAnswer(userAnswer, correctAnswer) {
        // 대소문자 구분 없이, 공백 제거 후 비교
        return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    }

    processResult(isCorrect, correctAnswer, options, resultData) {
        const baseResult = super.processResult(isCorrect, correctAnswer);
        const normalizedUserAnswer = resultData.userAnswer.trim().toLowerCase();
        const normalizedCorrectAnswer = correctAnswer.trim().toLowerCase();

        return {
            ...baseResult,
            answerType: 'text',
            timeSpent: resultData.timeSpent,
            submittedAt: resultData.submittedAt,
            details: {
                textAnswer: {
                    originalAnswer: resultData.userAnswer,
                    normalizedAnswer: normalizedUserAnswer,
                    correctAnswer: correctAnswer,
                    partialMatch: normalizedUserAnswer.includes(normalizedCorrectAnswer) || 
                                normalizedCorrectAnswer.includes(normalizedUserAnswer)
                }
            }
        };
    }
}

module.exports = TextQuiz; 