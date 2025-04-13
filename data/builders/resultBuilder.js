class QuizResultBuilder {
    constructor() {
        this.result = {
            isCorrect: false,
            correctAnswer: null,
            answerType: null,
            timeSpent: 0,
            submittedAt: new Date(),
            details: {}
        };
    }

    setBasicInfo(isCorrect, correctAnswer) {
        this.result.isCorrect = isCorrect;
        this.result.correctAnswer = correctAnswer;
        return this;
    }

    setTimeInfo(timeSpent, submittedAt) {
        this.result.timeSpent = timeSpent || 0;
        this.result.submittedAt = submittedAt || new Date();
        return this;
    }

    setAnswerType(type) {
        this.result.answerType = type;
        return this;
    }

    setTextAnswerDetails(userAnswer, normalizedAnswer) {
        this.result.details.textAnswer = {
            originalAnswer: userAnswer,
            normalizedAnswer: normalizedAnswer,
            correctAnswer: this.result.correctAnswer,
            partialMatch: normalizedAnswer.includes(this.result.correctAnswer.toLowerCase()) || 
                         this.result.correctAnswer.toLowerCase().includes(normalizedAnswer),
            answerLength: userAnswer.length
        };
        return this;
    }

    setChoiceAnswerDetails(selectedOption, correctOption, options) {
        const optionDistribution = {};
        options.forEach(opt => {
            optionDistribution[opt.id] = 0;
        });
        if (selectedOption) {
            optionDistribution[selectedOption.id] = 1;
        }

        this.result.details.choiceAnswer = {
            selectedOption: selectedOption ? {
                id: selectedOption.id,
                text: selectedOption.text
            } : null,
            correctOption: correctOption ? {
                id: correctOption.id,
                text: correctOption.text
            } : null,
            totalOptions: options.length,
            optionDistribution,
            partialScore: this.result.isCorrect ? 1 : 0
        };
        return this;
    }

    build() {
        return this.result;
    }
}

module.exports = QuizResultBuilder; 