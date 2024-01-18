import path from "path"
import * as fs from 'fs';

import * as https from 'https';
import express from 'express';
import { Server } from 'socket.io';

import * as mediasoup from 'mediasoup'
import FFmpegStatic from 'ffmpeg-static';

import { config } from './config.js';


const __dirname = path.resolve();

// Global variables
let last_status;
let worker;
let webServer;
let socketServer;
let expressApp;
let videoproducer;
let audioproducer;
//let consumer;
let producerTransport;
//let consumerTransports = new Map;
let mediasoupRouter;

let clients = {};
let guide = null;
let chat = [];

(async () => {
	try {
	await runExpressApp();
	await runWebServer();
	await runSocketServer();
	await runMediasoupWorker();
	} catch (err) {
	console.error(err);
	}
})();

async function runExpressApp() {
	expressApp = express();
	expressApp.use(express.json());
	expressApp.use(express.static(__dirname));

	expressApp.use((error, req, res, next) => {
	if (error) {
		console.warn('Express app error,', error.message);

		error.status = error.status || (error.name === 'TypeError' ? 400 : 500);

		res.statusMessage = error.message;
		res.status(error.status).send(String(error));
	} else {
		next();
	}
	});
}

async function runWebServer() {
	const { sslKey, sslCrt } = config;
	if (!fs.existsSync(sslKey) || !fs.existsSync(sslCrt)) {
		console.error('SSL files are not found. check your config.js file');
		process.exit(0);
	}
	const tls = {
		cert: fs.readFileSync(sslCrt),
		key: fs.readFileSync(sslKey),
	};
	webServer = https.createServer(tls, expressApp);
	webServer.on('error', (err) => {
		console.error('starting web server failed:', err.message);
	});

	await new Promise((resolve) => {
	const { listenIp, listenPort } = config;
	webServer.listen(listenPort, listenIp, () => {
		const listenIps = config.mediasoup.webRtcTransport.listenIps[0];
		const ip = listenIps.announcedIp || listenIps.ip;
		console.log('server is running');
		console.log(`open http://${ip}:${listenPort} in your web browser`);
		resolve();
	});
	});
}

async function createRecording(guide) {
	//do nothing for the moment.
}

async function closeRecording(guide) {
}

async function saveStatus(client, status) {
	status.clientid = client.id;
	status.timestamp = Date.now();
	if(client == guide)
		status.guide = true
	if(client.username)
		status.username = client.username;
	if(client.raised)
		status.raised = true;
	if(status.lat)
		status.lat = parseFloat(status.lat.toFixed(2));
	if(status.lon)
		status.lon = parseFloat(status.lon.toFixed(2));
	if(!status.highlight) {
		delete status.highlight;
	} else {
		status.highlight.pitch = parseFloat(status.highlight.pitch.toFixed(2));
		status.highlight.yaw = parseFloat(status.highlight.yaw.toFixed(2));
	}

	let content = JSON.stringify(status) + "\n";
	fs.writeFile('log.txt', content, { flag: 'a+' }, err => {});
}

