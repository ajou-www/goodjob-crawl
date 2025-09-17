import { GeminiParser } from "../../src/parser/GeminiParser";
import * as fs from 'fs';
import * as path from 'path';
const parser =new GeminiParser()

interface testData {
    
    text : string,
    job_end_date : string
}

describe("GeminiParser.parseDateFromText with expired_jobs.json", () => {
  // JSON 파일을 읽어옵니다. 경로를 올바르게 수정해주세요.
  const jsonPath = path.resolve(__dirname, './resources/expired_jobs.json');
  const jobs: Array<testData> = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  let successCount = 0;
  const totalJobs = jobs.length;
  const wrongJobs : Array<testData>  = []; // 실패한 공고를 저장할 배열

  // 각 공고에 대해 테스트를 실행합니다.
  jobs.forEach((job, index) => {
    // job 객체에 'text' 필드가 있는지 확인합니다.
    if (job && typeof job.text === 'string') {
      const textToParse = job.text;
      const result = parser.parseDateFromText5(textToParse);

      if (result) {
        successCount++;
        console.log(`[성공] 공고 ${index + 1}: ${result instanceof Date ? result.toISOString() : result}`);
      } else {
        console.log(`[실패] 공고 ${index + 1}: 마감일을 찾지 못했습니다.`);
        // 실패한 경우, 원본 공고 객체를 wrongJobs 배열에 추가합니다.
        wrongJobs.push(job);
      }
    } else {
        console.log(`[경고] 공고 ${index + 1}: 'text' 필드가 없거나 형식이 올바르지 않습니다.`);
        wrongJobs.push(job); // text 필드가 없는 경우도 실패로 간주하고 추가
    }
  });

  // 테스트가 끝난 후, 실패한 공고들을 파일로 저장합니다.
  if (wrongJobs.length > 0) {
    const wrongJsonPath = path.resolve(__dirname, './resources/wrong_expired.json');
    // JSON.stringify의 세 번째 인자로 2를 주어 가독성 좋게 포맷팅합니다.
    fs.writeFileSync(wrongJsonPath, JSON.stringify(wrongJobs, null, 2));
    console.log(`\n'${wrongJobs.length}'개의 실패한 공고를 'wrong_expired.json' 파일로 저장했습니다.`);
  }

  // 최종 정확도를 출력하는 테스트
  it("최종 정확도를 계산하고 출력한다", () => {
    const accuracy = (successCount / totalJobs) * 100;
    console.log(`\n========================================`);
    console.log(`  총 ${totalJobs}개의 공고 중 ${successCount}개 성공`);
    console.log(`  정확도: ${accuracy.toFixed(2)}%`);
    console.log(`========================================`);

    // expect(accuracy).toBeGreaterThanOrEqual(80);
  });
});
