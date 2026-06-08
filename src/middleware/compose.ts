import type { Middleware, MiddlewareContext, ChatResponse } from "../types/index.js";

/**
 * Compose an array of Middleware functions into a single Middleware-style function.
 * Inspired by koa-compose.
 */
export function compose(middlewares: Middleware[]) {
  if (!Array.isArray(middlewares)) {
    throw new TypeError("Middleware stack must be an array!");
  }
  for (const fn of middlewares) {
    if (typeof fn !== "function") {
      throw new TypeError("Middleware must be composed of functions!");
    }
  }

  return function (context: MiddlewareContext, next?: () => Promise<ChatResponse>): Promise<ChatResponse> {
    // Keep track of the last called middleware index to prevent multiple next() calls
    let index = -1;

    function dispatch(i: number): Promise<ChatResponse> {
      if (i <= index) {
        return Promise.reject(new Error("next() called multiple times"));
      }
      index = i;
      let fn = middlewares[i];
      if (i === middlewares.length) {
        fn = next as any;
      }
      if (!fn) {
        return Promise.resolve(null as any);
      }
      try {
        return Promise.resolve(fn(context, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}
