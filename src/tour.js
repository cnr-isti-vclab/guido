import { io } from "socket.io-client";
import { simplify, smooth, smoothToPath } from './simplify.js'

import { getIcon, getIcons, createElement, createSvgElement } from './utils.js'
import { Panorama } from './panorama.js' 
import { StreamClient } from './stream_client.js'


class Tour {
	constructor(container, panourl, serverurl, socketpath) {
		if(typeof(container) == 'string')
			container = document.querySelector(container);
		this.container = container;

		this.guide = false;
		this.serverurl = serverurl;
		this.socketpath = socketpath;
		this.connected = false;

		this.maxPriority = 0; //only show toplevel entries


		this.panorama = new Panorama(panourl, container);
		this.panorama.addEvent('loaded',      () => this.createEntries(this.panorama.panos));
		this.panorama.addEvent('zoomchange',  (e) => this.zoomChange(e));
		this.panorama.addEvent('wheelevent',  (e) => this.wheelEvent(e));

		this.panorama.addEvent('viewchange',   (e) => this.viewChange(e));
		this.panorama.addEvent('scenechange', (id) => this.sceneChange(id));
		this.panorama.addEvent('panoclicked', (id) => this.panoClicked(id));

		this.panel = document.querySelector('.tour-panel');

		this.initClient();
		this.askForName();
		this.initToolbar();
		this.initChat();
	}

	async unsubscribe(e) {
		if(!this.stream)
			return;
		
		let tracks = this.stream.getTracks();
		for(let track of tracks) {
			if(track.kind == e.kind && track.clientId == e.id)
				this.stream.removeTrack(track);
		}
	}

	initClient() {
		let client = new StreamClient(this.serverurl, this.socketpath);
		client.addEvent('connecting', () => { console.log('connecting'); });
		client.addEvent('connected', (e) => {
			this.connected = true; 
			let modal = document.querySelector('#tour-initial');
			modal.querySelector('#waiting_msg').style.visibility = 'hidden';
			modal.querySelector('.modal-footer button').disabled = false;
		});

		client.addEvent('disconnected', () => { this.connected = false; console.log('disconnected'); });
		client.addEvent('connect error', (e) => { console.log('connect error', e); });
		
		/*this.socket = io(serverurl, { path: socketpath, transports: ['websocket'] });
		this.socket.on('follow', (status)=> this.setStatus(status));
		 */

		client.addEvent('users', (users) => { this.updateUsers(users); });
		client.addEvent('chat', (msg) => { this.updateChat(msg); });


		client.addEvent('streaming', (e) => { 
			if(e.id == client.id)
				return;
			this.subscribe(e); 
		});

		client.addEvent('unstreaming', (e) => { 
			if(e.id == client.id)
				return;
			this.unsubscribe(e); 
		});

		client.addEvent('subscribe error', (e) => { console.log('failed to subscribe'); });
		this.streamClient = client;
	}

	initToolbar(panel) {
		this.sections = 'entries';
		const toolbar = document.querySelector('.tour-toolbar');
		toolbar.querySelector('.tour-entries').addEventListener('click', (e) => {
			if(document.querySelector('.tour-entries.show'))
				this.showSection(); //this.panel.classList.toggle('collapse');
			else
				this.showSection('entries');
		});

		this.userCount = toolbar.querySelector('.tour-users text');
		if(this.userCount)
			this.userCount.textContent = '?';

		this.tools = {};
		for(let tool of ['users', 'chat', 'options', 'guide', 'raise', 'laser'])
			this.tools[tool] = toolbar.querySelector('.tour-' + tool);

		this.tools.users.addEventListener('click', (e) => this.showSection('users'));
		this.tools.chat.addEventListener('click', (e) => this.showSection('chat'));
	}

	updateUsers(users) {
		this.users = users;
		
		const raised = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="2" viewBox="0 0 30 24"><title>Raise</title><path d="m 11.806044,0.90186173 c -1.195402,0 -2.1644682,0.96906597 -2.1644682,2.16446897 v 9.0143883 l -0.01268,1.442979 V 5.7842617 c 0,-1.195403 -0.969065,-2.164468 -2.1644683,-2.164468 -1.195403,0 -2.164468,0.969065 -2.164468,2.164468 v 6.2964573 l -0.03804,2.90366 -0.031,-5.8628923 c -0.01276,-1.195335 -0.969065,-2.164469 -2.164468,-2.164469 -1.195403,0 -2.17723,0.969134 -2.164468,2.164469 l 0.05214,4.9348743 c -0.0019,0.03852 -0.0099,0.07508 -0.0099,0.114141 l 0,5.269291 c 0,3.903496 4.7136638,6.157579 6.0732655,6.157579 h 9.482441 c 1.483588,-0.707651 2.217351,-1.792665 3.124106,-2.926823 l 4.203427,-6.179654 c 0.54263,-1.06542 0.11862,-2.368999 -0.946955,-2.911323 -1.065044,-0.542835 -2.368488,-0.1195 -2.911322,0.945545 l -1.66976,2.37689 v -3.400856 c -0.0017,-0.0035 -0.0023,0.0035 -0.0043,-0.0028 V 5.8367547 c 0,-1.195403 -0.969066,-2.164469 -2.164468,-2.164469 -0.590471,0 -2.136958,1.624657 -2.150377,2.125012 -0.01465,0.546541 0.0017,6.9907433 -0.0099,7.5784563 V 3.0663307 c 0,-1.195403 -0.969065,-2.16446897 -2.164468,-2.16446897 z M 18.299449,13.501151 c 0.05641,0.11672 0,-1.16803 0,-0.938499 z"/></svg>'))); 
		const muted  = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="2" viewBox="-2 -2 26 26"><title>Muted</title><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>')));
		const mic    = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><title>Mute</title><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>')));
		const lock   = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>')));
		const unlock = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>')));

		let userlist = document.querySelector('#tour-users');
		let html = '';
		let count = 0;
		for(let user of Object.values(users)) {
			if(!user.username)
				continue;
			if(user.guide)
				continue;
				
			html += `<li data-user="${user.id}">${user.username}`;

			if(user.locked)
				html += ` <img class="user-lock" src="${lock}"/>`;
			else
				html += ` <img class="user-unlock" src="${unlock}"/>`;

			if(user.muted)
				html += ` <img class="user-mute" src="${muted}"/>`;
			else
				html += ` <img class="user-unmute" src="${mic}"/>`;

			if(user.raised)
				html += `<img class="user-raise" src="${raised}"/>`;


			count++;
		}
		userlist.innerHTML = html;
		if(this.userCount)
			this.userCount.textContent = count;

	}

