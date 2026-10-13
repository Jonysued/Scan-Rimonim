import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measuredMean} from '../src/lib/capture/metrics.js';
test('unmeasured fruit never becomes zero calibre',()=>{assert.equal(measuredMean([null,undefined,NaN,0,-1]),null);assert.equal(measuredMean([null,80,90,undefined]),85);});
