import { defaultLogger  as logger } from '../utils/logger';
import { GeminiParser } from "./GeminiParser";

const gemini = new GeminiParser()

gemini.testApiKeys().then(
   ()=> logger.info("Test End")
)