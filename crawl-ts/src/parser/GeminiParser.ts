import 'dotenv/config'
import {GoogleGenerativeAI} from '@google/generative-ai';
import { GeminiResponseRecruitInfoDTO, CreateDBRecruitInfoDTO } from '../models/RecruitInfoModel';
import { geminiRecruitInfoPrompt, geminiRegionTextPrompt, geminiJobEndDatePrompt} from './prompt';
import { geminiRecruitInfoSechma, geminiRegionCdScema ,geminiJobEndDateSchema} from './Schema';
import { IRawContent } from '../models/RawContentModel';
import { defaultLogger as logger } from '../utils/logger';
import { cd2RegionId, OTHER_REGION_ID, regionText2RegionIds } from '../trasnform/Transform';
import { apiQueue } from './ApiQueue';
import { timeoutAfter } from '@browser/ChromeBrowserManager';


const JSON_MIME_TYPE = 'application/json';


const DATE_PATTERNS: RegExp[] = [
  /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/,              // 2025-09-10, 2025/09/10
  /\b(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/,              // 25-09-10
  /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,                // 2025년 9월 10일
  /(\d{1,2})월\s*(\d{1,2})일/                             // 9월 10일
];

export class ParseError extends Error {
  public cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ParseError';
    this.cause = cause;
    // Stack trace 유지 (V8 기반 환경에서만 동작)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ParseError);
    }
  }
}

/**
 * GeminiParser - Google의 Gemini API를 사용하는 파서
 */
export class GeminiParser {
  private apiKeys: string[] = [];
  private readonly modelName: string;

  constructor() {
    // 기본 설정
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
    this.apiKeys = process.env.GEMINI_API_KEYS?.split(',') ?? [];
    if (this.apiKeys.some((value) => value.length !== 39)) {
      throw new Error("Gemini API KEY가 잘못되었습니다. 존재하지 않습니다. ");
    }

    this.apiKeys.forEach((value,index)=>{
      apiQueue.push({
          id: index.toString(),
          key: value
      })
    })


  }

  parseDateFromText2(text :string ) {
    const regex = /~(\s*\d{4}[년\.]\s?\d{1,2}[월\.]\s?\d{1,2}일?(\([가-힣]\))?(\s\d{2}:\d{2})?)|(채용시 마감)|마감일\s*(\d{4}.\d{2}.\d{2})/;
    const match = text.match(regex);

    if (match) {
      // 정규식에 매칭되는 부분을 찾으면, 해당 텍스트를 반환합니다.
      // "채용시 마감" 또는 "~ 2025.03.30 23:59" 와 같은 문자열이 됩니다.
      // 좀 더 정교하게 만들려면 이 부분에서 Date 객체로 변환하는 로직을 추가할 수 있습니다.
      const foundDate = match[0].replace(/~|마감일/g, '').trim(); // "마감일" 이나 "~" 같은 불필요한 문자를 제거합니다.
      try {
        // new Date()로 변환을 시도합니다. '채용시 마감' 등은 Invalid Date가 됩니다.
        const d = new Date(foundDate.replace(/[년월]/g, '-').replace(/일/g, ''));
        if(!isNaN(d.getTime())) return d; // 유효한 Date 객체이면 반환
        return foundDate; // Date 객체로 변환이 안되면, 찾은 문자열 그대로 반환
      } catch (e) {
        return foundDate; // 파싱 에러가 나면 찾은 문자열 반환
      }
    }

    return undefined; // 날짜를 찾지 못하면 undefined를 반환합니다.
  }

