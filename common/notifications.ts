export enum NotificationType {
  EmailVerification = 'emailVerification',
  PartyInvite = 'partyInvite',
}

export interface BaseNotification {
  readonly id: string
  readonly type: NotificationType
  readonly read: boolean
  readonly createdAt: number
}

export interface EmailVerificationNotification extends BaseNotification {
  type: typeof NotificationType.EmailVerification
}

export const EMAIL_VERIFICATION_ID = 'local-emailVerification'

export interface PartyInviteNotification extends BaseNotification {
  type: typeof NotificationType.PartyInvite
  from: string
  partyId: string
}

export type Notification = EmailVerificationNotification | PartyInviteNotification

export interface NotificationServerInitEvent {
  type: 'serverInit'
  notifications: Notification[]
}

export interface NotificationAddEvent {
  type: 'add'
  notification: Notification
}

export interface NotificationClearByIdEvent {
  type: 'clearById'
  notificationIds: string[]
}

export type NotificationEvent =
  | NotificationServerInitEvent
  | NotificationAddEvent
  | NotificationClearByIdEvent

export interface MarkNotificationsReadServerBody {
  notificationIds: string[]
}
