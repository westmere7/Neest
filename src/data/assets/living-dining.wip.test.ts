import { describeAssetChecks } from './assetChecks';
import { LIVING_ASSETS } from './living';
import { DINING_ASSETS } from './dining';
describeAssetChecks([...LIVING_ASSETS, ...DINING_ASSETS]);
