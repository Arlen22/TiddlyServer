"use strict";
/**
 * Copyright (C) 2019-present, Rimeto, LLC.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// import { Defined, TSOCType } from '../../'
/**
 * Proxy based implementation of optional chaining w/ default values.
 */
function oc(data) {
    return new Proxy(((defaultValue) => (data == null ? defaultValue : data)), {
        get: (target, key) => {
            const obj = target();
            return oc(typeof obj === 'object' ? obj[key] : undefined);
        },
    });
}
exports.oc = oc;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9uYWwtY2hhaW5pbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvcHRpb25hbC1jaGFpbmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7O0FBRUgsNkNBQTZDO0FBRTdDOztHQUVHO0FBQ0gsU0FBZ0IsRUFBRSxDQUFJLElBQVE7SUFDNUIsT0FBTyxJQUFJLEtBQUssQ0FDZCxDQUFDLENBQUMsWUFBeUIsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFnQixFQUNwRjtRQUNFLEdBQUcsRUFBRSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsRUFBRTtZQUNuQixNQUFNLEdBQUcsR0FBUSxNQUFNLEVBQUUsQ0FBQztZQUMxQixPQUFPLEVBQUUsQ0FBQyxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDNUQsQ0FBQztLQUNGLENBQ0YsQ0FBQztBQUNKLENBQUM7QUFWRCxnQkFVQyJ9