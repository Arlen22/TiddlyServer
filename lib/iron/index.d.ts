

export function seal(obj: any, password: string, options: Options, cb: (err: any, sealed: string) => void);
export function unseal<T>(sealed: string, password: string, options: Options, cb: (err: any, unsealed: T) => void);
export const defaults: {
    encryption: {
        saltBits: 256,
        algorithm: 'aes-256-cbc',
        iterations: 1,
        minPasswordlength: 32
    },

    integrity: {
        saltBits: 256,
        algorithm: 'sha256',
        iterations: 1,
        minPasswordlength: 32
    },

    ttl: 0,                                             // Milliseconds, 0 means forever
    timestampSkewSec: 60,                               // Seconds of permitted clock skew for incoming expirations
    localtimeOffsetMsec: 0                              // Local clock time offset express in a number of milliseconds (positive or negative)
};
export interface Options {
    encryption: {
        saltBits: number,
        algorithm: 'aes-256-cbc',
        iterations: number
    },

    integrity: {
        saltBits: number,
        algorithm: 'sha256',
        iterations: number
    },

    ttl: number,                                             // Milliseconds, 0 means forever
    timestampSkewSec: number,                               // Seconds of permitted clock skew for incoming expirations
    localtimeOffsetMsec: number
}