const emailService = require('./email');
const discordService = require('./discord');

module.exports = {
  sendEmail: emailService.sendEmail,
  sendTestEmail: emailService.sendTestEmail,
  isEmailEnabled: emailService.isEnabled,

  sendDiscord: discordService.sendDiscord,
  sendTestDiscord: discordService.sendTestMessage,
  isDiscordEnabled: discordService.isEnabled
};
