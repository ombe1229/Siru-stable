const { EventEmitter } = require('events')
/**
 * @event startPlaying - Start Playing Track (Event)
 */
class Queue extends EventEmitter {
  constructor (audio) {
    super()
    this.audio = audio
    this.client = audio.client

    this.classPrefix = this.audio.classPrefix + ':Queue'
    this.defaultPrefix = {
      get: `${this.classPrefix}:get]`,
      enQueue: `${this.classPrefix}:enQueue]`,
      deQueue: `${this.classPrefix}:deQueue]`,
      playNext: `${this.classPrefix}:playNext]`,
      play: `${this.classPrefix}:play]`,
      autoPlay: `${this.classPrefix}:autoPlay]`,
      setNowPlaying: `${this.classPrefix}:setNowPlaying]`,
      skip: `${this.classPrefix}:skip]`
    }
  }

  /**
   * @param {String} guildID - guildID for get Queue
   */
  get (guildID) {
    this.client.logger.debug(`${this.defaultPrefix.get} [${guildID}] Get Queue`)
    return new Promise((resolve, reject) => {
      if (!guildID) return reject(new Error('GuildID is not Provided'))
      this.client.database.getGuildData(guildID)
        .then(res => {
          resolve(res.queue)
        })
        .catch(e => reject(e))
    })
  }

  /**
   * @param {String} guildID - GuildID
   * @param {Object|Array<Object>} track - Item(s) add Queue
   * @param {Object} message = Message
   */
  async enQueue (guildID, track, message) {
    if (Array.isArray(track)) {
      const result = track.map(el => {
        el.request = message.author.id
        return el
      })
      this.client.logger.debug(`${this.defaultPrefix.enQueue} [${guildID}] Added Track(s) (${track.length} Items)`)
      await this.client.database.updateGuildData(guildID, { $push: { queue: { $each: result } } })
    } else {
      this.client.logger.debug(`${this.defaultPrefix.enQueue} [${guildID}] Added Track (${track.track})`)
      track.request = message.author.id
      await this.client.database.updateGuildData(guildID, { $push: { queue: track } })
    }
    this.autoPlay(guildID)
  }

  /**
   * @description - If there is no song currently playing, and there is a song in the queue, it will play automatically.
   * @param {String} guildID - guild id to autoPlaying
   * @example - <Queue>.autoPlay('672586746587774976')
   */
  async autoPlay (guildID, deQueue = false) {
    const queueData = await this.get(guildID)
    if (!this.audio.players.get(guildID) || !this.audio.players.get(guildID).track) {
      if (queueData.length > 0) {
        this.client.logger.debug(`${this.defaultPrefix.autoPlay} [${guildID}] Resume Last Queue...`)
        await this.playNext(guildID)
      } else if (deQueue) {
        this.client.logger.debug(`${this.defaultPrefix.autoPlay} [${guildID}] Nothing in the Queue, Leaves VoiceChannel...`)
        await this.playNext(guildID)
      } else {
        this.client.logger.debug(`${this.defaultPrefix.autoPlay} [${guildID}] Nothing in the Queue!`)
      }
    }
  }

  /**
   * @description - Removes the front item in the queue of the guild, depending on the repeat state
   * @param {String} guildID - guild id to skips
   * @example - <Queue>.deQueue('672586746587774976'fgh)
   */
  async deQueue (guildID, skip = false) {
    const guildData = await this.client.database.getGuildData(guildID)
    if (skip || (guildData.repeat !== 2 && skip)) {
      this.client.logger.debug(`${this.defaultPrefix.deQueue} [${guildID}] Shift Track (Skip)`)
      await this.client.database.updateGuildData(guildID, { $pop: { queue: -1 } })
      return this.playNext(guildID)
    } else {
      switch (guildData.repeat) {
        case 0:
          this.client.logger.debug(`${this.defaultPrefix.deQueue} [${guildID}] Playing (No Shift) Track (Repeat: None)`)
          break
        case 1:
          this.client.logger.debug(`${this.defaultPrefix.deQueue} [${guildID}] UnShift Track (Repeat: ALL)`)
          await this.client.database.updateGuildData(guildID, { $push: { queue: guildData.nowplaying } })
          break
        case 2:
          this.client.logger.debug(`${this.defaultPrefix.deQueue} [${guildID}] UnShift Track (Repeat: Single)`)
          await this.client.database.updateGuildData(guildID, { $push: { queue: guildData.nowplaying } })
          break
      }
      return this.autoPlay(guildID, true)
    }
  }

