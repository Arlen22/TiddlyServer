import { EventEmitter as NodeEventer } from "events";
import { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";
export type EventMap = { [K in string]: readonly any[] };
export type Listener<T extends EventMap> = <K extends keyof T>(event: K, listener: (...args: T[K]) => void) => EventEmitter<T>;
export type RequiredKey<T extends EventMap, RET> = <K extends keyof T>(event: K) => RET;
export type OptionalKey<T extends EventMap, RET> = <K extends keyof T>(event: K) => RET;
export type Emit<T extends EventMap> = <K extends keyof T>(event: K, ...args: T[K]) => boolean;
export interface EventEmitter<T extends EventMap> {
  addListener: Listener<T>
  on: Listener<T>
  once: Listener<T>
  prependListener: Listener<T>
  prependOnceListener: Listener<T>
  removeListener: Listener<T>
  removeAllListeners: OptionalKey<T, this>;
  setMaxListeners(n: number): this;
  getMaxListeners(): number;
  listeners: OptionalKey<T, Function[]>;
  eventNames(): Array<keyof T>;
  listenerCount: RequiredKey<T, number>;
  emit: Emit<EventMap>;
}
export const EventEmitter = NodeEventer as { new <T extends EventMap>(): EventEmitter<T> };


