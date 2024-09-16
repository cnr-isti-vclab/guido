import { Tour } from './tour.js'
import { StreamClient } from './stream_client.js'

class GuideTour extends Tour {
	constructor(container, panourl, serverurl, socketpath) {
		super(container, panourl, serverurl, socketpath);


		this.panorama.addEvent('highlight_on',   (coords) => this.highlightOn(coords));
		this.panorama.addEvent('highlight_move', (coords) => this.highlightMove(coords));
		this.panorama.addEvent('highlight_off',  (coords) => this.highlightOff(coords));
		this.panorama.addEvent('panzooming',  (transform) => {
				var sBB  = this.panorama.window.pz.getBoundingBox();
				var sizex = sBB.right-sBB.left; 
				var sizey = sBB.bottom-sBB.top;
				var x = transform.x / sizex; 
				var y = transform.y / sizey; 
		
				this.sendStatus({ action: 'panzoom', transform: {scale:transform.scale,x:x,y:y} });}
		);

		this.streamClient.addEvent('publishing', () => { console.log('publishing'); });
		this.streamClient.addEvent('publish error', (e) => { console.log('publish error', e); });

		this.streamClient.addEvent('connected', () => {
			this.streamClient.sendMsg('guide', 'keyplaceholder');
		});

		document.addEventListener('DOMContentLoaded', e => {
			document.querySelector('#guide_video').style.display = 'flex';
			document.querySelector('#users_video').style.display = 'none';
		});
		document.addEventListener('click', (event) => {
			if (event.target.closest('#guide_talk')) {
				this.streamClient.unshareMedia(StreamClient.AUDIO);
				if(this.stream) {
					let audio = this.stream.getAudioTracks();
					if(audio.length)
						this.stream.removeTrack(audio[0]);
				}
				document.querySelector('#guide_talk').style.display = 'none';
				document.querySelector('#guide_mute').style.display = 'block';
			} else if(event.target.closest('#guide_mute')) {
				this.streamClient.shareMedia(StreamClient.AUDIO);
				document.querySelector('#guide_talk').style.display = 'block';
				document.querySelector('#guide_mute').style.display = 'none';
			} else if(event.target.closest('#guide_see')) {
				this.streamClient.unshareMedia(StreamClient.CAMERA);	
				document.querySelector('#guide_see').style.display = 'none';
				document.querySelector('#guide_blind').style.display = 'block';
				if(this.stream) {
					let video= this.stream.getVideoTracks();
					if(video.length)
						this.stream.removeTrack(video[0]);
				}
			} else if(event.target.closest('#guide_blind')) {
				this.streamClient.shareMedia(StreamClient.CAMERA);
				document.querySelector('#guide_see').style.display = 'block';
				document.querySelector('#guide_blind').style.display = 'none';
			}
		});

		document.addEventListener('click', (event) => {
			let li = event.target.closest('#tour-users > li');
			if(!li)
				return;
			let user = li.getAttribute('data-user');

			if(event.target.closest('.user-lock')) {
				this.streamClient.sendMsg('unlock', user);
			}
			if(event.target.closest('.user-unlock')) {
				this.streamClient.sendMsg('mute', user);
			}
		});

		this.streamClient.addEvent('published', stream => {
			if(!this.stream)
				this.stream = new MediaStream();
			for(let track of stream.getTracks())
				this.stream.addTrack(track);
			let video = document.querySelector('#guide_video video');
			video.srcObject = this.stream; 
			video.muted = true;
		});

		this.guide = true;
		this.keepLaserAlive = false;
		this.eyestomeOn = false;
	}


	initToolbar() {
		super.initToolbar();
		//this.tools.options.classList.remove('hidden');
		this.tools.laser.classList.remove('hidden');
		this.tools.eyestome.classList.remove('hidden');
		this.tools.talk.classList.add('hidden');

		this.tools.guide.classList.add('hidden');
		this.tools.raise.classList.add('hidden');
		//this.tools.raise.addEventListener('click', (e) => { this.showSection('users') });
		this.tools.laser.addEventListener('click', (e) => { 
			this.keepLaserAlive = !this.keepLaserAlive; 
			this.tools.laser.classList.toggle('laser', this.keepLaserAlive);
			if(!this.keepLaserAlive) {
				this.panorama.removeHighlight();
				this.sendStatus({ action: "highlight_off", highlight: false });
			}
		});
		this.tools.eyestome.addEventListener('click', (e) => { 
			this.eyestomeOn = !this.eyestomeOn; 
			this.tools.eyestome.classList.toggle('eyestome', this.eyestomeOn);
			this.sendStatus({ eyestome: 'eyestome', eyestomevalue: this.eyestomeOn });
			this.panorama.emit('viewchange',{});
		});
	}

	async subscribe(e) {
		if(!this.connected)
			return;

		this.stream = await this.streamClient.subscribe(e);
		if(!this.stream)
			return;
		
			console.assert(e.kind == 'audio', "Unexpected video incoming!");

		let audio = document.querySelector('#users_video video');
		audio.srcObject = this.stream;

		await this.streamClient.resume();
	}
	
	updateUsers(users) {
		let count = Object.values(users).filter(u => u.raised).length;
		this.tools.raise.setAttribute('badge', count);
		
		const element = document.getElementById('question-alert');
		if(count>0) 
		  element.hidden = false;  
		else
		  element.hidden = true;  
		
		super.updateUsers(users);
	}

	panoClicked(e) {
		this.panorama.removeHighlight();
	}

	
	highlightOn(coords) {
		this.panorama.moveHighlight(coords);
		this.sendStatus({ action: "highlight_on", highlight: this.panorama.getHighlight() });

	}
	highlightOff(coords) {
		if(!this.keepLaserAlive) {
			this.panorama.removeHighlight(coords);
			this.sendStatus({ action: "highlight_off", highlight: false });
		}
	}
	highlightMove(coords) {
		this.panorama.moveHighlight(coords);
		this.sendStatus({ action: 'highlight_move', highlight: this.panorama.getHighlight() });
	}

	viewChange(e) {
		this.sendStatus({ action: 'viewchange', view: this.panorama.getView(), highlight: this.panorama.getHighlight(), eyestome: this.eyestomeOn });
	}
		//the changes are sent to the server
/*	track() {
		let resolution = 100; //ms
		let status = this.panorama.getStatus();
		
		//send a status at most once every 100 milliseconds.
		clearTimeout(this.timeout);
		let now = new Date().getTime();
		let elapsed = now - this.lastTrack.stamp;

		if(elapsed < resolution) {
			this.timeout = setTimeout(() => {
				this.lastTrack = status;
				this.sendStatus(status);
			}, resolution - elapsed);
			return;
		}
		
		this.lastTrack = status;
		this.sendStatus(status);
	} 

	sendStatus(status) {
		if(!status)
			status = this.panorama.getStatus();
		this.streamClient.socket.emit('follow', status );
	} */

}

export { GuideTour }
