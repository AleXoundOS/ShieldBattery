import { NydusServer } from 'nydus'
import { singleton } from 'tsyringe'
import {
  NotificationAddEvent,
  NotificationClearByIdEvent,
  NotificationServerInitEvent,
} from '../../../common/notifications'
import { ClientSocketsManager } from '../websockets/socket-groups'
import {
  addNotification,
  clearById,
  NotificationData,
  retrieveNotifications,
} from './notification-model'

export function getNotificationsPath(userId: number): string {
  return `/notifications/${userId}`
}

@singleton()
export default class NotificationService {
  constructor(private nydus: NydusServer, private clientSocketsManager: ClientSocketsManager) {
    this.clientSocketsManager.on('newClient', async c => {
      const notifications = await retrieveNotifications({ userId: c.userId })
      const event: NotificationServerInitEvent = {
        type: 'serverInit',
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.data.type,
          read: n.read,
          createdAt: Number(n.createdAt),
          from: n.data.from,
          partyId: n.data.partyId,
        })),
      }

      c.subscribe(getNotificationsPath(c.userId), () => event)
    })
  }

  /**
   * Adds a new notification with the provided data to the DB, and notifies all clients to update
   * their local lists.
   */
  async addNotification(notificationProps: {
    userId: number
    data: NotificationData
    createdAt?: Date
  }) {
    const notification = await addNotification(notificationProps)
    const event: NotificationAddEvent = {
      type: 'add',
      notification: {
        id: notification.id,
        type: notification.data.type,
        read: notification.read,
        createdAt: Number(notification.createdAt),
        from: notification.data.from,
        partyId: notification.data.partyId,
      },
    }

    this.nydus.publish(getNotificationsPath(notificationProps.userId), event)
    return notification
  }

  async clearById(userId: number, notificationIds: string[]) {
    await clearById(userId, notificationIds)
    const event: NotificationClearByIdEvent = {
      type: 'clearById',
      notificationIds,
    }

    this.nydus.publish(getNotificationsPath(userId), event)
  }
}
