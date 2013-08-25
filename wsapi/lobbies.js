var Endpoint = require('../util/websocket-endpoint')
  , util = require('util')
  , SimpleMap = require('../shared/simple-map')
  , listUtils = require('../shared/list-utils')

module.exports = function(io) {
  return new LobbyHandler(io)
}

function LobbyHandler(io) {
  Endpoint.call(this, io, 'lobbies')

  console.log('initializing')

  this._lobbyMap = new SimpleMap()
  this._lobbies = []
  this._userLobbyMap = new SimpleMap()

  // This assumes 1 disconnect per user across all our lobbies. This is fine as long as each user
  // can only be in 1 lobby at a time, but will cause problems otherwise
  this._disconnectHandlers = new SimpleMap()
}
util.inherits(LobbyHandler, Endpoint)

LobbyHandler.prototype.subscribe = function(socket, cb) {
  socket.join('lobbies/list')
  cb(this._lobbies)
}

LobbyHandler.prototype.unsubscribe = function(socket) {
  socket.leave('lobbies/list')
}

LobbyHandler.prototype.create = function(socket, params, cb) {
  if (!params.name || params.name == 'new') {
    return cb({ msg: 'Invalid name' })
  } else if (!params.map) {
    return cb({ msg: 'Invalid map' })
  } else if (!params.size || params.size < 2 || params.size > 8) {
    return cb({ msg: 'Invalid size' })
  }

  if (this._lobbyMap.has(params.name)) {
    return cb({ msg: 'A lobby with that name already exists' })
  }

  var lobby = new Lobby(socket.handshake.userName, params.name, params.map, params.size)
  this._lobbyMap.put(lobby.name, lobby)
  this._userLobbyMap.put(socket.handshake.userId, lobby)
  listUtils.sortedInsert(this._lobbies, lobby, Lobby.compare)
  cb(null)
  this.io.sockets.in('lobbies/list').emit('lobbies/message', { action: 'create', lobby: lobby })
}

LobbyHandler.prototype.join = function(socket, params, cb) {
  var self = this
  if (!params.name || !this._lobbyMap.has(params.name)) {
    return cb({ msg: 'No lobby with that name exists' })
  } else if (this._userLobbyMap.has(socket.handshake.userId)) {
    var oldLobby = this._userLobbyMap.get(socket.handshake.userId)
    if (oldLobby.name == params.name) {
      // trying to join a lobby they're already in, simply return them the lobby info
      // TODO(tec27): reevaluate whether this is necessary/desirable once we have a lobby service on
      // the client and the whole (host creates -> then follows it up with a 'duplicate' join) thing
      // goes away
      return finish(oldLobby)
    }

    return cb({ msg: 'You cannot enter multiple lobbies at once' })
  }

  var lobby = this._lobbyMap.get(params.name)
  if (lobby.size - lobby.numPlayers < 1) {
    return cb({ msg: 'Lobby full' })
  }

  var player = new LobbyPlayer(socket.handshake.userName, 'r', false)
  this._userLobbyMap.put(socket.handshake.userId, lobby)
  var slot = lobby.addPlayer(player)

  this.io.sockets.in(lobby._socketChannel).emit('lobbies/joined/message',
      { action: 'join', slot: slot, player: player })
  return finish(lobby)

  function finish(lobby) {
    var userName = socket.handshake.userName
      , handleDisconnect = function() {
          var slot = lobby.removePlayer(userName)
          // TODO(tec27): ideally all we'd need to do is call the above; figure out how to push
          // these actions into one function call
          if (slot >= 0) {
            self.io.sockets.in(lobby._socketChannel).emit('lobbies/joined/message',
                { action: 'part', slot: slot })
          }
          self._disconnectHandlers.del(userName)
          self._userLobbyMap.del(socket.handshake.userId)
        }

    // TODO(tec27): only the last socket for this user to join this lobby matters. Ideally we only
    // let them use one socket, but I haven't quite figured out how I want to do this yet. This
    // implementation is definitely not ideal, given that old sockets stay connected, they just no
    // longer have the ability to trigger parts through disconnect.
    if (self._disconnectHandlers.has(userName)) {
      socket.removeListener('disconnect', self._disconnectHandlers.get(userName))
    }
    self._disconnectHandlers.put(userName, handleDisconnect)
    socket.on('disconnect', handleDisconnect)

    socket.join(lobby._socketChannel)
    cb(null, lobby.getFullDescription())
  }
}

