import 'dotenv/config'
import { promises as fs } from "fs";
import * as path from "path";
import { GeminiParser } from "../../src/parser/GeminiParser";
import { MysqlRecruitInfoSequelize, VALID_TYPE } from "../../src/models/MysqlRecruitInfoModel";

async function saveExpiredRecruitInfo() {
  const testDate = await MysqlRecruitInfoSequelize.findAll({
    attributes: ["text", "apply_end_date"],
    where: {
      job_valid_type: VALID_TYPE.EXPIRED,
    },
    raw: true, // JSON 형태로 반환
  });

  // 실행 중인 코드의 폴더 기준으로 resources 디렉토리 지정
  const resourcesDir = path.join(__dirname, "resources");

  // 폴더 없으면 생성
  await fs.mkdir(resourcesDir, { recursive: true });

  // 파일 경로
  const filePath = path.join(resourcesDir, "expired_jobs.json");

  // JSON 문자열 변환 (가독성을 위해 2칸 들여쓰기)
  await fs.writeFile(filePath, JSON.stringify(testDate, null, 2), "utf-8");

  console.log(`[saveExpiredRecruitInfo] 저장 완료: ${filePath}`);
}

saveExpiredRecruitInfo()
