import { Tour } from './tour.js'
import { StreamClient } from './stream_client.js'

class TouristTour extends Tour {
	constructor(container, panourl, serverurl, socketpath) {
		super(container, panourl, serverurl, socketpath);

		this.guideView = null;  
		this.following = true;  //only when following
		this.looking = false; //looking around while following?
		this.lookingIdle = 3000; //if looking and idle for this ms, return to follow.
		this.followTimeout = false; //timeout when changing view to refollow.
		this.locked = true;
		this.muted = true;
		this.eyesOnGuide = false;
		this.status = {};
		this.streamClient.addEvent('follow', status => 	{
			if(status.view)
				this.status.view = status.view;
			if(status.highlight !== null)
				this.status.highlight = status.highlight;
				
			this.status.action =  status.action;
			if(status.action === 'infoshown') 	
				this.status.imgurl = status.imgurl;
			if(status.eyestome !== null)
				this.status.eyestome = status.eyestome;
			if(status.action === 'panzoom'){
					var sBB  = this.panorama.window.pz.getBoundingBox();
					var sizex = sBB.right-sBB.left; 
					var sizey = sBB.bottom-sBB.top;
					status.transform.x *= sizex;
					status.transform.y *= sizey;
					this.panorama.window.pz.setTransform(status.transform);
			}	
				
		   
			this.follow(); 
		});

		this.streamClient.addEvent('connected', () => {
			//console.log("SHARING AUDIO");
			//this.streamClient.shareMedia(StreamClient.AUDIO);
		});

		this.userTalk = document.querySelector('#user_talk');
		this.userMute = document.querySelector('#user_mute');

		document.addEventListener('click', (event) => {
			if(this.locked)
				return;

			if (event.target.closest('#user_talk')) {
				this.mute(false);
			} else if(event.target.closest('#user_mute')) {
				this.unmute();
			}
		});
		this.streamClient.addEvent('mute', (id) => { 
			if(id == this.streamClient.id)
				this.mute(true);
		 });
		 this.streamClient.addEvent('unmute', (id) => { 
			if(id == this.streamClient.id)
				this.unmute();
		 });

	}

	mute(disable) {
		this.talkEnabled(false);
		this.streamClient.unshareMedia(StreamClient.AUDIO);
		this.userTalk.style.display = 'none';
		this.userMute.style.display = 'block';
		this.muted = true;
	}

	unmute() {
		this.talkEnabled(true);
		this.streamClient.shareMedia(StreamClient.AUDIO);
		this.userTalk.style.display = 'block';
		this.userMute.style.display = 'none';
		this.muted = false;
	}

	talkEnabled(enable) {
		this.userTalk.classList.toggle(enable);
		this.userMute.classList.toggle(enable);
	}

	updateUsers(users) {
		super.updateUsers(users);
		for(let user of Object.values(users)) {
			if(user.id != this.streamClient.id)
				continue;
			if(user.muted && this.muted == false)
				this.mute();

			this.locked = user.locked;
			this.userMute.classList.toggle('disabled', user.locked);
		}
	}

	async subscribe(e) {
		
		if(!this.connected)
			return;

		this.stream = await this.streamClient.subscribe(e);
		if(!this.stream)
			return;
		let video = document.querySelector('#users_video video');
		video.srcObject = this.stream;
		
		await this.streamClient.resume();
	}

	wheelEvent(e) {
		super.wheelEvent(e);
		this.lookaround();
	}

	viewChange(e) {
		super.viewChange(e);
		this.lookaround();
	}

	panoClicked(e) {
		if(this.following)
			this.streamClient.sendMsg('unfollow', this.status);
		
		this.following = false;
		this.looking = false;
		clearTimeout(this.followTimeout);
		document.querySelector('.tour-guide').classList.toggle('follow', false);

	}

	lookaround() {
		if(!this.following)
			return;

		this.looking = true;
		this.following = false;
		document.querySelector('.tour-guide').classList.toggle('follow', false);
		clearTimeout(this.followTimeout);
		this.followTimeout = setTimeout(() => { this.looking = false; this.follow(); }, this.lookingIdle);
	}

	follow() {
		if(!this.status)
			return;
			
		if(this.status.eyestome)
			{
			 	this.panorama.viewer.setEyesOnGuide(this.status.eyestome===true);
			 	this.following = this.status.eyestome; 
			 	if(!this.eyesOnGuide){
			 	 	this.panorama.viewer.loadScene(this.panorama.viewer.getScene());
			 	 	this.eyesOnGuide = true;
			 	 }
			 }else
			 this.eyesOnGuide = false;
	  				

		this.tools.laser.classList.toggle('laser', this.status.highlight !== null);

		if(this.following === true && this.looking !== true) {
			document.querySelector('.tour-guide').classList.toggle('follow', true);
			this.panorama.setStatus(this.status, 100);
		}
	}



	initToolbar() {
		super.initToolbar();
		this.tools.guide.addEventListener('click', (e) => {
			this.following = !this.following;
			this.looking = false;
			document.querySelector('.tour-guide').classList.toggle('follow', this.following);
			this.streamClient.sendMsg(this.following? 'following' : 'unfollow', this.status);
			
			if(this.following)
				this.follow();		
		});
		this.tools.raise.addEventListener('click', (e) => { this.raise() });

	}

	raise() {
		this.raised = !this.raised;
		this.tools.raise.classList.toggle('raised', this.raised);
		this.streamClient.sendMsg('raise', this.raised);
	}

}

export { TouristTour }
