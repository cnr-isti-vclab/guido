
//const mediasoup = require('mediasoup-client');
//const socketClient = require('socket.io-client');
//const socketPromise = require('./lib/socket.io-promise').promise;
//const config = require('./config');

import { Mutex } from 'async-mutex'
import { addSignals } from './signals.js'
import * as mediasoup from 'mediasoup-client'
import { io as socketClient } from 'socket.io-client';


const hostname = window.location.hostname;

let device;
let socket;
let producer;

class StreamClient {
	static CAMERA = 1;
	static AUDIO = 2;
	static SCREEN = 4;
	constructor(url, path) {
		this.url = url;
		this.path = path;
		this.init();
		//setTimeout(()=> { this.shareMedia(StreamClient.CAMERA | StreamClient.AUDIO) }, 2000);
		//setTimeout(()=> { this.subscribe() }, 3000);
	}
	
	init() {
		//we cannot share screen
		if(typeof navigator.mediaDevices == 'undefined') {
			console.log("Security problem: mediaDevices is undefined");
		}
		if (typeof navigator.mediaDevices.getDisplayMedia === 'undefined') {
			
			console.log("Security problem: getDisplayMedia is undefined");
		}

		let socket = this.socket = socketClient(this.url, { path: this.path, transports: ['websocket'] });

		socket.request = function(type, data = {}) {
			return new Promise((resolve) => {
			  socket.emit(type, data, resolve);
			});
		};

		socket.on('connect', async (e) => {
			console.log('connetct', e);
			this.emit('connected');			
		});

		socket.on('id', (id) => {console.log("ID", id); this.id = id; });

		socket.on('connect_error', (error) => {
			let errorMsg = `could not connect to ${this.url}${this.path}: ${error.message}`;
			this.emit('connect error', errorMsg);
		});

		socket.on('disconnect', () => { 
			this.emit('disconnected');
		 }); 

		//here we know someone is streaming.
		socket.on('streaming', (e) => { 
			console.log('stream new prooducer: ', e.kind);
			this.emit('streaming', e);
		 });

		 socket.on('unstreaming', e => {
			 console.log('unstreaming', e);
			 this.emit('unstreaming', e);
		 });

		 socket.on('users', (users) => { console.log('users', users); this.emit('users', users); });
		 socket.on('chat', (msg) => { this.emit('chat', msg); });
		 socket.on('follow', (status) => { this.emit('follow', status); });
	}
	
	sendMsg(key, value) {
		this.socket.emit(key, value);
	}
	async unshareMedia(source) {
		let kind = null;
		if((source & (StreamClient.SCREEN | StreamClient.CAMERA)) != 0 && this.videoproducer) {
			this.videoproducer.close();
			this.videoproducer = null;
			kind = 'video';
		}
		if((source & StreamClient.AUDIO) != 0 && this.audioproducer) {
			this.audioproducer.close();
			this.audioproducer = null;
			kind = 'audio';
		}
		if(kind) {
			await this.socket.request('unproduce', {
				transportId: this.sendTransport.id,
				kind 
			});
		}
	}

	//video, vide+audio, screen
	async shareMedia(source) {
		await this.loadDevice();

		console.log('SHARING MEDIA: ', source);
		if(!source) return;

		let needsScreen = (source & StreamClient.SCREEN) != 0;
		let needsCamera = (source & StreamClient.CAMERA) != 0;
		let needsAudio  = (source & StreamClient.AUDIO)  != 0;

		//cant share screen and camera at the same time
		console.assert(!needsScreen  && (needsCamera || needsAudio));

		if ((needsCamera || needsScreen) && !this.device.canProduce('video')) {
			console.error('cannot produce video');
			//emit some error! but  should be checked beforehand!
			return;
		}

		if (needsAudio && !this.device.canProduce('audio')) {
			console.error('cannot produce audio');
			return;
		}


		try {
			let stream;
			if(needsScreen)
				stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
			else
				stream = await navigator.mediaDevices.getUserMedia({ video: needsCamera, audio: needsAudio });

			if(needsAudio) {
				const audiotrack = stream.getAudioTracks()[0];
				this.audioproducer = await this.publish(stream, audiotrack);
			}
			if(needsCamera || needsScreen) {
				const videotrack = stream.getVideoTracks()[0];
				this.videoproducer = await this.publish(stream, videotrack);
			}
			this.emit('published', stream);
			
		} catch (err) {
			//emit error
		}
	}

