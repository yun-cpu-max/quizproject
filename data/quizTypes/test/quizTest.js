const TextQuiz = require('../textQuiz');
const ChoiceQuiz = require('../choiceQuiz');

// 테스트용 데이터
const sampleQuizData = {
    id: 1,
    title: "테스트 퀴즈",
    category: "textQuiz",
    description: "테스트용 설명",
    thumbnail: "/rogo.png"
};

const sampleTextQuestion = {
    id: 1,
    quiz_id: 1,
    question: "1 + 1 = ?",
    question_type: "text",
    correct_answer: "2"
};

const sampleChoiceQuestion = {
    id: 2,
    quiz_id: 1,
    question: "다음 중 가장 큰 수는?",
    question_type: "choice",
    correct_answer: "3"
};

const sampleOptions = [
    { id: 1, text: "1", is_correct: false, order: 1 },
    { id: 2, text: "2", is_correct: false, order: 2 },
    { id: 3, text: "3", is_correct: true, order: 3 },
    { id: 4, text: "0", is_correct: false, order: 4 }
];

// 결과 처리 테스트용 데이터
const sampleResultData = {
    quizId: 1,
    userId: 1,
    questionId: 1,
    submittedAt: new Date(),
    timeSpent: 25
};

// 선택지 순서 테스트를 위한 함수
function testOptionShuffling(choiceQuiz, options, iterations = 5) {
    console.log("\n2.5 선택지 무작위 출력 테스트");
    
    // 여러 번 실행하여 순서가 변경되는지 확인
    const orderSets = new Set();
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
        const questionData = choiceQuiz.getQuestionData(sampleChoiceQuestion, options);
        const orderString = questionData.options.map(opt => opt.id).join(',');
        orderSets.add(orderString);
        results.push(questionData);
        
        // 기본 검증
        console.assert(questionData.options.length === options.length, 
            "선택지 개수가 변경되었습니다.");
        
        // 순서 값 검증
        const orders = questionData.options.map(opt => opt.order);
        console.assert(
            orders.every((order, idx) => order === idx + 1),
            "선택지 순서가 1부터 순차적이지 않습니다."
        );
        
        // 모든 선택지가 존재하는지 검증
        const originalIds = new Set(options.map(opt => opt.id));
        const shuffledIds = new Set(questionData.options.map(opt => opt.id));
        console.assert(
            [...originalIds].every(id => shuffledIds.has(id)),
            "일부 선택지가 누락되었습니다."
        );
    }
    
    // 순서가 실제로 변경되는지 확인
    console.assert(
        orderSets.size > 1,
        "여러 번 실행했을 때 순서가 전혀 변경되지 않았습니다."
    );
    
    // 정답 검증이 여전히 작동하는지 확인
    const lastResult = results[results.length - 1];
    const correctOption = lastResult.options.find(opt => 
        options.find(o => o.id === opt.id && o.is_correct)
    );
    
    console.assert(
        choiceQuiz.validateAnswer(correctOption.id.toString(), "3", options),
        "섞인 후 정답 검증이 실패했습니다."
    );
    
    console.log("✓ 선택지 무작위 출력 테스트 통과");
}