   parseDateFromText3(text : string ) {
    // 새로운 형식을 포함하도록 업데이트된 정규식
    const regex = /~(\s*(?:\d{4}[년\.]\s?\d{1,2}[월\.]\s?\d{1,2}일?(\([가-힣]\))?(\s\d{2}:\d{2})?|\d{1,2}\/\d{1,2}\([가-힣]\)|[A-Za-z]{3,}\s\d{1,2},\s\d{4}\([A-Za-z]{3}\)))|(채용시 마감)|마감일\s*(\d{4}.\d{2}.\d{2})/;
    const match = text.match(regex);

    if (match) {
      // 정규식에 매칭된 전체 문자열을 가져와 정리합니다.
      let dateString = match[0].replace(/~|마감일/g, '').trim();

      // "채용시 마감"은 그대로 반환합니다.
      if (dateString === '채용시 마감') {
        return dateString;
      }

      // new Date()가 파싱할 수 있도록 문자열을 가공합니다.
      // 1. (월), (Fri) 와 같은 괄호 안의 요일 정보를 제거합니다.
      dateString = dateString.replace(/\s*\([가-힣A-Za-z]+\)/, '');
      // 2. '년', '월'을 '-'로 바꾸고 '일'을 제거합니다. (예: "2025년 03월 24일" -> "2025-03-24")
      dateString = dateString.replace(/[년월]/g, '-').replace(/일/, '');

      try {
        // 가공된 문자열로 Date 객체 생성을 시도합니다.
        const d = new Date(dateString);
        // 생성된 Date 객체가 유효한지 확인합니다.
        if (!isNaN(d.getTime())) {
          return d; // 유효한 Date 객체이면 반환
        }
      } catch (e) {
        // Date 객체 생성 중 에러가 발생하면 아래에서 정리된 문자열을 반환합니다.
      }
      
      // Date 객체로 변환에 실패하면, 정리된 문자열이라도 반환합니다.
      return dateString.trim();
    }

    return undefined; // 아무것도 찾지 못하면 undefined를 반환합니다.
  }

   parseDateFromText(rawText: string): Date | undefined {
    let year,month,day
    for (const pattern of DATE_PATTERNS) {
      const match = rawText.match(pattern);
      if (match) {
        try {
          if (match[1].length === 4) {
            // 연도까지 있는 경우
            year = parseInt(match[1], 10);
            month= parseInt(match[2], 10);
            day = parseInt(match[3], 10);
          } else if (match[1].length === 2) {
            // YY-MM-DD → 20YY로 보정
            year = 2000 + parseInt(match[1], 10);
            month = parseInt(match[2], 10);
            day = parseInt(match[3], 10);
          } else {
            // "9월 10일" → 올해 기준
            const now = new Date();
            year = now.getFullYear();
            month = parseInt(match[1], 10);
            day = parseInt(match[2], 10);
          }
        } catch (e) {
          logger.error(`[GeminiParser][parseDateFromText] 날짜 파싱 실패: ${e}`);
        }
      }

      if(year != undefined  && month != undefined &&  day != undefined){
      const stringDatetime =year.toString()+"-"+month.toString().padStart(2, "0")+"-"+day.toString().toString().padStart(2, "0")
      console.log(stringDatetime)
      const datetime = new Date(stringDatetime)
      if( !isNaN(datetime.getTime())){
        return datetime
      }
    }
    }
  
  }
   parseDateFromText4(text :string) {
    // [업데이트된 정규식]
    // "지원마감", "마감기한", 날짜 범위(-) 등 새로운 패턴 추가
    const regex = /(?:~|지원마감|마감기한|-)\s*([0-9]{4}[년\.]\s?[0-9]{1,2}[월\.]\s?[0-9]{1,2}일?|[A-Za-z]{3,}\s[0-9]{1,2},\s[0-9]{4}|[0-9]{1,2}\/[0-9]{1,2})(?:\([가-힣A-Za-z]+\))?|채용시 마감/g;

    const matches = text.match(regex);

    if (!matches) {
      return undefined;
    }

    // 찾은 결과 중 가장 마지막 부분을 마감일로 간주 (예: "시작일 ~ 종료일"에서 종료일을 선택)
    const lastMatch = matches[matches.length - 1];

    if (lastMatch.includes('채용시 마감')) {
      return '채용시 마감';
    }

    // 마감일과 관련된 키워드 및 기호를 제거하여 날짜 부분만 추출
    let dateString = lastMatch.replace(/~|지원마감|마감기한|-/g, '').trim();

    // new Date()가 파싱할 수 있는 표준 형식으로 문자열을 가공
    // 1. (월), (Fri) 와 같은 괄호 안의 요일 정보 제거
    dateString = dateString.replace(/\s*\([가-힣A-Za-z]+\)/, '');
    // 2. 'YYYY년 MM월 DD일' 또는 'YYYY.MM.DD' 형식을 'YYYY-MM-DD'로 변경
    dateString = dateString.replace(/[년월]/g, '-').replace(/일/g, '').replace(/\./g, '-');
    // 3. 마지막에 붙은 '-' 제거 (예: "2025-05-28-")
    if (dateString.endsWith('-')) {
        dateString = dateString.slice(0, -1);
    }
    // 4. 'MM/DD' 형식을 'YYYY-MM-DD'로 변경 (올해 연도 사용)
    if (/^\d{1,2}\/\d{1,2}$/.test(dateString)) {
        dateString = `${new Date().getFullYear()}-${dateString.replace('/', '-')}`;
    }

    try {
      const d = new Date(dateString);
      if (!isNaN(d.getTime())) {
        return d; // 유효한 Date 객체이면 반환
      }
    } catch (e) {
      // Date 객체 생성 실패 시 아래에서 정리된 문자열 반환
    }

    return dateString.trim(); // 최종적으로 파싱이 안되면 정리된 문자열이라도 반환
  }
  async testApiKeys(): Promise<void>{
    const tasks = this.apiKeys.map(async (key)=>{
      const model = new GoogleGenerativeAI(key).getGenerativeModel({model: this.modelName})
      console.log("Test Key Result:  ")
      const result =await model.generateContent("Hello, gemini")
      console.log(result.response.text())
    })
    await Promise.all(tasks);
  }
  

