import { StateObject } from "./src/server-types";

const USERNAME = "";
const PASSWORD = "";

/**
 * @param {import("./src/server-types").RequestEventHTTP} ev
 */
exports.preflighter = async function (ev) {
	if (!USERNAME && !PASSWORD) return ev;
	if (ev.response) ev.handled = !handleBasicAuth(ev.request, ev.response);
	else {
		//reject all websocket connections because they do not have basic auth
		ev.client.close();
		ev.handled = true;
	}

	return ev;
}
/**
 * @param {import("./src/server-types").RequestEvent["request"]} request
 * @param {import("./src/server-types").RequestEventHTTP["response"]} response
 * @returns {boolean} Returns whether the client is authorized
 */
function handleBasicAuth(request, response) {
	const state = false;
	//check authentication and do sanity/security checks
	//https://github.com/hueniverse/iron
	//auth headers =====================
	if (!USERNAME && !PASSWORD) return true;
	const first = (header) =>
		Array.isArray(header) ? header[0] : header;
	if (!request.headers['authorization']) {
		response.writeHead(401, "", { 'WWW-Authenticate': 'Basic realm="TiddlyServer"', 'Content-Type': 'text/plain' });
		response.end();
		return false;
	}
	var header = first(ev.req.headers['authorization']) || '',  // get the header
		token = header.split(/\s+/).pop() || '',                     // and the encoded auth token
		auth = new Buffer(token, 'base64').toString(),               // convert from base64
		parts = auth.split(/:/),                                     // split on colon
		username = parts[0],
		password = parts[1];
	if (username !== USERNAME || password !== PASSWORD) {
		console.log('authorization invalid - UN:%s - PW:%s', username, password);
		response.writeHead(401, 'Invalid username or password');
		response.end();
		return false;
	}
	return true;
}