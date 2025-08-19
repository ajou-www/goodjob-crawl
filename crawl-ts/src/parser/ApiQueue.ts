import WaitQueue from 'wait-queue';
import { defaultLogger as logger } from '../utils/logger';

interface ApiItem{


    id: string,
    key:string
    
}

class ApiQueue{

    private wq= new WaitQueue<ApiItem>();
    
    async pop(){
        const result= await this.wq.shift()
        logger.info(`[ApiQueue] ${result.id} 번 api 사용`)
        return result
    }  
    
    async push(apiItem : ApiItem ){
        logger.info(`[ApiQueue] ${apiItem.id} 번 api queue 추가`)
        this.wq.push(apiItem)
    }

}


export const apiQueue =new ApiQueue()