async function runSocketServer() {
	socketServer = new Server(webServer, {
		serveClient: false,
		path: '/server',
		log: true
	});

	socketServer.on('connection', (socket) => {	

		console.log('client connect', socket.id);
		let client = clients[socket.id] = { id: socket.id, muted:true, locked:true };
		saveStatus(client, {  action: 'connect'});

		socket.emit('id', socket.id);
		socketServer.emit('users', clients);

		// inform the client about existence of producer
		for(let client of Object.values(clients)) {
			//console.log("We have guide");
			if(client.videoproducer) {
				//console.log('emit guide video streaming');
				socket.emit('streaming', { id: client.id, kind: 'video' });
			}
			if(client.audioproducer) {
				//console.log('emit guide audio streaming');
				socket.emit('streaming', { id: client.id, kind: 'audio' });
			}
		}
		if(last_status)
			socket.emit('follow', last_status);


		socket.on('disconnect', () => {
			
			//console.log('client disconnected');
			if(guide && socket.id == guide.id) {
				closeRecording(guide);
				guide = null;
			}
			let client = clients[socket.id];
			saveStatus(client, {  action: 'disconnect' });

			if(client.producerTransport)
				client.producerTransport.close();
			if(client.consumerTransport)
				client.consumerTransport.close();

			if(clients[socket.id])
				delete clients[socket.id];

			socket.broadcast.emit('users', clients);
		});

		socket.on('guide', (key) => {
			if(key == 'keyplaceholder') {
				//console.log('Start recording guide');
				guide = clients[socket.id];
				guide.guide = true;
				//socketServer.emit('users', clients);
				socket.emit('hi guide');
			}
		});

		socket.on('mute', (user) => {
			if(!clients[socket.id].guide)
				return;
			if(!clients[user])
				return;
			let client = clients[user];
			//console.log('locking client', client);
			if(client.audioproducer)
				client.audioproducer.close();
			client.audioproducer = null;
			client.muted = true;
			client.locked = true;

			socket.broadcast.emit('users', clients);
			socketServer.emit('users', clients);
		});

		socket.on('unlock', (user) => {
			if(!clients[socket.id].guide)
				return;
			if(!clients[user])
				return;
			let client = clients[user];
			//console.log('unlocking client', client);
			client.locked = false;
			socket.broadcast.emit('users', clients);
			socketServer.emit('users', clients);
		});

		socket.on('username', (username) => {
			clients[socket.id].username = username;
			socket.broadcast.emit('users', clients);
			socketServer.emit('users', clients);
		});

		socket.on('chat', (msg) => {
			let client = clients[socket.id];
			saveStatus(client, {  action: 'chat', msg });

			
			let line = { user: client.id, username:client.username, text: msg} 
			chat.push(line);
			socketServer.emit('chat', line);
		});

		socket.on('raise', raised => {
			//console.log('raise');
			let client = clients[socket.id];
			client.raised = raised;
			socket.broadcast.emit('users', clients);
			socketServer.emit('users', clients);

			saveStatus(client, {  action: 'raised' });


		});

		socket.on('status', (status) => {
			last_status = status;
			let client = clients[socket.id];

			if(client.guide) {
				status.users = socketServer.engine.clientsCount;
				socket.broadcast.emit('follow', status);
			}
			saveStatus(client, status);
		});

		socket.on('connect_error', (err) => {
			console.error('client connection error', err);
		});

		socket.on('getRouterRtpCapabilities', (data, callback) => {
			//console.log('routertpcaps');
			callback(mediasoupRouter.rtpCapabilities);
		});

		socket.on('createProducerTransport', async (data, callback) => {
			let client = clients[socket.id];
			try {
				const { transport, params } = await createWebRtcTransport();
				client.producerTransport = transport;
				callback(params);
				//console.log('created producer transport');
			} catch (err) {
				console.error('created producer transport error', err);
				callback({ error: err.message });
			}
		});

		socket.on('createConsumerTransport', async (data, callback) => {
			console.log("Create consumer transport");
			let client = clients[socket.id];
			try {
				const { transport, params } = await createWebRtcTransport();
				client.consumerTransport = transport;
				callback(params);
				console.log('created consumer transport', client.id);
			} catch (err) {
				console.error('Error create consumer', err);
				callback({ error: err.message });
			}
		});

		socket.on('connectProducerTransport', async (data, callback) => {
			let client = clients[socket.id];
			//console.log('connecting producer transport');
			await client.producerTransport.connect({ dtlsParameters: data.dtlsParameters });
			callback();
			//console.log('connected producer transport');
		});

		socket.on('connectConsumerTransport', async (data, callback) => {
			let client = clients[socket.id];

			console.log('connecting consumer transport', client.id);
			if(!client.consumerTransport)
				console.log('connect before create?');

			await client.consumerTransport.connect({ dtlsParameters: data.dtlsParameters });
			callback();
			//console.log('connected consumer transport');
		});

		socket.on('produce', async (data, callback) => {
			let client = clients[socket.id];
			if(!client.producerTransport) {
				console.log("Trying to produce without a transport");
				return;
			}

			const {kind, rtpParameters} = data;
			let producer = await client.producerTransport.produce({ kind, rtpParameters });
			if(kind == "video")
				client.videoproducer = producer;
			if(kind == "audio") {
				client.audioproducer = producer;
				client.muted = false;
			}

			callback({ id: producer.id });

			// inform clients about new producerls
			console.log("Streaming", client.id, kind);
			socket.broadcast.emit('streaming',  { id: client.id, kind });
			socket.broadcast.emit('users', clients);
			socket.emit('users', clients);

			if(client.guide && kind == "video")
				handleStartRecording(guide);
		});

		socket.on('unproduce', async (data, callback) => {
			let client = clients[socket.id];
			let kind = data.kind;
			if(kind == "video" && client.videoproducer) {
				client.videoproducer.close();
				client.videoproducer = null;
			}
			if(kind == "audio" && client.audioproducer) {
				client.audioproducer.close();
				client.audioproducer = null;
				client.muted = true;
			}
			socket.broadcast.emit('unstreaming',  { id: client.id, kind });
			socket.broadcast.emit('users', clients);
			socket.emit('users', clients);

//			socket.emit('users', clients);
		});
		

		socket.on('consume', async (data, callback) => {
			let client = clients[data.client];
			let producer = data.kind == 'video' ? client.videoproducer : client.audioproducer;
			if(!producer) {
				callback({ error: 'producer not found' });
				return;
			}
			let answer = await createConsumer(socket, producer, data.rtpCapabilities);
			callback(answer);
		});

		socket.on('resume', async (data, callback) => {
			let client = clients[socket.id];
			if(!client.consumer) {
				callback({ error: "Client missing" });
				return;
			}
			if(client.consumer.closed) {
				callback({ error: "Client closed" });
				return;
			}
			//console.log('socket consumer in resume');
			try {
				await client.consumer.resume();
			} catch (err) {
				console.error('resume error', err);
				callback({ error: err.message });
				return;
			}
			callback();
		});

		socket.on('record', async(data, callback) => {
			handleStartRecording(guide);
		});
	});
}

