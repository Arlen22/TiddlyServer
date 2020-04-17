import { IncomingMessage, ServerResponse } from 'http'

const USERNAME = ''
const PASSWORD = ''
const ALLOW_UNSECURED_WEBSOCKETS = false

export default async function(ev: any) {
  if (!USERNAME && !PASSWORD) return ev
  if (ev.response) ev.handled = !handleBasicAuth(ev.request, ev.response)
  else if (!ALLOW_UNSECURED_WEBSOCKETS && ev.client) {
    //reject all websocket connections because they do not have basic auth
    ev.client.close()
    ev.handled = true
  }
  ev.username = USERNAME
  return ev
}

/**
 * Check authentication and do sanity/security checks
 * For more details see:
 * https://github.com/hueniverse/iron
 *
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 * @returns {boolean} Returns whether the client is authorized
 */
const handleBasicAuth = (request: IncomingMessage, response: ServerResponse) => {
  if (!USERNAME && !PASSWORD) return true
  const getHeader = (header: string[] | string) => (Array.isArray(header) ? header[0] : header)
  if (!request.headers['authorization']) {
    response.writeHead(401, '', {
      'WWW-Authenticate': 'Basic realm="TiddlyServer"',
      'Content-Type': 'text/plain',
    })
    response.end()
    return false
  }
  const header = getHeader(request.headers['authorization']) || ''
  const token = header.split(/\s+/).pop() || '' // get the encoded auth token
  const auth = new Buffer(token, 'base64').toString()
  const [username, password] = auth.split(/:/)
  if (username !== USERNAME || password !== PASSWORD) {
    console.log('authorization invalid - UN:%s - PW:%s', username, password)
    response.writeHead(401, 'Invalid username or password')
    response.end()
    return false
  }
  return true
}
