import type { NydusClient, RouteHandler, RouteInfo } from 'nydus-client'
import { NotificationEvent } from '../../common/notifications'
import { dispatch, Dispatchable } from '../dispatch-registry'
import { addNotification } from './action-creators'

type EventToActionMap = {
  [E in NotificationEvent['type']]?: (
    event: Extract<NotificationEvent, { type: E }>,
  ) => Dispatchable
}

const eventToAction: EventToActionMap = {
  serverInit: event => {
    const { notifications } = event
    return {
      type: '@notifications/serverInit',
      payload: { notifications },
    }
  },

  add: event => dispatch => {
    dispatch(addNotification(event.notification))
  },

  clearById: event => {
    const { notificationIds } = event
    return {
      type: '@notifications/clearById',
      payload: { notificationIds },
    }
  },
}

export default function registerModule({ siteSocket }: { siteSocket: NydusClient }) {
  const notificationsHandler: RouteHandler = (route: RouteInfo, event: NotificationEvent) => {
    const actionType = event.type as NotificationEvent['type']
    if (!eventToAction[actionType]) return

    const action = eventToAction[actionType]!(event as any)
    if (action) dispatch(action)
  }

  siteSocket.registerRoute('/notifications/:userId', notificationsHandler)
}
