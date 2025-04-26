const QuizFactory = require('../factories/quizFactory');
const { createError, ErrorCodes } = require('../utils/errorHandler');

class QuizModel {
    constructor(quizData) {
        this.quizData = quizData;
        this.currentQuestionIndex = 0;
        this.results = [];

        // 문제 타입별로 퀴즈 인스턴스 생성
        this.questions = quizData.questions.map(question => {
            const quizInstance = QuizFactory.createQuiz(question.type, quizData);
            return {
                question,
                quizInstance
            };
        });
    }

    // 현재 문제 가져오기
    getQuestion(questionId) {
        const questionData = this.questions.find(q => q.question.id === questionId);
        if (!questionData) {
            throw createError(
                '문제를 찾을 수 없습니다.',
                ErrorCodes.NOT_FOUND,
                { questionId }
            );
        }

        return questionData.quizInstance.getQuestionData(
            questionData.question,
            questionData.question.options
        );
    }

    // 답안 제출
    submitAnswer(questionId, answer) {
        const questionData = this.questions.find(q => q.question.id === questionId);
        if (!questionData) {
            throw createError(
                '문제를 찾을 수 없습니다.',
                ErrorCodes.NOT_FOUND,
                { questionId }
            );
        }

        const { question, quizInstance } = questionData;
        const isCorrect = quizInstance.validateAnswer(
            answer,
            question.answer,
            question.options
        );

        const result = quizInstance.processResult(
            isCorrect,
            question.answer,
            question.options,
            {
                userAnswer: answer,
                timeSpent: 0,  // 실제 구현에서는 시간 측정 필요
                submittedAt: new Date()
            }
        );

        this.results.push(result);
        return result;
    }

    // 결과 가져오기
    getResults() {
        return this.results;
    }
}

module.exports = QuizModel; 