async function runMediasoupWorker() {
	try {
		worker = await mediasoup.createWorker({
			logLevel: config.mediasoup.worker.logLevel,
			logTags: config.mediasoup.worker.logTags,
			rtcMinPort: config.mediasoup.worker.rtcMinPort,
			rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
		});

		worker.on('died', () => {
			console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
			setTimeout(() => process.exit(1), 2000);
		});
		const mediaCodecs = config.mediasoup.router.mediaCodecs;

			mediasoupRouter = await worker.createRouter({ mediaCodecs });
	} catch(error) {
		console.log("CATASTROFIC ERROR!", error);
	}

	//console.log(mediasoupRouter);
}

async function createWebRtcTransport() {
	const {
		maxIncomingBitrate,
		initialAvailableOutgoingBitrate
	} = config.mediasoup.webRtcTransport;

	const transport = await mediasoupRouter.createWebRtcTransport({
		listenIps: config.mediasoup.webRtcTransport.listenIps,
		enableUdp: true,
		enableTcp: true,
		preferUdp: true,
		initialAvailableOutgoingBitrate,
	});
	if (maxIncomingBitrate) {
		try {
			await transport.setMaxIncomingBitrate(maxIncomingBitrate);
		} catch (error) {
			console.log("error setting incoming bitrate");
		}
	}

	return {
		transport,
		params: {
			id: transport.id,
			iceParameters: transport.iceParameters,
			iceCandidates: transport.iceCandidates,
			dtlsParameters: transport.dtlsParameters
		},
	};
}

async function createConsumer(socket, producer, rtpCapabilities) {
	if (!mediasoupRouter.canConsume({ producerId: producer.id, rtpCapabilities })) {
		console.error('can not consume');
		return;
	}

	let client = clients[socket.id];


	let consumer;
	try {
		consumer = client.consumer = await client.consumerTransport.consume({
			producerId: producer.id,
			rtpCapabilities,
			paused: producer.kind === 'video',
		});
	} catch (error) {
		console.error('consume failed', error);
		return;
	}

	if (consumer.type === 'simulcast') {
		//console.log('setting preferred layers');
		await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
	}

	return {
		producerId: producer.id,
		id: consumer.id,
		kind: consumer.kind,
		rtpParameters: consumer.rtpParameters,
		type: consumer.type,
		producerPaused: consumer.producerPaused
	};
}

