import { StateObject } from "../state-object";

export const handleAssetsRoute = (state: StateObject) => {
  switch (state.path[2]) {
    case "static":
      serveFolder(state, "/assets/static", path.join(state.settings.__assetsDir, "static"));
      break;
    case "icons":
      serveFolder(state, "/assets/icons", path.join(state.settings.__assetsDir, "icons"));
      break;
    case "tiddlywiki":
      serveFolder(state, "/assets/tiddlywiki", state.settings.__targetTW);
      break;
    default:
      state.throw(404);
  }
};

export const handleAdminRoute = (state: StateObject) => {
  switch (state.path[2]) {
    case "authenticate":
      handleAuthRoute(state);
      break;
    default:
      state.throw(404);
  }
};

/** Handles the /admin/authenticate route */
export const handleAuthRoute = (state: StateObject) => {
  if (state.req.method === "GET" || state.req.method === "HEAD") {
    return handleHEADorGETFileServe(state);
  }
  if (state.req.method !== "POST") return state.throw(405);
  switch (state.path[3]) {
    case "transfer":
      return handleTransfer(state);
    case "initpin":
      return handleInitPin(state);
    case "initshared":
      return handleInitShared(state);
    case "login":
      return handleLogin(state);
    case "logout":
      return handleLogout(state);
    default:
      console.log("Case not handled for authRoute");
  }
};