// TODO(tec27): when a lobby has no players left in it, close it down. Also deal with hosts
LobbyHandler.prototype.part = function(socket, cb) {
  if (!this._userLobbyMap.has(socket.handshake.userId)) {
    return cb({ msg: 'You are not currently in a lobby' })
  }

  var lobby = this._userLobbyMap.get(socket.handshake.userId)
    , userName = socket.handshake.userName
    , slot = lobby.removePlayer(userName)

  if (this._disconnectHandlers.has(userName)) {
    socket.removeListener('disconnect', this._disconnectHandlers.get(userName))
    this._disconnectHandlers.del(userName)
  }
  this._userLobbyMap.del(socket.handshake.userId)
  if (slot < 0) {
    return cb({ msg: 'Error leaving lobby' })
  }

  socket.leave(lobby._socketChannel)
  this.io.sockets.in(lobby._socketChannel).emit('lobbies/joined/message',
      { action: 'part', slot: slot })
  cb(null)
}

LobbyHandler.prototype.chat = function(socket, params) {
  if (!params.msg || !this._userLobbyMap.has(socket.handshake.userId)) {
    return
  }

  var lobby = this._userLobbyMap.get(socket.handshake.userId)
    , userName = socket.handshake.userName
  this.io.sockets.in(lobby._socketChannel).emit('lobbies/joined/message',
      { action: 'chat', from: userName, text: params.msg })
}

LobbyHandler.prototype.startCountdown = function(socket, cb) {
  if (!this._userLobbyMap.has(socket.handshake.userId)) {
    return cb({ msg: 'You are not in a lobby' })
  }

  var lobby = this._userLobbyMap.get(socket.handshake.userId)
    , player = lobby.getPlayer(socket.handshake.userName)
  if (!player || !player.isHost) {
    return cb({ msg: 'You must be the host to start the countdown' })
  }

  var self = this
  lobby.startCountdown(function() {
    self.io.sockets.in(lobby._socketChannel).emit('lobbies/joined/message',
        { action: 'countdownComplete', host: socket.handshake.address.address, port: 6112 })
  })

  cb(null)
  self.io.sockets.in(lobby._socketChannel).emit('lobbies/joined/message',
      { action: 'countdownStarted' })
}

function Lobby(hostUsername, name, map, size) {
  this.host = hostUsername
  this.name = name
  this.map = map
  this.size = size

  Object.defineProperty(this, 'slots',
      { value: new Array(size)
      , writable: false
      , enumerable: false
      })
  Object.defineProperty(this, 'players',
      { value: []
      , writable: false
      , enumerable: false
      })
  this.players[0] = this.slots[0] = new LobbyPlayer(hostUsername, 'r', true)

  Object.defineProperty(this, 'numPlayers',
      { get: function() { return this.players.length }
      , enumerable: true
      })

  Object.defineProperty(this, '_socketChannel',
      { value: 'lobbies/joined/' + this.name
      , writable: false
      , enumerable: false
      })

  Object.defineProperty(this, '_isCountingDown',
      { value: false
      , writable: true
      , enumerable: false
      })
}

Lobby.prototype.addPlayer = function(player) {
  if (this.size - this.players.length < 1) {
    throw new Error('No space for player')
  }

  this.players.push(player)
  for (var i = 0; i < this.size; i++) {
    if (!this.slots[i]) {
      this.slots[i] = player
      return i
    }
  }
}

Lobby.prototype.removePlayer = function(playerName) {
  var i
    , len
  for (i =  0, len = this.players.length; i <  len; i++) {
    if (this.players[i].name == playerName) {
      this.players.splice(i, 1)
      break
    }
  }

  for (i = 0; i < this.size; i++) {
    if (!!this.slots[i] && this.slots[i].name == playerName) {
      this.slots[i] = undefined
      return i
    }
  }
  return -1
}

Lobby.prototype.getPlayer = function(playerName) {
  for (var i = 0; i < this.size; i++) {
    if (!!this.slots[i] && this.slots[i].name == playerName) {
      return this.slots[i]
    }
  }
  return null
}

// Returns an object with the "full" description of this lobby, for giving to people that have
// joined it instead of just viewing it on the lobby list
Lobby.prototype.getFullDescription = function() {
  return  { host: this.host
          , name: this.name
          , map: this.map
          , size: this.size
          , slots: this.slots
          , players: this.players
          }
}

Lobby.prototype.startCountdown = function(cb) {
  this._isCountingDown = true
  setTimeout(cb, 5000)
}

Lobby.compare = function(a, b) {
  return a.name.localeCompare(b.name)
}

function LobbyPlayer(name, race, isHost) {
  this.name = name
  this.race = race
  this.isHost = isHost
}