	async publish(stream, track) {
		
		this.emit('publishing');

		if(!this.sendTransport) {

			const data = await this.socket.request('createProducerTransport', {
				forceTcp: false,
				rtpCapabilities: this.device.rtpCapabilities,
			});
	
			if (data.error) {
				console.error(data.error);
				this.emit('publish error', data.error);
				//emit error of some kind
				return;
			}

			let transport = this.sendTransport = this.device.createSendTransport(data);
			transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
				console.log('requesting tansport connect');
				this.socket.request('connectProducerTransport', { dtlsParameters })
				.then(() => { console.log('answered'); callback(); })
				.catch(errback);
			});

			transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
				try {
					const { id } = await this.socket.request('produce', {
						transportId: transport.id,
						kind,
						rtpParameters,
					});
					callback({ id });
					//this.emit('published');
				} catch (err) {
					errback(err);
					this.emit('publish error', 'Failed to create transport');
				}
			});

			transport.on('connectionstatechange', (state) => {
				switch (state) {
				case 'connecting': //emit publishing
				break;

				case 'connected': //emit published 
					//coonnect the video tag to the stream. 
					//document.querySelector('#local_video').srcObject = stream;
					
				break;

				case 'failed': 
					transport.close();
					this.emit('publish error', 'Failed to connect transport');
					//emit som error
				break;
				}
			});
		}
		console.log("going to produce");
		return await this.sendTransport.produce({ track });
	}

	async loadDevice() {
		const routerRtpCapabilities = await this.getRtpCapabilities();

		if(!this.devicePromise) {
			try {
				this.device = new mediasoup.Device();
			} catch (error) {
				if (error.name === 'UnsupportedError') {
					console.error('browser not supported');
				}
			}
			this.devicePromise = this.device.load({ routerRtpCapabilities });
		}

		await this.devicePromise;
		return this.device;
	}

	async getRtpCapabilities() {
		if(this.routerRtpCapabilities)
			return this.routerRtpCapabilities;
			
		if(!this.routerRtpCapabilitiesPromise)
			this.routerRtpCapabilitiesPromise = this.socket.request('getRouterRtpCapabilities');

		return this.routerRtpCapabilities = await this.routerRtpCapabilitiesPromise;
	}


	async subscribe(event) {
		await this.loadDevice();

		//multiple subscribe while creating or connecting the transport will end up in creating multiple transports!
		/*if(this.transport === true || (this.transport && this.transport.connected !== true)) {
			setTimeout(() =>  { this.subscribe(event) }, 100);
			return;
		}*/
		if(!this.transportdatapromise) {
			this.transportdatapromise = this.socket.request('createConsumerTransport', {
				forceTcp: false,
			});
		}
		this.transportdata = await this.transportdatapromise;

		if (this.transportdata.error) {
			console.error(this.transportdata.error);
			//emit error!
			return;
		}

		if(!this.transport) {
			console.log('creating transport');
	
			let transport = this.device.createRecvTransport(this.transportdata);
			
			transport.on('connect', ({ dtlsParameters }, callback, errback) => {
				console.log('requesting consume transport');
				this.socket.request('connectConsumerTransport', {
					transportId: this.transport.id,
					dtlsParameters
				})
				.then(() => { callback(); })
				.catch(() => { errback(); });
			});

			transport.on('connectionstatechange', async (state) => {
				switch (state) {
					case 'connecting':
						console.log('transport connecting');
						this.emit('subscribing');
						break;

					case 'connected':
						console.log('transport connected');
						break;

					case 'failed':
						console.log('transport connection failed');
						transport.close();
						transport = null;
						this.emit('subscribe error');
						reject();
						break;

					default: break;
					}
			});
			transport.mutex = new Mutex();
			this.transport = transport;
		}

		const release = await this.transport.mutex.acquire();
		let stream = await this.consume(this.transport, event);
		await this.resume();
		release();
		return stream;
	}

	async unsubscribe(event) {
	}

	async resume() {
		await this.socket.request('resume');
	}

	async consume(transport, event) {

		if(!this.stream)
			this.stream = new MediaStream();

		const { rtpCapabilities } = this.device;
		//if(event.kind == 'audio') {
			const data = await this.socket.request('consume', { kind: event.kind, rtpCapabilities, client: event.id });
			if(data.error) {
				console.error("Consume error: ", data.error);
				return null;	
			}
			const {
				producerId,
				id,
				kind,
				rtpParameters,
			} = data;
		
			let codecOptions = {};
			const consumer = await transport.consume({
				id,
				producerId,
				kind,
				rtpParameters,
				codecOptions,
			});
			consumer.track.clientId = event.id;
			if(consumer.track.kind == 'video') {
				let videos = this.stream.getVideoTracks();
				for(let video of videos)
					this.stream.removeTrack(video);
			}
			this.stream.addTrack(consumer.track);
		//}

/*
		if(event.kind == 'video') {
			const data = await this.socket.request('consume', { kind: 'video', rtpCapabilities, client: event.id });
			const {
				producerId,
				id,
				kind,
				rtpParameters,
			} = data;
		
			console.log('kind', kind);
			console.log('requested consume');
			let codecOptions = {};
			const consumer = await transport.consume({
				id,
				producerId,
				kind,
				rtpParameters,
				codecOptions,
			});
			console.log('transport consume video');
			consumer.track.user =event.id;
			this.stream.addTrack(consumer.track);

		}*/

		return this.stream;
	}
}

