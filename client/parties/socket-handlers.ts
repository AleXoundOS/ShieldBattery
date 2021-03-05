import type { NydusClient, RouteInfo } from 'nydus-client'
import { ReduxAction } from '../action-types'
import { dispatch, Dispatchable } from '../dispatch-registry'

const eventToAction: Record<
  string,
  (partyId: string, event: any) => Dispatchable<ReduxAction> | undefined
> = {
  addInvite: (partyId: string, event: any) => {
    return {
      type: '@parties/addInvite',
      payload: { partyId, from: event.from },
    }
  },

  removeInvite: (partyId: string, event: any) => {
    return {
      type: '@parties/removeInvite',
      payload: { partyId },
    }
  },

  init: (partyId: string, event: any) => {
    return {
      type: '@parties/init',
      payload: event.party,
    }
  },
}

export default function registerModule({ siteSocket }: { siteSocket: NydusClient }) {
  const partiesHandler = (route: RouteInfo, event: any) => {
    if (!eventToAction[event.type]) return

    const action = eventToAction[event.type](route.params.partyId, event)
    if (action) dispatch(action)
  }

  siteSocket.registerRoute('/parties/:partyId', partiesHandler)
  siteSocket.registerRoute('/parties/invites/:partyId/:userId', partiesHandler)
}
