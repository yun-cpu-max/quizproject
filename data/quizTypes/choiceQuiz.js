const BaseQuiz = require('./baseQuiz');
const { createError, handleError, ErrorCodes } = require('../utils/errorHandler');
const QuizResultBuilder = require('../builders/resultBuilder');

class ChoiceQuiz extends BaseQuiz {
    static MAX_OPTIONS = 5;  // 최대 선택지 개수 제한
    static MAX_OPTION_TEXT_LENGTH = 255;  // 선택지 텍스트 길이 제한

    constructor(quizData) {
        super(quizData);
    }

    sanitizeInput(input) {
        if (input === null || input === undefined) {
            return '';
        }
        
        // HTML 태그 제거 및 이스케이프
        return input
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .trim();
    }

    validateOptions(options) {
        if (!Array.isArray(options) || options.length === 0) {
            throw createError('선택지가 제공되지 않았습니다.', ErrorCodes.VALIDATION);
        }

        if (options.length > ChoiceQuiz.MAX_OPTIONS) {
            throw createError(
                `선택지는 최대 ${ChoiceQuiz.MAX_OPTIONS}개까지만 허용됩니다.`,
                ErrorCodes.VALIDATION,
                { maxOptions: ChoiceQuiz.MAX_OPTIONS, actualOptions: options.length }
            );
        }

        const seenIds = new Set();
        options.forEach((option, index) => {
            if (!option.id || !option.text) {
                throw createError(
                    '유효하지 않은 선택지 형식입니다.',
                    ErrorCodes.VALIDATION,
                    { optionIndex: index }
                );
            }

            if (seenIds.has(option.id)) {
                throw createError(
                    '중복된 선택지 ID가 있습니다.',
                    ErrorCodes.VALIDATION,
                    { duplicateId: option.id }
                );
            }
            seenIds.add(option.id);
        });

        return true;
    }

    shuffleOptions(options) {
        const shuffled = [...options];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    getQuestionData(question, options) {
        try {
            // BaseQuiz의 validateQuestionData 사용
            this.validateQuestionData(question);
            
            if (!options) {
                throw createError('선택지가 없는 객관식 문제입니다.', ErrorCodes.DATA);
            }

            this.validateOptions(options);
            const shuffledOptions = this.shuffleOptions(options);

            return {
                type: 'choice',
                questionId: question.id,
                questionImage: question.image || "/rogo.png",
                questionText: question.text,
                options: shuffledOptions.map((opt, index) => ({
                    id: opt.id,
                    text: opt.text,
                    order: index + 1
                }))
            };
        } catch (error) {
            throw createError(
                '문제 데이터 처리 중 오류가 발생했습니다.',
                ErrorCodes.PROCESSING,
                { originalError: error.message }
            );
        }
    }

    validateAnswer(userAnswer, correctAnswer, options) {
        if (!options || !Array.isArray(options)) {
            throw createError('선택지 정보가 없습니다.', ErrorCodes.DATA);
        }

        try {
            this.validateOptions(options);
            
            if (!userAnswer) {
                return false;
            }

            const selectedOption = options.find(opt => opt.id === userAnswer);
            if (!selectedOption) {
                throw createError('유효하지 않은 답안입니다.', ErrorCodes.VALIDATION);
            }

            return userAnswer === correctAnswer;
        } catch (error) {
            return handleError(error, 'ChoiceQuiz.validateAnswer');
        }
    }

    processResult(isCorrect, correctAnswer, options, resultData) {
        if (!resultData) {
            throw createError('결과 데이터가 제공되지 않았습니다.', ErrorCodes.DATA);
        }

        try {
            const selectedOption = options.find(opt => opt.id === resultData.userAnswer);
            const correctOption = options.find(opt => opt.id === correctAnswer);

            return new QuizResultBuilder()
                .setBasicInfo(isCorrect, correctAnswer)
                .setTimeInfo(resultData.timeSpent, resultData.submittedAt)
                .setAnswerType('choice')
                .setChoiceAnswerDetails(selectedOption, correctOption, options)
                .build();
        } catch (error) {
            return handleError(error, 'ChoiceQuiz.processResult');
        }
    }
}

module.exports = ChoiceQuiz; 