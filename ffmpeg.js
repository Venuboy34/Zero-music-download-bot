// This file configures FFmpeg to use the installed binary from @ffmpeg-installer/ffmpeg
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

module.exports = ffmpeg;
