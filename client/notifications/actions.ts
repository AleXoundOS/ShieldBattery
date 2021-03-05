import { Notification } from '../../common/notifications'
import { BaseFetchFailure } from '../network/fetch-action-types'

export type NotificationActions =
  | ServerInitNotifications
  | AddNotification
  | ClearByIdNotifications
  | ClearNotificationsBegin
  | ClearNotifications
  | BaseFetchFailure<'@notifications/clear'>
  | MarkNotificationsReadBegin
  | MarkNotificationsRead
  | MarkNotificationsReadFailure

export interface ServerInitNotifications {
  type: '@notifications/serverInit'
  payload: { notifications: Readonly<Notification[]> }
}

export interface AddNotification {
  type: '@notifications/add'
  payload: { notification: Readonly<Notification> }
}

export interface ClearByIdNotifications {
  type: '@notifications/clearById'
  payload: { notificationIds: Readonly<string[]> }
}

export interface ClearNotificationsBegin {
  type: '@notifications/clearBegin'
}

export interface ClearNotifications {
  type: '@notifications/clear'
  payload: void
  error?: false
}

export interface MarkNotificationsReadBegin {
  type: '@notifications/markReadBegin'
}

export interface MarkNotificationsRead {
  type: '@notifications/markRead'
  payload: void
  meta: { notificationIds: string[] }
  error?: false
}

export interface MarkNotificationsReadFailure extends BaseFetchFailure<'@notifications/markRead'> {
  meta: { notificationIds: string[] }
}