  /**
   * @description - Skip 1 song (delete from queue and play the next song)
   * @param {String} guildID - guild id to skips
   * @example - <Queue>.skip('672586746587774976')
   */
  skip (guildID) {
    this.client.logger.debug(`${this.defaultPrefix.skip} [${guildID}] Skips Track..`)
    return new Promise((resolve) => {
      this.audio.players.get(guildID).stopTrack().then((res) => {
        this.client.logger.debug(`${this.defaultPrefix.skip} [${guildID}] Skips Track.. Result: ${res}`)
        resolve(res)
      })
    })
  }

  /**
   * @description - If the guild's queue doesn't have the next song to play, stop playing, and if there's a song in the guild's queue, play it (queue management).
   * @param {String} guildID - guild id to playNext
   * @example - <Queue>.playNext('672586746587774976')
   */
  async playNext (guildID) {
    const queueData = await this.get(guildID)
    const guildData = await this.client.database.getGuildData(guildID)
    if (queueData.length !== 0 || guildData.repeat === 2) {
      if (guildData.nowplaying.track !== null && guildData.repeat === 2) {
        await this.play(guildID, guildData.nowplaying)
        this.client.logger.debug(`${this.defaultPrefix.playNext} Play Next Song... (Song: ${guildData.nowplaying.track}) (Single Repeat)`)
      } else if (guildData.queue.length !== 0) {
        this.client.logger.debug(`${this.defaultPrefix.playNext} Play Next Song... (Song: ${guildData.queue[0].track})`)
        await this.play(guildID, queueData[0])
      }
    } else {
      if (!queueData[0]) {
        await this.setNowPlaying(guildID, { track: null })
        this.client.logger.debug(`${this.defaultPrefix.playNext} [${guildID}] Nothing items to playing next!`)
        this.emit('queueEvent', { guildID, op: 'playBackEnded' })
        this.client.audio.leave(guildID)
      }
    }
  }

  /**
   * @description - Play a track with Base64 in the player on the guildID.
   * @param {String} guildID - guild id to play
   * @param {String} trackData - base64 Track to play
   * @example - <Queue>.play('672586746587774976', 'QAAApgIAQ1vrqqnshozrpqzsmYAg6...')
   */
  async play (guildID, trackData) {
    const { track } = trackData
    this.client.logger.debug(`${this.defaultPrefix.play} [${guildID}] Playing Item ${track}...`)
    this.audio.players.get(guildID).playTrack(track, { noReplace: false }).then(async () => {
      await this.setNowPlaying(guildID, trackData)
      this.emit('queueEvent', { guildID, trackData, op: 'trackStarted' })
      await this.client.audio.setPlayersDefaultSetting(guildID)
      await this.client.database.updateGuildData(guildID, { $pop: { queue: -1 } })
    }).catch(async (e) => {
      await this.setNowPlaying(guildID, { track: null })
      this.client.logger.error(`${this.defaultPrefix.play} [${guildID}] Error playing ${track}\n${e.stack}`)
    })
  }

  /**
   * @description - If there is no song currently playing, and there is a song in the queue, it will play automatically.
   * @param {String} guildID - guild id to autoPlaying
   * @param {Object} item - Object to be set as nowplaying
   * @example - <Queue>.setNowPlaying('672586746587774976', { track: null })
   */
  setNowPlaying (guildID, item) {
    this.client.logger.debug(`${this.defaultPrefix.setNowPlaying} [${guildID}] Updating Nowplaying to ${!item ? null : item.track}...`)
    if (this.audio.players.get(guildID)) this.audio.players.get(guildID).track = item.track
    return this.client.database.updateGuildData(guildID, { $set: { nowplaying: item } })
  }
}

module.exports = Queue