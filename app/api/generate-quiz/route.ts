import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

const typeInstructions: Record<string, string> = {
  multiple: `4지선다 객관식. "options": ["A", "B", "C", "D"] 배열에 4개의 선택지를 포함하고, "answer"는 정답 텍스트.`,
  ox: `OX 퀴즈. "options": ["O", "X"], "answer"는 "O" 또는 "X".`,
  spelling: `영단어 스펠링 주관식. "options" 없이 "hint"에 초성 힌트(예: "_ _ _ _" 형태)와 뜻을 제공. "answer"는 영단어 정답.`,
  mixed: `문제마다 type을 "multiple", "ox", "spelling" 중 하나로 랜덤 배정.`,
};

// 대한민국 공교육 영어 교육과정 (교육부 고시 기준)
const gradeCurriculums: Record<string, { label: string; guide: string }> = {
  elem_3_4: {
    label: "초등학교 3-4학년",
    guide: `[2015·2022 개정 교육과정 - 초등 3-4학년 영어]
- 어휘 수준: 약 240단어 이하 (기초 생활 어휘)
- 핵심 표현: 인사(Hello/Goodbye), 자기소개(My name is), 숫자(1~20), 색깔, 동물, 날씨 등
- 문법: 단순 현재형(is/are, have), 지시대명사(This/That), 단수·복수 기초
- 문장 구조: 단문 위주 (I like apples. What is this?)`,
  },
  elem_5_6: {
    label: "초등학교 5-6학년",
    guide: `[2015·2022 개정 교육과정 - 초등 5-6학년 영어]
- 어휘 수준: 약 500~600단어 (일상생활·학교·가족·음식·직업 등)
- 핵심 문법: 현재형/과거형 동사, 조동사(can/will/must), 의문문(WH-Question), 명령문
- 문장 구조: 2~3개 절의 복문 시작`,
  },
  middle_1: {
    label: "중학교 1학년",
    guide: `[2015·2022 개정 교육과정 - 중학교 1학년 영어]
- 어휘 수준: 약 750단어 이하
- 핵심 문법: be동사·일반동사 현재/과거, 진행형(be+ing), 미래형(will/be going to), 빈도부사`,
  },
  middle_2: {
    label: "중학교 2학년",
    guide: `[2015·2022 개정 교육과정 - 중학교 2학년 영어]
- 어휘 수준: 약 1,000단어 이하
- 핵심 문법: 현재완료(have+p.p.), 비교급·최상급, to부정사, 접속사(although/because/if)`,
  },
  middle_3: {
    label: "중학교 3학년",
    guide: `[2015·2022 개정 교육과정 - 중학교 3학년 영어]
- 어휘 수준: 약 1,200단어 이하
- 핵심 문법: 관계대명사(who/which/that), 분사, 수동태(be+p.p.), 동명사`,
  },
  high_1: {
    label: "고등학교 1학년",
    guide: `[2015·2022 개정 교육과정 - 고등학교 1학년]
- 어휘 수준: 약 1,800단어
- 핵심 문법: 완료형 심화, 수동태 심화, 관계부사, 수능 기초 유형`,
  },
  high_2: {
    label: "고등학교 2학년",
    guide: `[2015·2022 개정 교육과정 - 고등학교 2학년]
- 어휘 수준: 약 2,500단어
- 핵심 문법: 가정법(과거·과거완료), 분사구문, 강조구문, EBS 수준`,
  },
  high_3: {
    label: "고등학교 3학년",
    guide: `[2015·2022 개정 교육과정 - 고등학교 3학년]
- 어휘 수준: 약 3,000단어 이상 (수능 필수 어휘 전범위)
- 핵심 문법: 전범위 통합, 수능 전 유형 완성`,
  },
};

const jsonSchema = `{
  "title": "퀴즈 제목",
  "questions": [
    {
      "id": "q1",
      "type": "multiple | ox | spelling",
      "question": "문제 텍스트",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "answer": "정답",
      "explanation": "핵심 해설 (1~2문장, 한국어)",
      "example": "정답을 활용한 예시 문장 (영어 문장 + 한국어 해석, 예: 'I went to school. → 나는 학교에 갔다.')",
      "hint": "힌트(spelling 타입만)"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const body = await req.json();
  const { topic, count = 5, type = "multiple", grade = "elem_5_6", image, imageType } = body;

  const curriculum = gradeCurriculums[grade] || gradeCurriculums["elem_5_6"];
  const typeGuide = typeInstructions[type] || typeInstructions.multiple;

  const systemPrompt = `당신은 대한민국 공교육 영어 교육과정 전문가이자 ${curriculum.label} 담당 영어 교사입니다.

[적용 교육과정]
${curriculum.guide}

[문제 유형]
${typeGuide}

[출력 형식] - 반드시 순수 JSON만 출력. 마크다운 코드블록(\`\`\`)이나 다른 텍스트 없이:
${jsonSchema}

[필수 규칙]
- 위 교육과정 수준에 정확히 맞는 어휘와 문법만 사용
- 해당 학년 학생이 실제로 접할 수 있는 교과서 스타일로 출제
- explanation(해설)은 학생이 이해하기 쉽게 한국어로 작성`;

  let contents: Parameters<typeof ai.models.generateContent>[0]["contents"];

  if (image) {
    const userText = `위 이미지는 영어 교재 또는 학습 자료입니다.
이미지 속 영어 단어·문장·문법 내용을 분석하여 ${curriculum.label} 수준에 맞는 영어 퀴즈를 ${count}개 만들어주세요.
이미지의 실제 내용을 최대한 활용하고, 부족하면 같은 주제로 확장하세요.`;

    contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: (imageType || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: image,
            },
          },
          { text: userText },
        ],
      },
    ];
  } else {
    const userText = `주제: "${topic}"
문제 수: ${count}개
${curriculum.label} 수준에 맞는 영어 퀴즈를 만들어주세요.`;

    contents = [
      {
        role: "user",
        parts: [{ text: userText }],
      },
    ];
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 3000,
    },
    contents,
  });

  const rawText = response.text ?? "";

  // 혹시 ```json ... ``` 래핑이 있을 경우 제거
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned);

  const quizSet = {
    id: `quiz_${Date.now()}`,
    topic: topic || "교재 이미지",
    title: parsed.title || (topic ? `${topic} 퀴즈` : "교재 기반 퀴즈"),
    grade,
    gradeLabel: curriculum.label,
    questions: parsed.questions.map((q: QuizQuestion, i: number) => ({
      ...q,
      id: `q${i + 1}`,
      type: type === "mixed" ? (q.type || "multiple") : type,
    })),
    createdAt: Date.now(),
  };

  return NextResponse.json(quizSet);
}

interface QuizQuestion {
  id?: string;
  type?: string;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  example?: string;
  hint?: string;
}