let recordRtp = {};
async function handleStartRecording(guide) {
	return;
  let recorder = 'ffmpeg';
  const router = mediasoupRouter;

  const useAudio = guide.audioproducer != null;
  const useVideo = guide.videoproducer != null;

  let consumers = { };

  // Start mediasoup's RTP consumer(s)

  if (useAudio) {
    const rtpTransport = await router.createPlainTransport({
      // No RTP will be received from the remote side
      comedia: false,

      // FFmpeg and GStreamer don't support RTP/RTCP multiplexing ("a=rtcp-mux" in SDP)
      rtcpMux: false,
      ...config.mediasoup.plainTransport,
    });
	recordRtp.audioTransport = rtpTransport;

    await rtpTransport.connect({
      ip: config.mediasoup.recording.ip,
      port: config.mediasoup.recording.audioPort,
      rtcpPort: config.mediasoup.recording.audioPortRtcp,
    });

    console.log(
      "mediasoup AUDIO RTP SEND transport connected: %s:%d <--> %s:%d (%s)",
      rtpTransport.tuple.localIp,
      rtpTransport.tuple.localPort,
      rtpTransport.tuple.remoteIp,
      rtpTransport.tuple.remotePort,
      rtpTransport.tuple.protocol
    );

    console.log(
      "mediasoup AUDIO RTCP SEND transport connected: %s:%d <--> %s:%d (%s)",
      rtpTransport.rtcpTuple.localIp,
      rtpTransport.rtcpTuple.localPort,
      rtpTransport.rtcpTuple.remoteIp,
      rtpTransport.rtcpTuple.remotePort,
      rtpTransport.rtcpTuple.protocol
    );

    const rtpConsumer = await rtpTransport.consume({
      producerId: guide.audioproducer.id,
      rtpCapabilities: router.rtpCapabilities, // Assume the recorder supports same formats as mediasoup's router
      paused: true,
    });
	recordRtp.audioConsumer = rtpConsumer;

	consumers.audio = rtpConsumer;

    console.log(
      "mediasoup AUDIO RTP SEND consumer created, kind: %s, type: %s, paused: %s, SSRC: %s CNAME: %s",
      rtpConsumer.kind,
      rtpConsumer.type,
      rtpConsumer.paused,
      rtpConsumer.rtpParameters.encodings[0].ssrc,
      rtpConsumer.rtpParameters.rtcp.cname
    );
  }

  if (useVideo) {
    const rtpTransport = await router.createPlainTransport({
      // No RTP will be received from the remote side
      comedia: false,

      // FFmpeg and GStreamer don't support RTP/RTCP multiplexing ("a=rtcp-mux" in SDP)
      rtcpMux: false,

      ...config.mediasoup.plainTransport,
    });
	recordRtp.videoTransport = rtpTransport;

    await rtpTransport.connect({
      ip: config.mediasoup.recording.ip,
      port: config.mediasoup.recording.videoPort,
      rtcpPort: config.mediasoup.recording.videoPortRtcp,
    }); 


    console.log(
      "mediasoup VIDEO RTP SEND transport connected: %s:%d <--> %s:%d (%s)",
      rtpTransport.tuple.localIp,
      rtpTransport.tuple.localPort,
      rtpTransport.tuple.remoteIp,
      rtpTransport.tuple.remotePort,
      rtpTransport.tuple.protocol
    );

    console.log(
      "mediasoup VIDEO RTCP SEND transport connected: %s:%d <--> %s:%d (%s)",
      rtpTransport.rtcpTuple.localIp,
      rtpTransport.rtcpTuple.localPort,
      rtpTransport.rtcpTuple.remoteIp,
      rtpTransport.rtcpTuple.remotePort,
      rtpTransport.rtcpTuple.protocol
    );

    const rtpConsumer = await rtpTransport.consume({
      producerId: guide.videoproducer.id,
      rtpCapabilities: router.rtpCapabilities, // Assume the recorder supports same formats as mediasoup's router
      paused: true,
    });
	recordRtp.videoConsumer = rtpConsumer;

	consumers.video = rtpConsumer;

    console.log(
      "mediasoup VIDEO RTP SEND consumer created, kind: %s, type: %s, paused: %s, SSRC: %s CNAME: %s",
      rtpConsumer.kind,
      rtpConsumer.type,
      rtpConsumer.paused,
      rtpConsumer.rtpParameters.encodings[0].ssrc,
      rtpConsumer.rtpParameters.rtcp.cname
    );
  }
  
  fs.writeFile("input-h264.sdp", createSdpText(consumers), err => { console.log(err) });

  // ----

  switch (recorder) {
    case "ffmpeg":
      await startRecordingFfmpeg(useAudio, useVideo);
      break;
    case "gstreamer":
      await startRecordingGstreamer();
      break;
    case "external":
      await startRecordingExternal();
      break;
    default:
      console.warn("Invalid recorder:", recorder);
      break;
  }

  if (useAudio) {
    const consumer = recordRtp.audioConsumer;
    console.log(
      "Resume mediasoup RTP consumer, kind: %s, type: %s",
      consumer.kind,
      consumer.type
    );
    consumer.resume();
  }
  if (useVideo) {
    const consumer = recordRtp.videoConsumer;
    console.log(
      "Resume mediasoup RTP consumer, kind: %s, type: %s",
      consumer.kind,
      consumer.type
    );
    consumer.resume();
  }
}

