import { describeAssetChecks } from './assetChecks';
import { BEDROOM_ASSETS } from './bedroom';
import { KIDS_ASSETS } from './kids';
describeAssetChecks([...BEDROOM_ASSETS, ...KIDS_ASSETS]);
