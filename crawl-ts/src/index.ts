import 'dotenv/config';
import express from 'express';
import path from 'path';
import router from './router/Router';
import cron from "node-cron";
import { updater } from './updater/Updater';
import { slackManager } from './slack/SlackManager';
import { swaggerUi, swaggerSpec } from './swagger/swagger';
import { defaultLogger as logger } from './utils/logger';
import { MysqlRecruitInfoRepository }  from '@database/MysqlRecruitInfoRepository';
import { mysqlRecruitInfoSequelize } from '@models/MysqlRecruitInfoModel';
const mysqlRecruitInfoRepository = new MysqlRecruitInfoRepository();
const app = express();
const PORT = process.env.CRAWL_SERVER_PORT;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use('/api', router);

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


cron.schedule("0 7 * * *", async () => {
  logger.info( "[scheduler] mysql data 업데이트를 실행합니다 ...")
  const result = await mysqlRecruitInfoRepository.getAllNewRecruitInfoUrl();
  slackManager.sendSlackMessage(`[scheduler] mysql 새로 추가된 data 개수 ${ result.length }`)
  slackManager.sendSlackMessage("[scheduler] mysql data 업데이트를 실행합니다.")
  await updater.updateJobAll()
  slackManager.sendSlackMessage("[scheduler] mysql data 업데이트가 완료되었습니다.")
}, {
  timezone: "Asia/Seoul",
});