function getCodecInfoFromRtpParameters(kind, rtpParameters) {
	return {
	  payloadType: rtpParameters.codecs[0].payloadType,
	  codecName: rtpParameters.codecs[0].mimeType.replace(`${kind}/`, ''),
	  clockRate: rtpParameters.codecs[0].clockRate,
	  channels: kind === 'audio' ? rtpParameters.codecs[0].channels : undefined
	};
  };



function createSdpText(consumers) {
	const { video, audio } = consumers;

	console.log(video.rtpParameters);

	
	// Video codec info
	const videoCodecInfo = getCodecInfoFromRtpParameters('video', video.rtpParameters);
  
	// Audio codec info
	const audioCodecInfo = getCodecInfoFromRtpParameters('audio', audio.rtpParameters);
  
	return `v=0
	o=- 0 0 IN IP4 127.0.0.1
	s=FFmpeg
	c=IN IP4 127.0.0.1
	t=0 0
	m=video ${video.remoteRtpPort} RTP/AVP ${videoCodecInfo.payloadType} 
	a=rtpmap:${videoCodecInfo.payloadType} ${videoCodecInfo.codecName}/${videoCodecInfo.clockRate}
	a=sendonly
	m=audio ${audio.remoteRtpPort} RTP/AVP ${audioCodecInfo.payloadType} 
	a=rtpmap:${audioCodecInfo.payloadType} ${audioCodecInfo.codecName}/${audioCodecInfo.clockRate}/${audioCodecInfo.channels}
	a=sendonly
	`;
  };

function stopMediasoupRtp() {
	console.log("I should stop the transport for recording!");
}

// ----

/* FFmpeg recording
 * ================
 *
 * The intention here is to record the RTP stream as is received from
 * the media server, i.e. WITHOUT TRANSCODING. Hence the "codec copy"
 * commands in FFmpeg.
 *
 * ffmpeg \
 *     -nostdin \
 *     -protocol_whitelist file,rtp,udp \
 *     -fflags +genpts \
 *     -i recording/input-vp8.sdp \
 *     -map 0:a:0 -c:a copy -map 0:v:0 -c:v copy \
 *     -f webm -flags +global_header \
 *     -y recording/output-ffmpeg-vp8.webm
 *
 * NOTES:
 *
 * '-map 0:x:0' ensures that one media of each type is used.
 *
 * FFmpeg 2.x (Ubuntu 16.04 "Xenial") does not support the option
 * "protocol_whitelist", but it is mandatory for FFmpeg 4.x (newer systems).
 */

