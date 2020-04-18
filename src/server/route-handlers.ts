import * as path from 'path'
import { StateObject } from '../state-object'
import { serveFolder } from './server'
import {
  handleTransfer,
  handleInitPin,
  handleInitShared,
  handleLogout,
  handleLogin,
  handleHEADorGETFileServe,
} from '../auth-route'
import { RequestMethod } from '../types'

export const handleAssetsRoute = (state: StateObject) => {
  switch (state.path[2]) {
    case 'static':
      serveFolder(state, '/assets/static', path.join(state.settings.__assetsDir, 'static'))
      break
    case 'icons':
      serveFolder(state, '/assets/icons', path.join(state.settings.__assetsDir, 'icons'))
      break
    case 'tiddlywiki':
      serveFolder(state, '/assets/tiddlywiki', state.settings.__targetTW)
      break
    default:
      state.throw(404)
  }
}

export const handleAdminRoute = (state: StateObject) => {
  switch (state.path[2]) {
    case 'authenticate':
      handleAuthRoute(state)
      break
    default:
      state.throw(404)
  }
}

/** Handles the /admin/authenticate route */
export const handleAuthRoute = (state: StateObject) => {
  if (state.req.method === RequestMethod.GET || state.req.method === RequestMethod.HEAD) {
    return handleHEADorGETFileServe(state)
  }
  if (state.req.method !== RequestMethod.POST) return state.throw(405)
  switch (state.path[3]) {
    case 'transfer':
      return handleTransfer(state)
    case 'initpin':
      return handleInitPin(state)
    case 'initshared':
      return handleInitShared(state)
    case 'login':
      return handleLogin(state)
    case 'logout':
      return handleLogout(state)
    default:
      console.log('Case not handled for authRoute')
  }
}
