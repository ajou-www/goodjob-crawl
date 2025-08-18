
import { MysqlRecruitInfoSequelize ,MysqlFaviconSequelize } from '../models/MysqlRecruitInfoModel';
import { Op } from 'sequelize';
import { VALID_TYPE } from '../models/MysqlRecruitInfoModel';
import { GeminiParser } from '../parser/GeminiParser';
import { defaultLogger as logger } from '../utils/logger';
import { MysqlRecruitInfoRepository } from '../database/MysqlRecruitInfoRepository';
import { getSpringAuthToken } from '../utils/key';


const mysqlRecruitInfoRepository = new MysqlRecruitInfoRepository();
const parser = new GeminiParser();
class Updater{



    async updateJobEndDate() : Promise<void>{
        const rawContents = await MysqlRecruitInfoSequelize.findAll({
            attributes: ['id', 'text'],
            where: {
              job_valid_type: {
              [Op.ne]: VALID_TYPE.EXPIRED
              } // Only process active jobs
            }
        
          })
          
          for (const rawContent of rawContents) {
            try {
              const jobEndDate = await parser.findJobEndDate(rawContent.text, 2000,2000);
              if (jobEndDate) {
                logger.info(`[MysqlJobUpdaterController][findJobEndDate] ${rawContent.id}: ${jobEndDate}`);
                await MysqlRecruitInfoSequelize.update({ apply_end_date : jobEndDate}, {where: { id: rawContent.id }})
              } else {
                logger.info(`[MysqlJobUpdaterController][findJobEndDate] No job end date found for ID ${rawContent.id}`);
              }
            } catch (error) {
              logger.error(`[MysqlJobUpdaterController][findJobEndDate] Error processing ID ${rawContent.id}:`, error);
            }
          }
    }

    async  updateJobValidType(): Promise<void> {
      try {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
        // Update job_valid_type to ACTIVE for records with apply_end_date >= today
        await MysqlRecruitInfoSequelize.update(
          { job_valid_type: VALID_TYPE.ACTIVE },
          {
            where: {
              [Op.or]: [
                { apply_end_date: { [Op.gte]: startOfToday } } ,
                { apply_end_date: null }
              ]
            }
          }
        );

        logger.info('[MysqlJobUpdaterController][updateJobValidType] Updated job_valid_type to ACTIVE for records with apply_end_date >= today');
    
        // Update job_valid_type to EXPIRED for records with apply_end_date < today
        await MysqlRecruitInfoSequelize.update(
          { job_valid_type: VALID_TYPE.EXPIRED },
          { where: { apply_end_date: { [Op.lt]: startOfToday } } }
        );
        logger.info('[MysqlJobUpdaterController][updateJobValidType] Updated job_valid_type to EXPIRED for records with apply_end_date < today');
    
        logger.info('[MysqlJobUpdaterController][findJobEndDate] Job valid types updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          logger.error(`[MysqlJobUpdaterController][updateJobValidType] Error updating valid type by date: ${error.message}`);
        }
      }
}

async  updateJobPublicType(): Promise<void> {
  try {
    const token = await getSpringAuthToken();
    // Update is_public to true for all records with job_valid_type ACTIVE
    await MysqlRecruitInfoSequelize.findAll({
      'attributes': ['id', 'url'],
      where: {
        [Op.and]: [
          { job_valid_type: VALID_TYPE.EXPIRED },
          { is_public: true }
        ]
      },raw: true
    })
         .then(async (datas) => {
           const deleteCount = datas.length;
           logger.debug(`[MysqlJobUpdaterController][updateJobPublicType] 삭제할 URL 갯수: ${deleteCount}`);
           for (const data of datas) {
              await mysqlRecruitInfoRepository.deleteRecruitInfoByIdValidType(data.id,VALID_TYPE.EXPIRED, token)
                 .catch((error) => {
                   logger.debug(`[MysqlJobUpdaterController][updateJobPublicType] 삭제 실패: ${data.id} - ${data.url}`, error);
                   return false;
                 })
           }
           logger.debug(`삭제한 URL 갯수: ${datas.length}`);
         }
         )
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[MysqlJobUpdaterController][updateJobPublicType] Error updating public type by valid type: ${error.message}`);
    }
  }
}


async  updateJobFavicon(): Promise<void> {
  try {
    const favicon_ids = await MysqlFaviconSequelize.findAll({
      attributes: ['id', 'domain', 'logo'],
      raw: true,
    });


    for (const favicon of favicon_ids) {
      await MysqlRecruitInfoSequelize.update({ favicon_id: favicon.id }, {
        where: {
          url: {
            [Op.like]: `%${favicon.domain}%`
          }
        }
      })
      logger.debug('[MysqlJobUpdaterController][updateJobFavicon] Favicon ID updated successfully:', favicon.id);
    }

    logger.info('[MysqlJobUpdaterController][getFavicon] Job favicons updated successfully.');
  } catch (error) {
    logger.error('[MysqlJobUpdaterController][getFavicon] Error updating job favicons:', error);
  }
}

async  updateJobVector(): Promise<void> {
  try {
    await mysqlRecruitInfoRepository.vectorizeJob();
    logger.info('[MysqlJobUpdaterController][vectorizeJob] Job vectorization completed successfully');
  }
  catch (error) {
    if (error instanceof Error) {
      logger.error(`[MysqlJobUpdaterController][vectorizeJob] Error vectorizing jobs: ${error.message}`);
    }
  }
}

async updateJobAll(): Promise<void>{


    await this.updateJobEndDate()
    .then(()=>this.updateJobValidType())
    .then(()=>this.updateJobPublicType())
    .then(()=>this.updateJobFavicon())
    .then(()=>this.updateJobVector())
}

}

export const updater= new  Updater();