import * as Process from 'child_process';

function startRecordingFfmpeg(useAudio, useVideo) {
	// Return a Promise that can be awaited
	let recResolve;
	const promise = new Promise((res, _rej) => {
	  recResolve = res;
	});
  
	//const useAudio = audioEnabled();
	//const useVideo = videoEnabled();
	const useH264 = true; //h264Enabled();
  
	const cmdProgram = "ffmpeg"; // Found through $PATH
	//const cmdProgram = FFmpegStatic; // From package "ffmpeg-static"
	//console.log(cmdProgram);
  
	let cmdInputPath = `${__dirname}/recording/input-vp8.sdp`;
	let cmdOutputPath = `${__dirname}/recording/output-ffmpeg-vp8.webm`;
	let cmdCodec = "";
	let cmdFormat = "-f webm -flags +global_header";
  
	// Ensure correct FFmpeg version is installed
	const ffmpegOut = Process.execSync(cmdProgram + " -version", {
	  encoding: "utf8",
	});
	const ffmpegVerMatch = /ffmpeg version (\d+)\.(\d+)\.(\d+)/.exec(ffmpegOut);
	let ffmpegOk = false;
	if (ffmpegOut.startsWith("ffmpeg version git")) {
	  // Accept any Git build (it's up to the developer to ensure that a recent
	  // enough version of the FFmpeg source code has been built)
	  ffmpegOk = true;
	} else if (ffmpegVerMatch) {
	  const ffmpegVerMajor = parseInt(ffmpegVerMatch[1], 10);
	  if (ffmpegVerMajor >= 4) {
		ffmpegOk = true;
	  }
	}
  
	if (!ffmpegOk) {
	  console.error("FFmpeg >= 4.0.0 not found in $PATH; please install it");
	  process.exit(1);
	}
  
	if (useAudio) {
	  cmdCodec += " -map 0:a:0 -c:a copy";
	}
	if (useVideo) {
		cmdCodec += " -map 0:v:0 -c:v copy";

		if (useH264) {
			cmdInputPath = `${__dirname}/input-h264.sdp`;
			cmdOutputPath = `${__dirname}/output-ffmpeg-h264.mp4`;
	
			// "-strict experimental" is required to allow storing
			// OPUS audio into MP4 container
			cmdFormat = "-f mp4 -strict experimental";
		}
	}
  
	// Run process
	const cmdArgStr = [
	  "-nostdin",
	  "-protocol_whitelist file,rtp,udp",
	  // "-loglevel debug",
	  // "-analyzeduration 5M",
	  // "-probesize 5M",
	  "-fflags +genpts",
	  `-i ${cmdInputPath}`,
	  cmdCodec,
	  cmdFormat,
	  `-y ${cmdOutputPath}`,
	]
	  .join(" ")
	  .trim();
  
	console.log(`Run command: ${cmdProgram} ${cmdArgStr}`);
  
	let recProcess = Process.spawn(cmdProgram, cmdArgStr.split(/\s+/));
	global.recProcess = recProcess;
  
	recProcess.on("error", (err) => {
	  console.error("Recording process error:", err);
	});
  
	recProcess.on("exit", (code, signal) => {
	  console.log("Recording process exit, code: %d, signal: %s", code, signal);
  
	  global.recProcess = null;
	  stopMediasoupRtp();
  
	  if (!signal || signal === "SIGINT") {
		console.log("Recording stopped");
	  } else {
		console.warn(
		  "Recording process didn't exit cleanly, output file might be corrupt"
		);
	  }
	});
  
	// FFmpeg writes its logs to stderr
	recProcess.stderr.on("data", (chunk) => {
	  chunk
		.toString()
		.split(/\r?\n/g)
		.filter(Boolean) // Filter out empty strings
		.forEach((line) => {
		  console.log(line);
		  if (line.startsWith("ffmpeg version")) {
			setTimeout(() => {
			  recResolve();
			}, 1000);
		  }
		});
	});
  
	return promise;
  }