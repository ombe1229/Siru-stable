class Command {
  constructor (client) {
    this.client = client
    this.command = {
      name: 'volume',
      aliases: ['볼륨', '볼륨설정', 'vol', 'v', '패ㅣ', 'ㅍ', 'qhffba', 'qhffbatjfwjd'],
      category: 'MUSIC_GENERAL',
      require_nodes: true,
      require_playing: false,
      require_voice: false,
      hide: false,
      permissions: ['Everyone']
    }
  }

  /**
   * @param {Object} compressed - Compressed Object
   */
  async run (compressed) {
    const locale = compressed.guildData.locale
    const picker = this.client.utils.localePicker
    const { message, args } = compressed
    if ((compressed.userPermissions.includes('Administrator') || compressed.userPermissions.includes('DJ')) && args.length > 0) {
      if (isNaN(args[0])) return message.channel.send(picker.get(locale, 'COMMANDS_AUDIO_VOLUME_STRING'))
      if (Number(args[0]) < 1) return message.channel.send(picker.get(locale, 'COMMANDS_AUDIO_VOLUME_UNDER_ONE'))
      if (Number(args[0]) > 150) return message.channel.send(picker.get(locale, 'COMMANDS_AUDIO_VOLUME_HIGH_HDF'))
      await this.client.audio.setVolume(message.guild.id, Number(args[0]))
      message.channel.send(picker.get(locale, 'COMMANDS_AUDIO_VOLUME_CHANGED', { VOLUME: Number(args[0]) }))
    } else {
      const guildData = await this.client.database.getGuild(message.guild.id)
      return message.channel.send(picker.get(locale, 'COMMANDS_AUDIO_VOLUME_CURRENT', { VOLUME: guildData.volume }))
    }
  }
}

module.exports = Command
