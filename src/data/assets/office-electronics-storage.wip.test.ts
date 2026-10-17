import { describeAssetChecks } from './assetChecks';
import { OFFICE_ASSETS } from './office';
import { ELECTRONICS_ASSETS } from './electronics';
import { STORAGE_ASSETS } from './storage';
describeAssetChecks([...OFFICE_ASSETS, ...ELECTRONICS_ASSETS, ...STORAGE_ASSETS]);
