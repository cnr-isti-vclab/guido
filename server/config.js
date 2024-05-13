const config = {
  listenIp: '0.0.0.0',
  listenPort: 8080,
  //sslCrt: 'ssl-cert-snakeoil.pem',
  //sslKey: 'ssl-cert-snakeoil.key',
  sslCrt: 'private.pem',
  sslKey: 'private.key',
  mediasoup: {
    // Worker settings
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 20000,
      logLevel: 'warn',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
        // 'rtx',
        // 'bwe',
        // 'score',
        // 'simulcast',
        // 'svc'
      ],
    },
    // Router settings
    router: {
      mediaCodecs:
        [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2
          },
          {
            kind: 'video',
            mimeType: 'video/VP8',
            clockRate: 90000,
            parameters:
              {
                'x-google-start-bitrate': 1000
              }
          },
        ]
    },
    // WebRtcTransport settings
    webRtcTransport: {
      listenIps: [
        {
//          ip: '127.0.0.1',
//          ip: '192.168.1.107',
            ip: '146.48.84.175',
            announcedIp: null,
        }
      ],
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000,
    },

    // Recording: PlainTransportOptions
    plainTransport: {
      listenIp: { ip: "127.0.0.1", announcedIp: null },
    },
    recording: {
      ip: "127.0.0.1",
      audioPort: 5555,
      audioPortRtcp: 5556,
      videoPort: 5557,
      videoPortRtcp: 5558
    }
  }
};

export { config }
