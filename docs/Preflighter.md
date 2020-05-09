---
id: preflighter
title: Preflighter
---

The preflighter gives you the ability to do whatever you want with a request before TiddlyServer takes it. The preflighter is a function which accepts a RequestEvent object, and returns a promise which resolves to a RequestEvent object. The preflighter may also return a promise resolving to `{ handled: true }`. This is enough to cancel further processing for that request. 

The object will always be either a RequestEventHTTP or RequestEventWS object for HTTP and WebSockets, respectively. 