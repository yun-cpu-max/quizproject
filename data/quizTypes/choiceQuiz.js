const BaseQuiz = require('./baseQuiz');

class ChoiceQuiz extends BaseQuiz {
    constructor(quizData) {
        super(quizData);
    }

    getQuestionData(question, options) {
        if (!options || !Array.isArray(options)) {
            throw new Error('객관식 문제에는 선택지가 필요합니다.');
        }

        return {
            type: 'choice',
            questionImage: "/rogo.png",  // 기본 이미지
            questionText: question.question,
            options: options.sort((a, b) => a.order - b.order).map(opt => ({
                id: opt.id,
                text: opt.option_text,
                order: opt.order
            }))
        };
    }

    validateAnswer(userAnswer, correctAnswer, options) {
        if (!options || !Array.isArray(options)) {
            throw new Error('객관식 정답 검증에는 선택지가 필요합니다.');
        }

        const correctOption = options.find(opt => opt.is_correct);
        return userAnswer === correctOption.id.toString();
    }

    processResult(isCorrect, correctAnswer, options, resultData) {
        const baseResult = super.processResult(isCorrect, correctAnswer);
        const selectedOption = options.find(opt => opt.id.toString() === resultData.userAnswer);
        const correctOption = options.find(opt => opt.is_correct);

        // 선택지 통계 초기화 (실제로는 DB에서 가져와야 함)
        const optionDistribution = {};
        options.forEach(opt => {
            optionDistribution[opt.id] = 0;
        });
        // 예시 데이터로 현재 선택만 반영
        optionDistribution[selectedOption.id] = 1;

        return {
            ...baseResult,
            answerType: 'choice',
            timeSpent: resultData.timeSpent,
            submittedAt: resultData.submittedAt,
            details: {
                choiceAnswer: {
                    selectedOptionId: parseInt(resultData.userAnswer),
                    selectedOptionText: selectedOption.option_text,
                    correctOptionId: correctOption.id,
                    correctOptionText: correctOption.option_text,
                    totalOptions: options.length,
                    optionDistribution: optionDistribution,
                    // 부분 점수 계산 (필요한 경우)
                    partialScore: isCorrect ? 1 : 0
                }
            }
        };
    }
}

module.exports = ChoiceQuiz; 