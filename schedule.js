// 2026학년도 1학기 나주고 3학년 기말고사 시간표
// type: 'common'   = 전체 공통(모두 응시)
//       'elective' = 선택과목(트랙안내에 든 과목만 응시, 아니면 자율학습)
const SCHEDULE = [
  {
    date: "6/29", dow: "월",
    periods: [
      { no: 1, time: "08:40~09:30", type: "common",   subjects: ["화법과 작문"] },
      { no: 2, time: "10:00~10:50", type: "elective", subjects: ["경제수학"] },
      { no: 3, time: "11:20~12:10", type: "elective", subjects: ["윤리와 사상", "화학Ⅱ"] },
    ],
  },
  {
    date: "6/30", dow: "화",
    periods: [
      { no: 1, time: "08:40~09:30", type: "elective", subjects: ["수학과제 탐구"] },
      { no: 2, time: "10:00~10:50", type: "elective", subjects: ["영미 문학 읽기"] },
      { no: 3, time: "11:20~12:10", type: "elective", subjects: ["기하", "한국지리"] },
    ],
  },
  {
    date: "7/1", dow: "수",
    periods: [
      { no: 1, time: "08:40~09:30", type: "common",   subjects: ["영어독해와 작문"] },
      { no: 2, time: "10:00~10:50", type: "elective", subjects: ["심화국어"] },
      { no: 3, time: "11:20~12:10", type: "elective", subjects: ["미적분"] },
    ],
  },
  {
    date: "7/2", dow: "목",
    periods: [
      { no: 1, time: "08:40~09:30", type: "elective", subjects: ["일본어2", "프로그래밍"] },
      { no: 2, time: "09:40~10:30", type: "elective", subjects: ["생명과학Ⅱ"] },
      { no: 3, time: "10:40~11:30", type: "elective", subjects: ["사회문화", "물리Ⅱ"] },
      { no: 4, time: "11:40~12:30", type: "elective", subjects: ["지구과학Ⅱ"] },
    ],
  },
];

// 과목 분류 (교육과정 기준): 일반선택 / 진로선택
const CATEGORY = {
  "화법과 작문": "일반선택",
  "영어독해와 작문": "일반선택",
  "미적분": "일반선택",
  "윤리와 사상": "일반선택",
  "한국지리": "일반선택",
  "사회문화": "일반선택",
  "경제수학": "진로선택",
  "기하": "진로선택",
  "수학과제 탐구": "진로선택",
  "심화국어": "진로선택",
  "영미 문학 읽기": "진로선택",
  "화학Ⅱ": "진로선택",
  "생명과학Ⅱ": "진로선택",
  "물리Ⅱ": "진로선택",
  "지구과학Ⅱ": "진로선택",
  "일본어2": "진로선택",
  "프로그래밍": "진로선택",
};

