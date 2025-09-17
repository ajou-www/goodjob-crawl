import { defaultLogger as logger } from '../utils/logger';
import { Consumer } from '../message/Consumer';
import { QueueNames } from '../message/enums';
import { IRawContent } from '../models/RawContentModel';
import { GeminiParser,ParseError } from '../parser/GeminiParser';
import { redisUrlManager,RedisUrlManager } from '../url/RedisUrlManager';
import { RecruitInfoRepository } from '../database/RecruitInfoRepository';
import { InMemoryConsumer } from '@message/InMemoryConsumer';
import { timeoutAfter } from '@browser/ChromeBrowserManager';


export class JobPipeLine  {
  private parser: GeminiParser;
  private consumer: InMemoryConsumer;
  private urlManager: RedisUrlManager;
  private recruitInfoRepository: RecruitInfoRepository;
  private running: boolean = false;
  constructor() {
    this.parser = new GeminiParser();
    this.consumer = new InMemoryConsumer(QueueNames.VISIT_RESULTS);
    this.urlManager = redisUrlManager;
    this.recruitInfoRepository = new RecruitInfoRepository();
    this.running = false;
  }

  async run(): Promise<void> {
    try {
      
      await this.consumer.run();
      await this.urlManager.connect();
      logger.info('JobPipeLine 연결 성공');
      this.running = true;
      await this.consumer.handleLiveMessage(
          async (msg) => {
              if (msg) {
                const rawContent : IRawContent = msg
              // verify
                const parseContent = await timeoutAfter(this.parser.parseRecruitInfo(rawContent, 10, 2000), 300_000, Error("Gemini에게 요청을 받는데 시간을 초과했습니다."))
                if(parseContent?.is_recruit_info && this.parser.verifyRecruitInfo(parseContent)){
                const recruitInfo =this.parser.makeDbRecruitInfo(parseContent,rawContent,null)
                await this.recruitInfoRepository.createRecruitInfo(recruitInfo)
              }
            }
          }
        ,1000);
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`JobPipeLine 처리 중 ${error.message}`);
      }
      throw error
    }
  }

  async stop(): Promise<void> {
    await this.consumer.stop()
    this.running =false
    console.log('JobPipeLine 중지 중...');
  }

  getStatus(): boolean {
    return this.running;
  }



}