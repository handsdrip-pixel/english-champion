import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// 빌드 타임이 아닌 런타임에만 호출되도록 dynamic 설정
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
- 문장 구조: 단문 위주 (I like apples. What is this?)
- 주의: 읽기·쓰기보다 듣기·말하기 중심. 알파벳 인식 및 파닉스 기초 포함`,
  },
  elem_5_6: {
    label: "초등학교 5-6학년",
    guide: `[2015·2022 개정 교육과정 - 초등 5-6학년 영어]
- 어휘 수준: 약 500~600단어 (일상생활·학교·가족·음식·직업 등)
- 핵심 문법: 현재형/과거형 동사, 조동사(can/will/must), 의문문(WH-Question), 명령문
- 문장 구조: 2~3개 절의 복문 시작 (I can swim because I practiced a lot.)
- 표현: 좋아하는 것 말하기, 경험 말하기, 일상 대화, 길 안내 기초
- 주의: 읽기·쓰기 병행. 짧은 지문 이해 포함`,
  },
  middle_1: {
    label: "중학교 1학년",
    guide: `[2015·2022 개정 교육과정 - 중학교 1학년 영어]
- 어휘 수준: 약 750단어 이하 (초등 누적 포함)
- 핵심 문법: be동사·일반동사 현재/과거, 진행형(be+ing), 미래형(will/be going to), 빈도부사
- 문장 구조: 단문+복문 혼합 (He was playing soccer when I called him.)
- 읽기: 100~150단어 내외 지문. 주제 파악, 세부 정보 확인
- 쓰기: 간단한 문장 쓰기, 일기·편지 형식
- 주의: 문법 용어 등장 시작 (주어, 동사, 목적어 등)`,
  },
  middle_2: {
    label: "중학교 2학년",
    guide: `[2015·2022 개정 교육과정 - 중학교 2학년 영어]
- 어휘 수준: 약 1,000단어 이하
- 핵심 문법: 현재완료(have+p.p.), 비교급·최상급, to부정사(명사적·형용사적 용법), 접속사(although/because/if)
- 문장 구조: 복합문 (If it rains, I will stay home.)
- 읽기: 150~200단어 내외. 글의 흐름 파악, 추론
- 쓰기: 단락 쓰기, 이메일·메모 형식
- 주의: 의미 단위로 끊어 읽기, 어휘 유추 능력 강조`,
  },
  middle_3: {
    label: "중학교 3학년",
    guide: `[2015·2022 개정 교육과정 - 중학교 3학년 영어]
- 어휘 수준: 약 1,200단어 이하
- 핵심 문법: 관계대명사(who/which/that), 분사(현재분사·과거분사), 수동태(be+p.p.), 동명사
- 문장 구조: 복잡한 복문, 관계절 포함 (The book that I read yesterday was interesting.)
- 읽기: 200~250단어. 주제·요지 파악, 글쓴이 의도 추론
- 쓰기: 의견 쓰기, 설명문·논설문 기초
- 주의: 중학 내신·영어 독해 심화 준비 단계`,
  },
  high_1: {
    label: "고등학교 1학년",
    guide: `[2015·2022 개정 교육과정 - 고등학교 1학년 공통영어]
- 어휘 수준: 약 1,800단어 (중학 누적 + 고교 신규)
- 핵심 문법: 완료형(현재완료·과거완료), 수동태 심화, 관계부사, to부정사·동명사 심화
- 문장 구조: 복잡한 복합문, 삽입절, 도치 기초 (Not only A but also B)
- 읽기: 300~350단어. 빈칸 추론, 어휘 문맥 파악, 글의 순서/삽입
- 쓰기: 요약문, 서술형 답안, 의견 쓰기
- 주의: 수능 유형(EBS 연계) 첫 접촉. 고1 모의고사 수준`,
  },
  high_2: {
    label: "고등학교 2학년",
    guide: `[2015·2022 개정 교육과정 - 고등학교 2학년 영어 I / 독해와 작문]
- 어휘 수준: 약 2,500단어 (고교 심화 어휘 포함)
- 핵심 문법: 가정법(가정법 과거·과거완료), 분사구문, 강조구문(It is ~ that), 도치 심화
- 문장 구조: 고급 복합문. 구와 절의 정확한 구별
- 읽기: 350~400단어. 논리적 흐름·함의 파악. 수능 유형 집중 훈련
- 쓰기: 요약·번역·영작 포함, 서술형 고급
- 주의: 내신 서술형 + 수능 대비 병행. EBS 수능특강 수준`,
  },
  high_3: {
    label: "고등학교 3학년",
    guide: `[2015·2022 개정 교육과정 - 고등학교 3학년 / 수능 대비]
- 어휘 수준: 약 3,000단어 이상 (수능 필수 어휘 전범위)
- 핵심 문법: 전범위 문법 통합. 문장 구조 분석 능력
- 읽기: 400~450단어 이상. 철학·사회·과학·예술 등 다양한 소재. 수능 전 유형(빈칸·순서·삽입·함의·요약 등)
- 쓰기: 고급 영작 및 요약
- 주의: 대학수학능력시험(CSAT) 수준. EBS 수능완성 기준. 추상적·학문적 어휘 포함`,
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
      "explanation": "해설",
      "hint": "힌트(spelling 타입만)"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const body = await req.json();
  const { topic, count = 5, type = "multiple", grade = "elem_5_6", image, imageType } = body;

  const curriculum = gradeCurriculums[grade] || gradeCurriculums["elem_5_6"];
  const typeGuide = typeInstructions[type] || typeInstructions.multiple;

  const systemContent = `당신은 대한민국 공교육 영어 교육과정 전문가이자 ${curriculum.label} 담당 영어 교사입니다.

[적용 교육과정]
${curriculum.guide}

[문제 유형]
${typeGuide}

[출력 형식] - JSON만 출력, 다른 텍스트 없이:
${jsonSchema}

[필수 규칙]
- 위 교육과정 수준에 정확히 맞는 어휘와 문법만 사용
- 해당 학년 학생이 실제로 접할 수 있는 교과서·모의고사 스타일로 출제
- 문제와 선택지는 명확하고 오해 없이 작성
- explanation(해설)은 학생이 이해하기 쉽게 한국어로 작성`;

  let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  if (image) {
    messages = [
      { role: "system", content: systemContent },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${imageType || "image/jpeg"};base64,${image}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: `위 이미지는 영어 교재 또는 학습 자료입니다.
이미지 속 영어 단어·문장·문법 내용을 분석하여 ${curriculum.label} 수준에 맞는 영어 퀴즈를 ${count}개 만들어주세요.
이미지의 실제 내용을 최대한 활용하고, 부족하면 같은 주제로 확장하세요.`,
          },
        ],
      },
    ];
  } else {
    messages = [
      { role: "system", content: systemContent },
      {
        role: "user",
        content: `주제: "${topic}"
문제 수: ${count}개
${curriculum.label} 수준에 맞는 영어 퀴즈를 만들어주세요.`,
      },
    ];
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 3000,
  });

  const content = response.choices[0].message.content;
  if (!content) return NextResponse.json({ error: "생성 실패" }, { status: 500 });

  const parsed = JSON.parse(content);
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
  hint?: string;
}
