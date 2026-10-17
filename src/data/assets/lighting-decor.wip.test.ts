import { describeAssetChecks } from './assetChecks';
import { LIGHTING_ASSETS } from './lighting';
import { DECOR_ASSETS } from './decor';
describeAssetChecks([...LIGHTING_ASSETS, ...DECOR_ASSETS]);