addSignals(StreamClient, 
	'connecting', 'connected', 'disconnected', 'connect error',
	'streaming', 'unstreaming',
	'publishing', 'published', 'unpublished', 'publish error',
	'subscribing', 'subscribed', 'subscribe error',
	'mute', 'unmute', //guide allowing users to talk and unmuting them.
	'users', 'chat', 'follow');

export { StreamClient }


//const serverUrl = `https://${hostname}:${config.listenPort}`;

//let client = new Client(serverUrl, '/server');

/*


const $ = document.querySelector.bind(document);
const $fsPublish = $('#fs_publish');
const $fsSubscribe = $('#fs_subscribe');
const $btnConnect = $('#btn_connect');
const $btnWebcam = $('#btn_webcam');
const $btnScreen = $('#btn_screen');
const $btnSubscribe = $('#btn_subscribe');
const $chkSimulcast = $('#chk_simulcast');
const $txtConnection = $('#connection_status');
const $txtWebcam = $('#webcam_status');
const $txtScreen = $('#screen_status');
const $txtSubscription = $('#sub_status');
let $txtPublish;

$btnConnect.addEventListener('click', connect);
$btnWebcam.addEventListener('click', publish);
$btnScreen.addEventListener('click', publish);
$btnSubscribe.addEventListener('click', subscribe);

if (typeof navigator.mediaDevices.getDisplayMedia === 'undefined') {
	$txtScreen.innerHTML = 'Not supported';
	$btnScreen.disabled = true;
}

async function connect() {
	$btnConnect.disabled = true;
	$txtConnection.innerHTML = 'Connecting...';

	const opts = {
		path: '/server',
		transports: ['websocket'],
	};

	const serverUrl = `https://${hostname}:${config.listenPort}`;
	socket = socketClient(serverUrl, opts);
	socket.request = socketPromise(socket);

	socket.on('connect', async () => {
		$txtConnection.innerHTML = 'Connected';
		$fsPublish.disabled = false;
		$fsSubscribe.disabled = false;

		const data = await socket.request('getRouterRtpCapabilities');
		await loadDevice(data);
	});

	socket.on('disconnect', () => {
		$txtConnection.innerHTML = 'Disconnected';
		$btnConnect.disabled = false;
		$fsPublish.disabled = true;
		$fsSubscribe.disabled = true;
	});

	socket.on('connect_error', (error) => {
		console.error('could not connect to %s%s (%s)', serverUrl, opts.path, error.message);
		$txtConnection.innerHTML = 'Connection failed';
		$btnConnect.disabled = false;
	});

	socket.on('newProducer', () => {
		$fsSubscribe.disabled = false;
	});
}

async function loadDevice(routerRtpCapabilities) {
	try {
		device = new mediasoup.Device();
	} catch (error) {
		if (error.name === 'UnsupportedError') {
			console.error('browser not supported');
		}
	}
	await device.load({ routerRtpCapabilities });
}

async function publish(e) {
	const isWebcam = (e.target.id === 'btn_webcam');
	$txtPublish = isWebcam ? $txtWebcam : $txtScreen;subscribe
		forceTcp: false,
		rtpCapabilities: device.rtpCapabilities,
	});
	if (data.error) {
		console.error(data.error);
		return;
	}

	const transport = device.createSendTransport(data);
	transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
		socket.request('connectProducerTransport', { dtlsParameters })
			.then(callback)
			.catch(errback);
	});

	transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
		try {
			const { id } = await socket.request('produce', {
				transportId: transport.id,
				kind,
				rtpParameters,, client.consumer
			});
			callback({ id });
		} catch (err) {
			errback(err);
		}
	});

	transport.on('connectionstatechange', (state) => {
		switch (state) {
			case 'connecting':
				$txtPublish.innerHTML = 'publishing...';
				$fsPublish.disabled = true;
				$fsSubscribe.disabled = true;
			break;

			case 'connected':
				document.querySelector('#local_video').srcObject = stream;
				$txtPublish.innerHTML = 'published';
				$fsPublish.disabled = true;
				$fsSubscribe.disabled = false;
			break;

			case 'failed':
				transport.close();
				$txtPublish.innerHTML = 'failed';
				$fsPublish.disabled = false;
				$fsSubscribe.disabled = true;
			break;

			default: break;
		}
	});

	let stream;
	try {
		stream = await getUserMedia(transport, isWebcam);
	console.log(audiotrack);
		const track = stream.getVideoTracks()[0];
		const params = { track };
		if ($chkSimulcast.checked) {
			params.encodings = [
				{ maxBitrate: 100000 },
				{ maxBitrate: 300000 },
				{ maxBitrate: 900000 },
			];
			params.codecOptions = {
				videoGoogleStartBitrate : 1000
			};
		}
		producer = await transport.produce(params);

//	const audiotrack = stream.getAudioTracks()[0];
	} catch (err) {
		$txtPublish.innerHTML = 'failed';
	}
}

async function getUserMedia(transport, isWebcam) {
	if (!device.canProduce('video')) {
		console.error('cannot produce video');
		return;
	}, client.consumer

	console.log("Getting media");
	let stream;
	try {
		stream = isWebcam ?
			await navigator.mediaDevices.getUserMedia({ video: true, audio: true }) :
			await navigator.mediaDevices.getDisplayMedia({ video: true });
	} catch (err) {
		console.error('getUserMedia() failed:', err.message);
		throw err;
	}
	return stream;
}

async function subscribe() {
	const data = await socket.request('createConsumerTransport', {
		forceTcp: false,
	});
	if (data.error) {
		console.error(data.error);
		return;
	}

	const transport = device.createRecvTransport(data);
	transport.on('connect', ({ dtlsParameters }, callback, errback) => {
		socket.request('connectConsumerTransport', {
			transportId: transport.id,
			dtlsParameters
		})
			.then(callback)
			.catch(errback);
	});

	transport.on('connectionstatechange', async (state) => {
		switch (state) {
			case 'connecting':
				$txtSubscription.innerHTML = 'subscribing...';
				$fsSubscribe.disabled = true;
				break;

			case 'connected':
				document.querySelector('#remote_video').srcObject = await stream;
				await socket.request('resume');
				$txtSubscription.innerHTML = 'subscribed';
				$fsSubscribe.disabled = true;
				break;

			case 'failed':
				transport.close();
				$txtSubscription.innerHTML = 'failed';
				$fsSubscribe.disabled = false;
				break;

			default: break;
		}
	});

	const stream = consume(transport);
}

async function consume(transport) {
	const { rtpCapabilities } = device;
	const data = await socket.request('consume', { rtpCapabilities });
	const {
		producerId,
		id,
		kind,
		rtpParameters,
	} = data;

	let codecOptions = {};
	const consumer = await transport.consume({
		id,
		producerId,
		kind,
		rtpParameters,
		codecOptions,
	});
	const stream = new MediaStream();
	stream.addTrack(consumer.track);
	return stream;
}
*/