import { describeAssetChecks } from './assetChecks';
import { KITCHEN_ASSETS } from './kitchen';
import { BATHROOM_ASSETS } from './bathroom';
import { LAUNDRY_ASSETS } from './laundry';
describeAssetChecks([...KITCHEN_ASSETS, ...BATHROOM_ASSETS, ...LAUNDRY_ASSETS]);