// 테스트 실행 함수
function runTests() {
    console.log("=== 퀴즈 클래스 테스트 시작 ===\n");

    // TextQuiz 테스트
    console.log("1. TextQuiz 테스트");
    try {
        const textQuiz = new TextQuiz(sampleQuizData);
        
        // 기본 정보 테스트
        console.log("1.1 기본 정보 테스트");
        const quizInfo = textQuiz.getQuizInfo();
        console.assert(quizInfo.id === sampleQuizData.id, "ID가 일치하지 않습니다.");
        console.log("✓ 기본 정보 테스트 통과");

        // 문제 데이터 테스트
        console.log("\n1.2 문제 데이터 테스트");
        const questionData = textQuiz.getQuestionData(sampleTextQuestion);
        console.assert(questionData.type === 'text', "문제 타입이 올바르지 않습니다.");
        console.assert(questionData.questionText === sampleTextQuestion.question, "문제 텍스트가 일치하지 않습니다.");
        console.log("✓ 문제 데이터 테스트 통과");

        // 정답 검증 테스트
        console.log("\n1.3 정답 검증 테스트");
        console.assert(textQuiz.validateAnswer("2", "2") === true, "정확한 정답 검증 실패");
        console.assert(textQuiz.validateAnswer(" 2 ", "2") === true, "공백 처리 검증 실패");
        console.assert(textQuiz.validateAnswer("3", "2") === false, "오답 검증 실패");
        console.log("✓ 정답 검증 테스트 통과");
    } catch (error) {
        console.error("TextQuiz 테스트 실패:", error);
    }

    // ChoiceQuiz 테스트
    console.log("\n2. ChoiceQuiz 테스트");
    try {
        const choiceQuiz = new ChoiceQuiz({...sampleQuizData, category: "choiceQuiz"});
        
        // 기본 정보 테스트
        console.log("2.1 기본 정보 테스트");
        const quizInfo = choiceQuiz.getQuizInfo();
        console.assert(quizInfo.category === "choiceQuiz", "카테고리가 일치하지 않습니다.");
        console.log("✓ 기본 정보 테스트 통과");

        // 문제 데이터 테스트
        console.log("\n2.2 문제 데이터 테스트");
        const questionData = choiceQuiz.getQuestionData(sampleChoiceQuestion, sampleOptions);
        console.assert(questionData.type === 'choice', "문제 타입이 올바르지 않습니다.");
        console.assert(questionData.options.length === 4, "선택지 개수가 올바르지 않습니다.");
        console.log("✓ 문제 데이터 테스트 통과");

        // 정답 검증 테스트
        console.log("\n2.3 정답 검증 테스트");
        console.assert(choiceQuiz.validateAnswer(3, 3, sampleOptions) === true, "정답 검증 실패");
        console.assert(choiceQuiz.validateAnswer(1, 3, sampleOptions) === false, "오답 검증 실패");
        console.log("✓ 정답 검증 테스트 통과");

        // 예외 처리 테스트
        console.log("\n2.4 예외 처리 테스트");
        try {
            choiceQuiz.getQuestionData(sampleChoiceQuestion);
            console.log("❌ 선택지 없는 경우 예외 처리 실패");
        } catch (e) {
            console.log("✓ 선택지 없는 경우 예외 처리 통과");
        }

        // 선택지 무작위 출력 테스트 추가
        testOptionShuffling(choiceQuiz, sampleOptions);

    } catch (error) {
        console.error("ChoiceQuiz 테스트 실패:", error);
    }

    // 결과 처리 테스트
    testResultProcessing();

    console.log("\n=== 테스트 완료 ===");
}

function testResultProcessing() {
    console.log("\n3. 결과 처리 테스트");

    // TextQuiz 결과 처리 테스트
    console.log("\n3.1 TextQuiz 결과 처리 테스트");
    try {
        const textQuiz = new TextQuiz(sampleQuizData);
        const textResult = textQuiz.processResult(
            true,                      // isCorrect
            sampleTextQuestion.correct_answer,
            null,                      // options (텍스트 퀴즈는 불필요)
            {
                ...sampleResultData,
                userAnswer: "2",
                questionType: "text"
            }
        );

        // 결과 검증
        console.assert(textResult.isCorrect === true, "정답 여부 처리 실패");
        console.assert(textResult.answerType === "text", "답안 타입 처리 실패");
        console.assert(textResult.details.textAnswer.normalizedAnswer === "2", "정규화된 답안 처리 실패");
        console.log("✓ TextQuiz 결과 처리 테스트 통과");
    } catch (error) {
        console.error("TextQuiz 결과 처리 테스트 실패:", error);
    }

    // ChoiceQuiz 결과 처리 테스트
    console.log("\n3.2 ChoiceQuiz 결과 처리 테스트");
    try {
        const choiceQuiz = new ChoiceQuiz({...sampleQuizData, category: "choiceQuiz"});
        const choiceResult = choiceQuiz.processResult(
            true,                       // isCorrect
            3,                          // correctAnswer
            sampleOptions,
            {
                ...sampleResultData,
                userAnswer: 3,          // 문자열에서 숫자로 변경
                questionType: "choice"
            }
        );

        // 결과 검증
        console.assert(choiceResult.isCorrect === true, "정답 여부 처리 실패");
        console.assert(choiceResult.answerType === "choice", "답안 타입 처리 실패");
        console.assert(choiceResult.details.choiceAnswer.totalOptions === 4, "선택지 개수 처리 실패");
        console.assert(
            choiceResult.details.choiceAnswer.selectedOption && 
            choiceResult.details.choiceAnswer.selectedOption.id === 3, 
            "선택된 답안 처리 실패"
        );
        console.log("✓ ChoiceQuiz 결과 처리 테스트 통과");

        // 부분 점수 처리 테스트 (해당되는 경우)
        if (choiceResult.details.choiceAnswer.partialScore !== undefined) {
            console.assert(
                choiceResult.details.choiceAnswer.partialScore >= 0 && 
                choiceResult.details.choiceAnswer.partialScore <= 1,
                "부분 점수 범위 오류"
            );
        }
    } catch (error) {
        console.error("ChoiceQuiz 결과 처리 테스트 실패:", error);
    }
}

// 테스트 실행
runTests(); 