  async findJobEndDate(rawText: string, retryNumber: number, retryDelay: number = 1000): Promise<Date | undefined> {
    for (let attempt = 1; attempt <= retryNumber; attempt++) {
      
      const apiItem = await apiQueue.pop();
      
      try {
        const model = new GoogleGenerativeAI(apiItem.key).getGenerativeModel({
          model: this.modelName,
          generationConfig: {
            responseMimeType: JSON_MIME_TYPE,
            responseSchema: geminiJobEndDateSchema
          },
        });
        logger.info('[GeminiParser][findJobEndDate] Gemini API 요청 시작...');
        const result = await model.generateContent(geminiJobEndDatePrompt(rawText));
        if (!result) {
          throw new ParseError('Gemini API에서 빈 응답을 받았습니다.');
        }
        const responseText = await result.response?.text();
        logger.info(`[GeminiParser][findJobEndDate] Gemini API 응답: ${responseText}`);
        const data = JSON.parse(responseText) as { job_end_date: string }; // JSON 파싱

        let jobEndDate;
        if (data.job_end_date) {
          
          let jobEndDate = this.parseDateOrNull(data.job_end_date);
          if (!jobEndDate) {
            logger.error(`[GeminiParser][findJobEndDate] 유효하지 않은 날짜 형식입니다: ${data.job_end_date}`);
            throw new ParseError(`유효하지 않은 날짜 형식입니다: ${data.job_end_date}`);
          }

        }
        apiQueue.push(apiItem);
        return jobEndDate;

      } catch (error) {
        // await new Promise((resolve) => setTimeout(resolve, retryDelay)); // 1초 대기
        logger.error(`[GeminiParser][findJobEndDate] ${ error as Error} `)
        logger.error(`[GeminiParser][findJobEndDate] 재시도 횟수 ${attempt}/${retryNumber} 증 에러 발생`);
        if (retryNumber === attempt) {
          throw new ParseError("Failed to validate recruitment info ", error);
        }
        setTimeout(()=>{
          apiQueue.push(apiItem)
        },10000)
      }
    }
  }

parseDateFromText5(text :string) {
    // [업데이트된 정규식]
    // '마감일' 키워드와 다양한 날짜 형식을 포괄하도록 개선
    const regex = /(?:마감일|지원마감|마감기한|~|-)\s*(\d{4}[-.\s년]+\d{1,2}[-.\s월]+\d{1,2}일?|[A-Za-z]{3,}\s\d{1,2},\s\d{4}|\d{1,2}\/\d{1,2})(?:\s*\([가-힣A-Za-z]+\))?|채용시 마감/gi;

    const matches = text.match(regex);

    if (!matches) {
      return undefined;
    }

    // 찾은 날짜/키워드 중 가장 마지막 부분을 마감일로 간주
    // 예: "시작일 ~ 종료일"에서 "종료일" 부분을 선택
    const lastMatch = matches[matches.length - 1];

    if (lastMatch.toLowerCase().includes('채용시 마감')) {
      return '채용시 마감';
    }

    // 마감일과 관련된 키워드('마감일', '~' 등)를 모두 제거하여 순수 날짜 문자열만 추출
    let dateString = lastMatch.replace(/마감일|지원마감|마감기한|~|-/gi, '').trim();

    // new Date()가 파싱할 수 있는 표준 형식(YYYY-MM-DD)으로 문자열을 가공
    // 1. (월), (Fri) 와 같은 괄호 안의 요일 정보 제거
    dateString = dateString.replace(/\s*\([가-힣A-Za-z]+\)/, '');
    // 2. 'YYYY년 MM월 DD일', 'YYYY.MM.DD' 등을 'YYYY-MM-DD'로 변경
    dateString = dateString.replace(/[년월]/g, '-').replace(/일/g, '').replace(/\./g, '-');
    // 3. 마지막에 붙은 '-' 제거 (예: "2025-05-28-")
    if (dateString.endsWith('-')) {
        dateString = dateString.slice(0, -1);
    }
    // 4. 'MM/DD' 형식을 'YYYY-MM-DD'로 변경 (올해 연도 기준)
    if (/^\d{1,2}\/\d{1,2}$/.test(dateString)) {
        dateString = `${new Date().getFullYear()}-${dateString.replace('/', '-')}`;
    }

    try {
      const d = new Date(dateString);
      // 유효하지 않은 날짜(예: 2025-99-99)인지 확인
      if (!isNaN(d.getTime())) {
        return d; // 유효한 Date 객체이면 반환
      }
    } catch (e) {
      // Date 객체 생성 실패 시 아래에서 정리된 문자열 반환
    }

    return undefined; // 최종적으로 파싱이 안되면 정리된 문자열이라도 반환
  }

