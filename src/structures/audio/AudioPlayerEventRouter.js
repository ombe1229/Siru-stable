const AudioPlayerEvents = require('./AudioPlayerEvents')
class AudioPlayerEventRouter {
  constructor (audio) {
    this.audio = audio
    this.client = this.audio.client
    this.classPrefix = this.audio.classPrefix + ':AudioPlayerEventRouter'
    this.defaultPrefix = {
      registerEvents: `${this.classPrefix}:registerEvents]`
    }
    this.AudioPlayerEvents = new AudioPlayerEvents(this)
  }

  /**
   * @param {Shoukaku#ShoukakuPlayer} player - Player for registering events
   */
  registerEvents (player) {
    this.client.logger.debug(`${this.defaultPrefix.registerEvents} Registering Player Events..`)
    player.on('end', (reason) => this.AudioPlayerEvents.onEnd(reason))
    player.on('trackException', (data) => this.AudioPlayerEvents.onEnd(data))
    player.on('error', (error) => {
      this.client.logger.error(`${this.defaultPrefix.registerEvents} Error on player ${error.stack || error.message}`)
      this.client.database.addErrorinfo('audioError', error.message, error.stack, 'bot', player.voiceConnection.guildID)
    })
    player.on('closed', (reason) => this.RouteWebSocketClosedEvents(reason))
    player.on('playerUpdate', (data) => {
      data.guildID = player.voiceConnection.guildID
      this.AudioPlayerEvents.onPlayerUpdate(data)
    })
  }

  RouteWebSocketClosedEvents (reason) {
    if (reason.code === 4014 && reason.byRemote === true && reason.reason === 'Disconnected.') {
      return this.audio.handleDisconnect(reason)
    }
  }

  RouteEndEvents (data) {
    switch (data.type) {
      case 'TrackEndEvent':
        this.RouteTrackEndEventReasons(data)
        break
      case 'TrackStuckEvent':
        break
      case 'TrackExceptionEvent':
        this.RouteTrackExcepetionErrors(data)
        break
    }
  }

  RouteTrackExcepetionErrors (data) {
    switch (data.error) {
    }
  }

  RouteTrackEndEventReasons (data) {
    switch (data.reason) {
      case 'REPLACED':
        this.AudioPlayerEvents.TrackReplaced(data)
        break
      case 'FINISHED':
        this.AudioPlayerEvents.TrackFinished(data)
        break
      case 'STOPPED':
        this.AudioPlayerEvents.TrackStopped(data)
        break
      case 'LOAD_FAILED':
        this.AudioPlayerEvents.TrackLoadFailed(data)
        break
      case 'CLEANUP':
        this.AudioPlayerEvents.TrackCleanUpped(data)
        break
    }
  }
}

module.exports = AudioPlayerEventRouter