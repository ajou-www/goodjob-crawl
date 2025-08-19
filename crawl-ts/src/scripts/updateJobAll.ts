import 'dotenv/config'
import { updater } from "../updater/Updater";

(async () => {
  await updater.updateJobAll();
})();