  async ParseRegionText(rawContent: string, retryNumber: number ,retryDelay: number=1000): Promise<string[]|undefined> {
    for (let attempt = 1; attempt <= retryNumber; attempt++) {
      try {
        const apiItem = await apiQueue.pop();
        const model = new GoogleGenerativeAI(apiItem.key).getGenerativeModel({
          model: this.modelName,
          generationConfig: {
            responseMimeType: JSON_MIME_TYPE,
            responseSchema: geminiRegionCdScema,
          },
        });
        // API 호출로 채용 정보 파싱
        logger.debug('Gemini API 요청 시작...');
        const result = await model.generateContent(geminiRegionTextPrompt(rawContent))
          .then((result) => result.response?.text()
          )
          .catch(
            (error) => {
              logger.error(`Gemini API에서 텍스트 응답을 받지 못했습니다.${attempt}/${retryNumber}`);
               if (retryNumber === attempt) {
                 throw error;
                }
            }
          )
          .then((responseText) => {
            if (!responseText) {
              logger.error(`Gemini API에서 빈 응답을 받았습니다.${attempt}/${retryNumber}`);
              throw new ParseError('Gemini API에서 빈 응답을 받았습니다.');
            }
            logger.debug(responseText);
            const RegionResult = JSON.parse(responseText)
            return RegionResult.regionCdList;
          })
          .catch(
            (error) => {
              logger.error(`텍스트 응답에에서 json 파싱을을 실패했습니다. ${attempt}/${retryNumber}`);
               if (retryNumber === attempt) {
                 throw error;
                }
            }
        )
        if (result) {
          return result
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay)); // 1초 대기
      } catch (error) {
        logger.error(`재시도 횟수 ${attempt}/${retryNumber} 증 에러 발생`);
        if (retryNumber === attempt) {
          throw new ParseError("Failed to parse recruitment info ", error);
        }
      }
    }
    }


  parseDateOrNull(dateStr: any): Date | undefined {
    try {
      const parsed = new Date(dateStr);
      if (parsed < new Date('2000-01-01') || parsed > new Date('2100-12-31')) {
        return undefined;
      }
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }catch (error) {
      logger.error(`날짜 파싱 중 오류 발생: ${error}`);
      return undefined;
    }

  }
  /**x
  * 원본 콘텐츠 파싱
  * @param rawContent 원본 콘텐츠
  */
  async parseRecruitInfo(rawContent: IRawContent, retryNumber: number, retryDelay: number = 1000): Promise<GeminiResponseRecruitInfoDTO | undefined> {

    for (let attempt = 1; attempt <= retryNumber; attempt++) {
      const apiItem = await apiQueue.pop();
      apiQueue.push(apiItem);
      try {

          // logger.debug(rawContent.text);
        const model = new GoogleGenerativeAI(apiItem.key).getGenerativeModel({
          model: this.modelName,
          generationConfig: {
            responseMimeType: JSON_MIME_TYPE,
            responseSchema: geminiRecruitInfoSechma,
          },
        });
        // API 호출로 채용 정보 파싱
        logger.info('[GeminiParser][parseRecruitInfo] Gemini API 요청 시작...');
        const result =await timeoutAfter(model.generateContent(geminiRecruitInfoPrompt(rawContent.text)),20_000, Error("Gemini에게 응답을 받는데 실패했습니다.") )
          .then((result) =>  {
            console.log(result.response?.text())
            return result.response?.text()
            })
          .catch(
            (error) => {
              logger.error(`[GeminiParser][parseRecruitInfo] Gemini API에서 텍스트 응답을 받지 못했습니다.${attempt}/${retryNumber}`);
               if (retryNumber === attempt) {
                throw error;
              }
            }
          )
          .then((responseText) => {
            if (!responseText) {

              logger.error(`[GeminiParser][parseRecruitInfo] Gemini API에서 빈 응답을 받았습니다.${attempt}/${retryNumber}`);
              throw new ParseError('Gemini API에서 빈 응답을 받았습니다.');
            }
            logger.debug(`[GeminiParser][parseRecruitInfo] Gemini API 응답: ${responseText}`);

            const data = this.postProcessRecruitInfo(JSON.parse(responseText) as GeminiResponseRecruitInfoDTO ,rawContent)
            
            return data
          })
          .catch(
            (error) => {
              logger.error(`텍스트 응답에에서 json 파싱을을 실패했습니다. ${attempt}/${retryNumber}`);
              if (retryNumber === attempt) {
                throw error;
              }
            }
        )
        if (result) {
          return result
        }
      } catch (error) {
        
        logger.error(`재시도 횟수 ${attempt}/${retryNumber} 증 에러 발생`);
        if (retryNumber === attempt) {
          throw new ParseError("Failed to parse recruitment info ", error);
        }
      }
    }
  }


    postProcessRecruitInfo( data :GeminiResponseRecruitInfoDTO,rawContent :IRawContent){
          
            data.apply_end_date = this.parseDateOrNull(data.apply_end_date);
            data.apply_start_date = this.parseDateOrNull(data.apply_start_date);
            if (!data.job_type) { data.job_type = "무관" }
            if (!data.require_experience) { data.require_experience = "경력무관" }
            if (!data.title) { data.title = rawContent.title }
            if (!data.region_id) { data.region_id = [] }
            if (rawContent.text && data.region_id) {
              data.region_id = data.region_id.map((regionCd) => cd2RegionId(regionCd)).filter((regionId) => regionId !== undefined);
            }
            if (data.region_text) {
              data.region_id.concat(regionText2RegionIds(data.region_text || ''));
            }
            if (data.region_id.length === 0) {
              data.region_id =[OTHER_REGION_ID]
            }
            return data
   }




  verifyRecruitInfo( response :GeminiResponseRecruitInfoDTO): boolean {

    if (response.is_recruit_info === false) {
      logger.debug("[GeminiParser][verifyRecruitInfo] 채용공고가 아닙니다.");
      return false;
    }
    if (!response.title) {
      logger.debug("[GeminiParser][verifyRecruitInfo] 제목이 없습니다.");
      return false;
    }
    if (!response.company_name) {
      logger.debug("[GeminiParser][verifyRecruitInfo]회사명이 없습니다.");
      return false;
    }
    if (!response.job_description) {
      logger.debug("[GeminiParser][verifyRecruitInfo] 직무 설명이 없습니다.");
      return false;
    }

    logger.debug("[GeminiParser][verifyRecruitInfo] 채용공고 입니다.");
    return true;
  }
  /**
   * DB 저장용 모델로 변환
   * @param botRecruitInfo 봇 파싱 결과
   * @param rawContent 원본 콘텐츠
   */
  makeDbRecruitInfo(botRecruitInfo: GeminiResponseRecruitInfoDTO, rawContent: IRawContent , favicon : string | null ): CreateDBRecruitInfoDTO {
    const now = new Date();
    return {
      ...rawContent,
      ...botRecruitInfo,
      job_valid_type: 0,
      favicon: favicon?? undefined,
      created_at: now,
      updated_at: now,
      is_public: true, // 채용 정보인 경우에만 공개
    };
  }
}




