import { List, Map, OrderedSet, Record, Set } from 'immutable'
import cuid from 'cuid'
import keyedReducer from '../reducers/keyed-reducer'
import * as SortedList from '../../common/sorted-list'
import {
  CHAT_CHANNEL_ACTIVATE,
  CHAT_CHANNEL_DEACTIVATE,
  CHAT_INIT_CHANNEL,
  CHAT_LOAD_CHANNEL_HISTORY_BEGIN,
  CHAT_LOAD_CHANNEL_HISTORY,
  CHAT_LOAD_USER_LIST_BEGIN,
  CHAT_LOAD_USER_LIST,
  CHAT_UPDATE_JOIN,
  CHAT_UPDATE_LEAVE,
  CHAT_UPDATE_LEAVE_SELF,
  CHAT_UPDATE_MESSAGE,
  CHAT_UPDATE_USER_ACTIVE,
  CHAT_UPDATE_USER_IDLE,
  CHAT_UPDATE_USER_OFFLINE,
  NETWORK_SITE_CONNECTED,
} from '../actions'
import {
  JoinChannelMessageRecord,
  LeaveChannelMessageRecord,
  NewChannelOwnerMessageRecord,
  SelfJoinChannelMessageRecord,
} from '../chat/chat-message-records'
import { TextMessageRecord } from '../messaging/message-records'

// How many messages should be kept for inactive channels
const INACTIVE_CHANNEL_MAX_HISTORY = 150

const sortUsers = (a, b) => a.localeCompare(b)

// Create partial evaluations all the SortedList functions with our sort function pre-applied
const SortedUsers = Object.keys(SortedList)
  .map(fnName => [fnName, (...args) => SortedList[fnName](sortUsers, ...args)])
  .reduce((prev, cur) => {
    prev[cur[0]] = cur[1]
    return prev
  }, {})

export const Users = new Record({
  active: new List(),
  idle: new List(),
  offline: new List(),
})

export class Channel extends Record({
  name: null,
  messages: new List(),
  users: new Users(),

  loadingHistory: false,
  hasHistory: true,

  hasLoadedUserList: false,
  loadingUserList: false,

  activated: false,
  hasUnread: false,
}) {}

export const ChatState = new Record({
  channels: new OrderedSet(),
  // Note that the keys for this map are always lower-case
  byName: new Map(),
})

function updateUserState(user, addTo, removeFirst, removeSecond) {
  const addToUpdated = SortedUsers.insert(addTo, user)

  const firstIndex = SortedUsers.findIndex(removeFirst, user)
  const removeFirstUpdated = firstIndex > -1 ? removeFirst.remove(firstIndex) : removeFirst

  const secondIndex = SortedUsers.findIndex(removeSecond, user)
  const removeSecondUpdated = secondIndex !== -1 ? removeSecond.remove(secondIndex) : removeSecond

  return [addToUpdated, removeFirstUpdated, removeSecondUpdated]
}

// Update the messages field for a channel, keeping the hasUnread flag in proper sync.
// updateFn is m => messages, and should perform the update operation on the messages field
function updateMessages(state, channelName, makesUnread, updateFn) {
  return state.updateIn(['byName', channelName.toLowerCase()], c => {
    let updated = updateFn(c.messages)
    if (updated === c.messages) {
      return c
    }

    let sliced = false
    if (!c.activated && updated.length > INACTIVE_CHANNEL_MAX_HISTORY) {
      updated = updated.slice(-INACTIVE_CHANNEL_MAX_HISTORY)
      sliced = true
    }

    return c
      .set('messages', updated)
      .set('hasUnread', makesUnread ? c.hasUnread || !c.activated : c.hasUnread)
      .set('hasHistory', c.hasHistory || sliced)
  })
}

