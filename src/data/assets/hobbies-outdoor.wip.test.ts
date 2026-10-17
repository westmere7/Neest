import { describeAssetChecks } from './assetChecks';
import { HOBBIES_ASSETS } from './hobbies';
import { OUTDOOR_ASSETS } from './outdoor';
describeAssetChecks([...HOBBIES_ASSETS, ...OUTDOOR_ASSETS]);