	initChat() {
		let chat = document.querySelector('#tour-chat');
		let msgs = chat.querySelector('ul');
		let enter = chat.querySelector('button');
		let msg = chat.querySelector('input');
		let sendChat = () => {
			if(msg.value == '') return;
			const encodedStr = msg.value.replace(/[\u00A0-\u9999<>\&]/g, i => '&#'+i.charCodeAt(0)+';')
			this.streamClient.sendMsg('chat', encodedStr);
			msg.value = '';
		};
		msg.addEventListener('keydown', (e) => { if(e.keyCode == 13) sendChat(); });
		enter.addEventListener('click', (e) => sendChat() );
	}

	updateChat(msg) {
		let msgs = document.querySelector('#tour-chat ul');
		msgs.innerHTML = `<li>${msg.username}: ${msg.text}</li>` + msgs.innerHTML;
		if(this.section != 'chat') {
			let count = parseInt(this.tools.chat.getAttribute('badge'));
			this.tools.chat.setAttribute('badge',count+1);
		}
	}


	async askForName() {


		//TODO check for connected.
		let dialog = document.querySelector('#tour-initial');
		let username = document.querySelector('#tour-initial #username');
		let name = window.localStorage.getItem('username');
		if(name)
			username.value = name;
		let enter = document.querySelector('#tour-initial #tour-join');
		let join = () => {
			if(username.value == '') {
				alert("Enter your name.");
				return;
			}

			this.username = username.value.match(/[\p{L}\p{N}\s]/gu).join('');
			window.localStorage.setItem('username', this.username);
			//TODO VALIDATE!

			this.streamClient.sendMsg('username', this.username);
			dialog.style.display = 'none';

			let uservideo = document.querySelector('#users_video video');
			uservideo.play();
		}
		username.addEventListener('keydown', (e) => { if(e.keyCode == 13) join(); });
		enter.addEventListener('click', (e) => { join(); });
	}

	wheelEvent(e) {
	}

	zoomChange(e) {
	}

	viewChange(e) {
	}

	panoClicked(e) {
	}

	guideHighlight() {
	}

	sceneChange(id) {
		this.entries.querySelectorAll('[data-pano]').forEach(p => p.classList.remove('current'));
		let entry = this.entries.querySelector(`[data-pano="${id}"]`);
		if(entry)
			entry.classList.add('current');

		/*let p = this.container.parentElement.querySelector('.tour-panel');
		if(p) p.remove();
		const panel = this.panel = document.createElement('div');
		panel.classList.add('tour-panel');
		this.container.parentElement.appendChild(panel);

		this.createToolbar(panel); */
	}

	createEntries(panos) {
		this.panos = panos;
		const entries = this.entries = document.querySelector('#tour-entries');

		for(let pano of this.panos) {
			if('priority' in pano && pano.priority <= this.maxPriority)
				this.entries.append(this.createEntry(pano));
		}
	}

	createEntry(pano) {
		let li = createElement('li', { 'data-pano': pano.id })
		
		this.createEntryElement(pano, li);
		
		li.addEventListener('click', (e) => {
			e.stopPropagation();
			if(e.target.tagName == 'input' || e.target.tagName == 'svg') return;
			this.panoClicked(e);
			this.panorama.setPano(pano.id, true);
		});
		return li;
	}

	createEntryElement(pano, li) {
		li.innerHTML = `${pano.label || pano.id}`;
	}

	showSection(section) {
		this.section = section;
		document.querySelectorAll('.tour-section').forEach(s => s.classList.add('hidden'));
		document.querySelectorAll('.tour-toolbar div').forEach(s => s.classList.remove('active'));
		if(section) {
			document.querySelector('#tour-' + section).classList.remove('hidden');
			document.querySelector('.tour-toolbar .tour-' + section).classList.add('active');
		}
		if(section == 'chat') {
			this.tools.chat.setAttribute('badge', 0);
		}
	}



/*	async consume(streamPromise) {
		
F		if(!this.stream) {
			this.stream = await streamPromise;
			
		}
		console.log('stream', this.stream);
		
	}*/

}

export { Tour }