export default keyedReducer(new ChatState(), {
  [CHAT_INIT_CHANNEL](state, action) {
    const { channel, activeUsers } = action.payload
    const sortedActiveUsers = SortedUsers.create(activeUsers)
    const record = new Channel({
      name: channel,
      users: new Users({
        active: sortedActiveUsers,
      }),
    })
    const updated = state
      .update('channels', c => c.add(channel))
      .setIn(['byName', channel.toLowerCase()], record)

    return updateMessages(updated, channel, false, m => {
      return m.push(
        new SelfJoinChannelMessageRecord({
          id: cuid(),
          time: Date.now(),
          channel,
        }),
      )
    })
  },

  [CHAT_UPDATE_JOIN](state, action) {
    const { channel, user } = action.payload

    const updated = state.updateIn(['byName', channel.toLowerCase(), 'users'], users => {
      const active = SortedUsers.insert(users.active, user)

      return users.set('active', active)
    })

    // TODO(2Pac): make this configurable
    return updateMessages(updated, channel, true, m => {
      return m.push(
        new JoinChannelMessageRecord({
          id: cuid(),
          time: Date.now(),
          user,
        }),
      )
    })
  },

  [CHAT_UPDATE_LEAVE](state, action) {
    const { channel, user, newOwner } = action.payload

    let updated = state.updateIn(['byName', channel.toLowerCase(), 'users'], users => {
      const index = SortedUsers.findIndex(users.active, user)
      const active = index > -1 ? users.active.remove(index) : users.active

      return users.set('active', active)
    })

    // TODO(2Pac): make this configurable
    updated = updateMessages(updated, channel, true, m => {
      return m.push(
        new LeaveChannelMessageRecord({
          id: cuid(),
          time: Date.now(),
          user,
        }),
      )
    })

    return newOwner
      ? updateMessages(updated, channel, true, m => {
          return m.push(
            new NewChannelOwnerMessageRecord({
              id: cuid(),
              time: Date.now(),
              newOwner,
            }),
          )
        })
      : updated
  },

  [CHAT_UPDATE_LEAVE_SELF](state, action) {
    const { channel } = action.payload

    return state
      .update('channels', c => c.delete(channel))
      .deleteIn(['byName', channel.toLowerCase()])
  },

  [CHAT_UPDATE_MESSAGE](state, action) {
    const { id, channel, time, user, message } = action.payload
    const newMessage = new TextMessageRecord({
      id,
      time,
      from: user,
      text: message,
    })
    return updateMessages(state, channel, true, m => m.push(newMessage))
  },

  [CHAT_UPDATE_USER_ACTIVE](state, action) {
    const { channel, user } = action.payload
    const lowerCaseChannel = channel.toLowerCase()
    return state.updateIn(['byName', lowerCaseChannel, 'users'], users => {
      const [active, idle, offline] = updateUserState(user, users.active, users.idle, users.offline)

      return users.set('active', active).set('idle', idle).set('offline', offline)
    })
  },

  [CHAT_UPDATE_USER_IDLE](state, action) {
    const { channel, user } = action.payload
    return state.updateIn(['byName', channel.toLowerCase(), 'users'], users => {
      const [idle, active, offline] = updateUserState(user, users.idle, users.active, users.offline)

      return users.set('active', active).set('idle', idle).set('offline', offline)
    })
  },

  [CHAT_UPDATE_USER_OFFLINE](state, action) {
    const { channel, user } = action.payload
    const lowerCaseChannel = channel.toLowerCase()
    return state.updateIn(['byName', lowerCaseChannel, 'users'], users => {
      const [offline, active, idle] = updateUserState(user, users.offline, users.active, users.idle)

      return users.set('active', active).set('idle', idle).set('offline', offline)
    })
  },

  [CHAT_LOAD_CHANNEL_HISTORY_BEGIN](state, action) {
    const { channel } = action.payload
    return state.updateIn(['byName', channel.toLowerCase()], c => c.set('loadingHistory', true))
  },

  [CHAT_LOAD_CHANNEL_HISTORY](state, action) {
    const { channel, limit } = action.meta
    const lowerCaseChannel = channel.toLowerCase()
    const newMessages = new List(
      action.payload.map(
        msg =>
          new TextMessageRecord({
            id: msg.id,
            time: msg.sent,
            from: msg.user,
            text: msg.data.text,
          }),
      ),
    )
    let updated = state.setIn(['byName', lowerCaseChannel, 'loadingHistory'], false)
    if (newMessages.size < limit) {
      updated = updated.setIn(['byName', lowerCaseChannel, 'hasHistory'], false)
    }

    return updateMessages(updated, channel, false, messages => newMessages.concat(messages))
  },

  [CHAT_LOAD_USER_LIST_BEGIN](state, action) {
    const { channel } = action.payload
    const lowerCaseChannel = channel.toLowerCase()
    return state
      .setIn(['byName', lowerCaseChannel, 'hasLoadedUserList'], true)
      .setIn(['byName', lowerCaseChannel, 'loadingUserList'], true)
  },

  [CHAT_LOAD_USER_LIST](state, action) {
    const { channel } = action.meta
    const lowerCaseChannel = channel.toLowerCase()
    const userList = action.payload
    return state
      .setIn(['byName', lowerCaseChannel, 'loadingUserList'], false)
      .updateIn(['byName', lowerCaseChannel, 'users'], users => {
        const offline = SortedUsers.create(
          new Set(userList).subtract(users.active).subtract(users.idle),
        )
        return users.set('offline', offline)
      })
  },

  [CHAT_CHANNEL_ACTIVATE](state, action) {
    const { channel } = action.payload
    const lowerCaseChannel = channel.toLowerCase()
    if (!state.byName.has(lowerCaseChannel)) {
      return state
    }
    return state.updateIn(['byName', lowerCaseChannel], c => {
      return c.set('hasUnread', false).set('activated', true)
    })
  },

  [CHAT_CHANNEL_DEACTIVATE](state, action) {
    const { channel } = action.payload
    const lowerCaseChannel = channel.toLowerCase()
    if (!state.byName.has(lowerCaseChannel)) {
      return state
    }
    const hasHistory =
      state.byName.get(lowerCaseChannel).messages.size > INACTIVE_CHANNEL_MAX_HISTORY

    return state.updateIn(['byName', lowerCaseChannel], c => {
      return c
        .set('messages', c.messages.slice(-INACTIVE_CHANNEL_MAX_HISTORY))
        .set('hasHistory', c.hasHistory || hasHistory)
        .set('activated', false)
    })
  },

  [NETWORK_SITE_CONNECTED](state, action) {
    return new ChatState()
  },
})
