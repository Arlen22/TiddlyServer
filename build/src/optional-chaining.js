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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3B0aW9uYWwtY2hhaW5pbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvb3B0aW9uYWwtY2hhaW5pbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7OztHQUtHOztBQUVILDZDQUE2QztBQUU3Qzs7R0FFRztBQUNILFNBQWdCLEVBQUUsQ0FBSSxJQUFRO0lBQzVCLE9BQU8sSUFBSSxLQUFLLENBQ2QsQ0FBQyxDQUFDLFlBQXlCLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBZ0IsRUFDcEY7UUFDRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUU7WUFDbkIsTUFBTSxHQUFHLEdBQVEsTUFBTSxFQUFFLENBQUM7WUFDMUIsT0FBTyxFQUFFLENBQUMsT0FBTyxHQUFHLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzVELENBQUM7S0FDRixDQUNGLENBQUM7QUFDSixDQUFDO0FBVkQsZ0JBVUMifQ==