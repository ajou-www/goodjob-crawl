import { GeminiParser } from "../../src/parser/GeminiParser";

const parser =new GeminiParser()

describe("GeminiParser.parseDateFromText", () => {

  it("YYYY-MM-DD 형식을 올바르게 파싱한다", () => {
    const text = "지원 마감일은 2025-09-30 입니다.";
    const result = parser.parseDateFromText(text);
    expect(result).toEqual(new Date("2025-09-30")); // month는 0-indexed
  });

  it("YYYY/MM/DD 형식을 올바르게 파싱한다", () => {
    const text = "모집 종료일: 2025/12/15 까지";
    const result = parser.parseDateFromText(text);
    expect(result).toEqual(new Date("2025-12-15"));
  });

  it("YYYY.MM.DD 형식을 올바르게 파싱한다", () => {
    const text = "채용 마감: 2025.01.05";
    const result = parser.parseDateFromText(text);
    expect(result).toEqual(new Date("2025-01-05"));
  });

  it("날짜가 없으면 undefined를 반환한다", () => {
    const text = "마감일이 정해지지 않았습니다.";
    const result = parser.parseDateFromText(text);
    expect(result).toBeUndefined();
  });

  it("잘못된 날짜 형식은 undefined를 반환한다", () => {
    const text = "마감일: 2025-99-99";
    const result = parser.parseDateFromText(text);
    expect(result).toBeUndefined();
  });

});
