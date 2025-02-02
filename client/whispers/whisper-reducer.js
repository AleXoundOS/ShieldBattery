import { List, Map, OrderedSet, Record } from 'immutable'
import keyedReducer from '../reducers/keyed-reducer'
import {
  WHISPERS_LOAD_SESSION_HISTORY_BEGIN,
  WHISPERS_LOAD_SESSION_HISTORY,
  WHISPERS_SESSION_ACTIVATE,
  WHISPERS_SESSION_DEACTIVATE,
  WHISPERS_START_SESSION_BEGIN,
  WHISPERS_START_SESSION,
  WHISPERS_UPDATE_INIT_SESSION,
  WHISPERS_UPDATE_CLOSE_SESSION,
  WHISPERS_UPDATE_MESSAGE,
  WHISPERS_UPDATE_USER_ACTIVE,
  WHISPERS_UPDATE_USER_IDLE,
  WHISPERS_UPDATE_USER_OFFLINE,
  NETWORK_SITE_CONNECTED,
} from '../actions'
import { TextMessageRecord } from '../messaging/message-records'

// How many messages should be kept for inactive channels
const INACTIVE_CHANNEL_MAX_HISTORY = 150

export class Session extends (new Record({
  target: null,
  status: null,
  messages: new List(),

  loadingHistory: false,
  hasHistory: true,

  activated: false,
  hasUnread: false,
})) {}

export const WhisperState = new Record({
  sessions: new OrderedSet(),
  // Note that the keys for this map are always lower-case
  byName: new Map(),
  errorsByName: new Map(),
})

// TODO(tec27): undo this copy-paste
// Update the messages field for a whisper, keeping the hasUnread flag in proper sync.
// updateFn is m => messages, and should perform the update operation on the messages field
function updateMessages(state, targetName, updateFn) {
  return state.updateIn(['byName', targetName], c => {
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
      .set('hasUnread', c.hasUnread || !c.activated)
      .set('hasHistory', c.hasHistory || sliced)
  })
}

export default keyedReducer(new WhisperState(), {
  [WHISPERS_UPDATE_INIT_SESSION](state, action) {
    const { target, targetStatus: status } = action.payload
    const session = new Session({ target, status })

    return state
      .update('sessions', s => s.add(target))
      .setIn(['byName', target.toLowerCase()], session)
  },

  [WHISPERS_START_SESSION_BEGIN](state, action) {
    const { target } = action.payload
    return state.deleteIn(['errorsByName', target.toLowerCase()])
  },

  [WHISPERS_START_SESSION](state, action) {
    if (action.error) {
      const { target } = action.meta
      const message =
        "Something went wrong. Please try again and make sure you've entered a" +
        ' correct username.'
      return state.setIn(['errorsByName', target.toLowerCase()], message)
    }

    return state
  },

  [WHISPERS_UPDATE_CLOSE_SESSION](state, action) {
    const { target } = action.payload

    return state
      .update('sessions', s => s.delete(target))
      .deleteIn(['byName', target.toLowerCase()])
  },

  [WHISPERS_UPDATE_MESSAGE](state, action) {
    const { id, time, from, to, message } = action.payload
    const target = state.sessions.has(from) ? from : to
    const newMessage = new TextMessageRecord({
      id,
      time,
      from,
      text: message,
    })

    return updateMessages(state, target.toLowerCase(), m => m.push(newMessage))
  },

  [WHISPERS_UPDATE_USER_ACTIVE](state, action) {
    const { user } = action.payload
    const name = user.toLowerCase()
    const wasIdle = state.byName.get(name).status === 'idle'
    if (wasIdle) {
      // Don't show online message if the user went from idle -> active
      return state
    }

    return state.setIn(['byName', name, 'status'], 'active')
  },

  [WHISPERS_UPDATE_USER_IDLE](state, action) {
    const { user } = action.payload

    return state.setIn(['byName', user.toLowerCase(), 'status'], 'idle')
  },

  [WHISPERS_UPDATE_USER_OFFLINE](state, action) {
    const { user } = action.payload
    const name = user.toLowerCase()

    return state.setIn(['byName', name, 'status'], 'offline')
  },

  [WHISPERS_LOAD_SESSION_HISTORY_BEGIN](state, action) {
    const { target } = action.payload

    return state.updateIn(['byName', target.toLowerCase()], s => s.set('loadingHistory', true))
  },

  [WHISPERS_LOAD_SESSION_HISTORY](state, action) {
    const { target, limit } = action.meta
    const name = target.toLowerCase()
    const newMessages = new List(
      action.payload.map(
        msg =>
          new TextMessageRecord({
            id: msg.id,
            time: msg.sent,
            from: msg.from,
            text: msg.data.text,
          }),
      ),
    )
    let updated = state.setIn(['byName', name, 'loadingHistory'], false)
    if (newMessages.size < limit) {
      updated = updated.setIn(['byName', name, 'hasHistory'], false)
    }

    return updateMessages(updated, name, messages => newMessages.concat(messages))
  },

  [WHISPERS_SESSION_ACTIVATE](state, action) {
    const { target } = action.payload
    const name = target.toLowerCase()
    if (!state.byName.has(name)) {
      return state
    }
    return state.updateIn(['byName', name], s => {
      return s.set('hasUnread', false).set('activated', true)
    })
  },

  [WHISPERS_SESSION_DEACTIVATE](state, action) {
    const { target } = action.payload
    const name = target.toLowerCase()
    if (!state.byName.has(name)) {
      return state
    }
    const hasHistory = state.byName.get(name).messages.size > INACTIVE_CHANNEL_MAX_HISTORY

    return state.updateIn(['byName', name], s => {
      return s
        .set('messages', s.messages.slice(-INACTIVE_CHANNEL_MAX_HISTORY))
        .set('hasHistory', s.hasHistory || hasHistory)
        .set('activated', false)
    })
  },

  [NETWORK_SITE_CONNECTED](state, action) {
    return new WhisperState()
  },
})
