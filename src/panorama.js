import  { transpose, eulerToMatrix, eulerFromMatrix, matMul, applyMatrix,
	rotationMatrixToEulerAngles, eulerMatrix, deviationMatrix, clamp }  from './math.js'

import { getIcon, createSvgElement } from './utils.js'
import { addSignals } from './signals.js'

let correct = false; //don't remember what this did.

class Panorama {
	constructor(panourl, container) {

		let path = panourl.split('/');
		path.pop();
		this.baseurl = path.join('/') + '/';
		this.container = container;
		this.mousePosition = { x: 0, y: 0};
		this.highspot = null; //highlight spot.

		this.status = {  //set by guide, read by followers
			room: -1,
			lat: 0,
			lon: 0,
			fov: 0,
			cursor: null,
			paths: {},
			highlight: null,
			stamp : new Date(),
			count: '?'
		}

		this.camera = { //used when swithing from one view to the next
			lat: 0,
			lon: 0,
			fov: 0,
		}

		this.editor = false;

		if(panourl)
			this.load(panourl);
	}

	load(url) {
		(async () => { 
			var response = await fetch(url);
			if(!response.ok) {
				alert("Failed loading tour json: " + url);
				return;
			}

			const json = await response.json();
			this.init(json);
		})();
	}

	async initNew(json) {
		this.dataset = json;
		this.panos = json.panos;
		//just make sure they exists.
		for(let p of this.panos) {
			p.skipLinks ??= [];
		}
		this.accessPoints = json.accessPoints;

		//this.createInterface();
		let config = {
			hfov: 90.0,
			autoLoad: true,
			capturedKeyNumbers: [],
			showControls: false,
			default: {
				"sceneFadeDuration": 1000,
				type: "multires",
			},
			scenes: {},
		}
		config.firtstScene = this.accessPoints[0];
		for(let pano of this.panos) {
			let x = pano.translation[0];
			let y = pano.translation[1];

			let scene = {
				yaw: 0,
				horizonRoll: 0,
				horizonPitch: 0,
				multiRes: {
					//"shtHash": "5a~q%MWVWVtRt7WBt7WCWBWAofRjWBj[ofWBWBWBj[a}ofj]ofa|fQWBayWVWVWVj[ayaya|fk",
					basePath: this.baseurl + pano.url.substr(0, pano.url.length -4),
					path: "/%l/%s%y_%x",
					fallbackPath: "/fallback/%s",
					extension: "jpg",
					tileResolution: 512,
					maxLevel: 4,
					cubeResolution: 2136
				},
			};
			let links = [];
			for(let target of this.panos) {
				if(target == pano || target.skip || target.set != pano.set ||
					(pano.skipLinks.includes(target.id) && !this.editor))
					continue;

					let dx = target.translation[0] - x;
					let dy = target.translation[1] - y;
					let d = Math.sqrt(dx*dx + dy*dy);

					if(target.priority == 0 && d < 300 ||
						target.priority == 1 && d < 150 ||
						d < 50) {
						links.push(target);
					}	
				
			}
			let hotSpots = [];

			for(let target of links) {
				let dx = target.translation[0] - x;
				let dy = target.translation[1] - y;

				let yaw = 90 - pano.initialYaw + 180*Math.atan2(dy, dx)/3.1415;
				let dist = Math.sqrt(dx*dx + dy*dy);
				let H = 2.2;
				let pitch = -180*Math.atan2(H, dist)/3.1415; 
			

				//if(target.priority == 0)
				//	pitch = 1;

				hotSpots.push({
					pitch: pitch,
					//yaw: -yaw - (pano.initialYaw -90),
					yaw: yaw,
					type: "scene",
					sceneId: target.id,
					createTooltipFunc: (div, args) => { this.createHotspot(div, pano, target, dist); },
					createTooltipArgs: [1, 2],
					clickHandlerFunc: (e) => { 
						//TODO clean this mess!
						if(e.target.closest('.tour-visibility')) return;
						this.emit('panoclicked');
						this.setPano(target.id); 

						e.preventDefault(); 
						e.stopPropagation(); 

					},
				})
			}
			scene.hotSpots = hotSpots;
			config.scenes[pano.id] = scene;
		}
		config.default.firstScene = "0";
		let viewer = this.viewer = window.pannellum.viewer(this.container.id, config);
		viewer.on('zoomchange', (e) => { this.emit('zoomchange', e); });
		viewer.on('wheelevent', (e) => this.emit('wheelevent', e));
		viewer.on('mousemove',  (e) => this.mouseMove(e));
		viewer.on('keydown', (e) => this.keyDown(e));
		viewer.on('keyup', (e) => this.keyUp(e));
		viewer.on('scenechange', (id) => {
			this.sceneChange(id); 
			this.emit('scenechange', id);
		});

		await this.setPano(this.panos[0].id);
		//scenechange event not sent on the first load. (WHY?!);
		setTimeout(() => { this.sceneChange(this.panos[0].id); }, 100);
		this.emit('loaded');
	}

	async init(json) {
		this.dataset = json;
		if(json.tours) {
			json.panos = [];
			for(let tour of json.tours) {
				for(let set of tour.sets) {
					for(let pano of set.panos) {
						//pano.url = tour.name + "/" + pano.url;
						//pano.priority = 2;
						pano.set = set.name;
					}
					json.panos = [...json.panos, ...set.panos];
				}
			}
		}
		this.panos = json.panos;
		//just make sure they exists.
		for(let p of this.panos) {
			p.skipLinks = p.skipLinks || [];
			if(p.translation.length == 2)
				p.translation = [p.translation[0], 0, p.translation[1]];
		}
		this.accessPoints = json.accessPoints;

		//this.createInterface();
		let config = {
			hfov: 90.0,
			autoLoad: true,
			capturedKeyNumbers: [],
			showControls: false,
			default: {
				"sceneFadeDuration": 1000,
				type: "multires",
			},
			scenes: {},
		}
		config.firtstScene = this.accessPoints[0];
		for(let pano of this.panos) {
			/*pano.initialYaw = 0;
			if(pano.rotation.length) {
				let r = pano.rotation;

				let R = deviationMatrix(r);
				let euler = eulerFromMatrix(R, 'YXZ'); //y is up (yaw), x is pitch, z is roll
				pano.initialYaw      = euler[1]; 
			}*/
			

			if(correct) {
				pano.horizontalPitch = -euler[0];
				pano.horizontalRoll  = -euler[2];
			} else {
				pano.horizontalPitch = 0;
				pano.horizontalRoll =  0;
			}

			pano.horizontalPitch = 0;

			//let [z, x, y] = applyMatrix(pano.rotation, pano.translation);
			let x = pano.translation[0];
			let y = pano.translation[1];
			let z = pano.translation[2];

			let scene = {
				yaw: pano.yaw || 0,
				horizonRoll: pano.horizontalRoll,
				horizonPitch: -pano.horizontalPitch,
				multiRes: {
					//"shtHash": "5a~q%MWVWVtRt7WBt7WCWBWAofRjWBj[ofWBWBWBj[a}ofj]ofa|fQWBayWVWVWVj[ayaya|fk",
					basePath: this.baseurl + pano.url.substr(0, pano.url.length -4),
					path: "/%l/%s%y_%x",
					fallbackPath: "/fallback/%s",
					extension: "jpg",
					tileResolution: 512,
					maxLevel: 4,
					cubeResolution: 2136
				},
			};
			let links = [];
			for(let target of this.panos) {
				if(target == pano || target.skip || target.set != pano.set ||
					(pano.skipLinks.includes(target.id) && !this.editor))
					continue;

					let tx = target.translation[0];
					let ty = target.translation[1];
					let tz = target.translation[2];
					let dir = [tx - x, ty - y, tz - z, 1];
					if(pano.rotation.length) {
						dir = applyMatrix(pano.rotation, dir);
					}
					let d = Math.sqrt(dir[0]*dir[0] + dir[2]*dir[2]);

					//let tx = target.translation[0];
					//let ty = target.translation[1];
					//let d = Math.sqrt(Math.pow(x - tx, 2) + Math.pow(y - ty, 2));
					if(target.priority == 0 && d < 300 ||
						target.priority == 1 && d < 150 ||
						d < 100) {
						links.push(target);
					}	
				
			}
			let hotSpots = [];

			for(let target of links) {
				let tx = target.translation[0];
				let ty = target.translation[1];
				let tz = target.translation[2];

				
				let dir = [tx - x, ty - y, tz - z, 1];
				if(pano.rotation.length) {
					if(correct) { //try to fix also roll and  pitch
						let T = eulerToMatrix(0, scene.horizonPitch, scene.horizonRoll);
						let G = matMul(pano.rotation, T);
						dir = applyMatrix(G, dir);
					} else {
						dir = applyMatrix(pano.rotation, dir);
					}
				} 
				/* working with positions from gps 
				let yaw = 90 - 180*Math.atan2(dir[2], dir[0])/3.1415;
				*/
				let angle = 180*Math.atan2(dir[2], dir[0])/3.1415;
				let yaw = 90 + angle;
				if(pano.id == 3 && [5, 8].includes(target.id))
					console.log({yaw, angle});
				let dist = Math.sqrt(dir[0]*dir[0] + dir[2]*dir[2]);

				//if(pano.id == 3)
				//	console.log({yaw, dist, dir});
				let H = 2.2;
				let pitch = -180*Math.atan2(H, dist)/3.1415; 

				if(target.priority == 0)
					pitch = 1;

				hotSpots.push({
					pitch: pitch,
					//yaw: -yaw - (pano.initialYaw -90),
					yaw: yaw,
					type: "scene",
					sceneId: target.id,
					createTooltipFunc: (div, args) => { this.createHotspot(div, pano, target, dist); },
					createTooltipArgs: [1, 2],
					clickHandlerFunc: (e) => { 
						//TODO clean this mess!
						if(e.target.closest('.tour-visibility')) return;
						this.emit('panoclicked');

						this.setPano(target.id); 

						e.preventDefault(); 
						e.stopPropagation(); 

					},
				})
			}
			scene.hotSpots = hotSpots;
			config.scenes[pano.id] = scene;
		}
		config.default.firstScene = "0";
		let viewer = this.viewer = window.pannellum.viewer(this.container.id, config);
		viewer.on('zoomchange', (e) => { this.emit('zoomchange', e); });
		viewer.on('wheelevent', (e) => this.emit('wheelevent', e));
		viewer.on('mousemove',  (e) => this.mouseMove(e));
		viewer.on('keydown', (e) => this.keyDown(e));
		viewer.on('keyup', (e) => this.keyUp(e));
		viewer.on('scenechange', (id) => {
			this.sceneChange(id); 
			this.emit('scenechange', id);
		});

		await this.setPano(this.panos[0].id);
		//scenechange event not sent on the first load. (WHY?!);
		setTimeout(() => { this.sceneChange(this.panos[0].id); }, 100);
		this.emit('loaded');
	}

	keyDown(event) {
		if(event.ctrlKey) {
			let coords = this.mousePositionToCoords(this.mousePosition); 
			this.emit('highlight_on', coords);
		}
	}
	keyUp(event) {
		if(!event.ctrlKey)
			this.emit('highlight_off');
	}

	mouseMove(event) {
		let bounds = this.container.getBoundingClientRect();
		// pageX / pageY needed for iOS
		let x = (event.clientX || event.pageX) - bounds.left;
		let y = (event.clientY || event.pageY) - bounds.top;
		this.mousePosition = this.mouseEventToPosition(event);

		if(event.ctrlKey) {
			let coords = this.mouseEventToCoords(event); 
			this.emit('highlight_move', coords);
		}

		if(!this.viewer.isUserInteracting())
			return;

		this.emit('viewchange', { x, y, ctrlKey: event.ctrlKey });
	}

	setStatus(status, timeout = 100) {
		if(!this.viewer)
			return;

		if(status.view) {
			const {room, lat, lon, fov} = status.view;
			if(room != this.viewer.getScene())
			this.setPano(room);
			this.camera = { lat, lon, fov, north:0 };
			this.viewer.setYaw(lon, timeout);
			this.viewer.setPitch(lat, timeout);
			this.viewer.setHfov(fov, timeout);
		}
		this.setHighlight(status.highlight);
	}

	getView() {
		let stamp = new Date().getTime();
		let lat = this.viewer.getPitch();
		let lon = this.viewer.getYaw();
		let fov = this.viewer.getHfov();
		let room = this.viewer.getScene();
		return { room: room, lat, lon, fov,  stamp };
	}

	setPano(id, useScreenshot) {

		let currentId = this.viewer.getScene();
		if(id == currentId) //this.status.room)
			return;
		
		let pano = this.panos.find(e => e.id == id);
		if(!pano) return;

		let current = this.panos.find(e => e.id == currentId);
		if(!current)
			current = pano; //initial loading.


		let fov = this.viewer.getHfov();

		if(useScreenshot) {
			this.camera = { lat: pano.pitch || 0, lon: pano.yaw || 0, fov: (pano.hfov || fov), north: 0 };
		} else {
			let lat = this.viewer.getPitch();
			let lon = this.viewer.getYaw();
			
			let north = -current.initialYaw + pano.initialYaw;
			this.camera = { lat, lon, fov, north };
		}

		this.viewer.loadScene(id);
	}

	//adjust camera parameters when changing!
	sceneChange(id) {
		let lon, lat, fov;
		//the code resets yaw pitch and hfov, restore them.
		lon = this.camera.lon + this.camera.north;
		lat = this.camera.lat;
		fov = this.camera.fov;
		
		if(fov == 0) //first time we call without status
			return;
		
		this.viewer.setYaw(lon, 100);
		this.viewer.setPitch(lat, 100);
		this.viewer.setHfov(fov, 100);
	}
	getHighlight() {
		if(!this.highspot)
			return null;
		let { pitch, yaw} = this.highspot;
		return { pitch, yaw };
	}
	setHighlight(highlight) {
		if(highlight) {
			this.moveHighlight(highlight);
		} else if(this.highspot) {
			this.removeHighlight(highlight);
		}
	}

	createHighlight(highlight) {
		let id = 'A' + (1000000*Math.random()).toFixed(0);
		
		let {pitch, yaw } = highlight;

		this.highspot = {
			id,
			pitch,
			yaw,
			scale: true,
			type: "info",
			createTooltipFunc: (hotSpotDiv) => { 
				let spot = createSvgElement('svg', { viewport: '0 0 50 50' });
				spot.classList.add('tour-highlight');
				
				let path = createSvgElement('circle', { r: 20, cx: 25, cy: 25, fill:'rgb(255, 0, 0, 0.5)', stroke:'red' })
				spot.append(path);

				hotSpotDiv.style.backgroundImage = 'none';
				hotSpotDiv.append(spot);
			}
		}
		this.viewer.addHotSpot(this.highspot);
		this.viewer.renderHotSpot(this.highspot);
	}

	removeHighlight() {
		if(!this.highspot) return;
		this.viewer.removeHotSpot(this.highspot.id);
		this.highspot = null;
	}

	moveHighlight({pitch, yaw}) {
		if(!this.highspot)
			this.createHighlight({pitch, yaw});
		this.highspot.pitch = pitch;
		this.highspot.yaw = yaw;
		if(this.highspot.div)
			this.viewer.renderHotSpot(this.highspot);
	}


	createHotspot(div, pano, target, distance) {
		div.style.backgroundImage = 'none';
		if(target.skip) return; //this is just for editor stuff
		div.setAttribute('title', target.label || target.id);
		div.setAttribute('data-target', target.id);
		div.classList.add('tour-hotspot');
		
		let html = '';
		let spot = false;
		switch(target.priority) {
			case 0: html = getIcon('location'); break;
			case 1: html = getIcon('waypoint'); break;
			default: html = getIcon('spot'); spot = true; break;
		}
		if(this.editor) {
			let visibility = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="tour-visibility">
			<g class="tour-visible">
				<path d="M 4,12 C 4,12 7,6 12,6 17,6 20,12 20,12 20,12 17,18 12,18 7,18.0 4,12 4,12 Z" />
				 <circle r="2.3" cy="12" cx="12" />
			</g>
			<g class="tour-hidden">
				 <path d="M 16.424581,16.424332 a 7.5004924,7.5004924 0 0 1 -4.42432,1.534361 c -5.2138477,0 -8.193191,-5.958684 -8.193191,-5.958684 A 13.742213,13.742213 0 0 1 7.5759379,7.5756856 m 2.8601681,-1.355598 a 6.7928991,6.7928991 0 0 1 1.564155,-0.1787614 c 5.213848,0 8.193188,5.9586838 8.193188,5.9586838 a 13.779455,13.779455 0 0 1 -1.608842,2.376023 M 13.57931,13.57906 a 2.2345062,2.2345062 0 1 1 -3.1581,-3.158103" />
				 <line y2="20.19319" x2="20.19319" y1="3.8068109" x1="3.8068109" />
			 </g></svg>`;
			html += visibility;
		}
		div.innerHTML = html;
		if(spot) {
			let circle = div.querySelector('.tour-spot circle');
			let ry = Math.max(0.2, Math.min(1, Math.sin(Math.atan(3.6/distance))));
			circle.setAttribute('transform', `scale(1, ${ry})`);
			circle.setAttribute('cy', `${12/ry}`);
			//circle.setAttribute('r', 12);
		}
		if(pano.skipLinks.includes(target.id))
			div.classList.add('hidden');

		if(this.editor) {
			let v = div.querySelector('.tour-visibility'); //tour-visibility');
			let onclick = (e) => {
				div.classList.toggle('hidden');
				pano.skipLinks.push(target.id);
				e.stopPropagation();
				e.preventDefault();
			}

			v.addEventListener('click', onclick);
			//v.addEventListener('pointerup', onclick);
			//v.addEventListener('touchend', onclick);
			
		}

	}

	mouseEventToPosition(event) {
		let bounds = this.container.getBoundingClientRect();
		let pos = {};
		// pageX / pageY needed for iOS
		pos.x = (event.clientX || event.pageX) - bounds.left;
		pos.y = (event.clientY || event.pageY) - bounds.top;
		return pos;
	}

	mouseEventToCoords(event) {
		let pos = this.mouseEventToPosition(event);
		return this.mousePositionToCoords(pos);
	}

	mousePositionToCoords(pos) {
		
		let canvas = this.viewer.getRenderer().getCanvas();
		let canvasWidth = canvas.clientWidth,
			canvasHeight = canvas.clientHeight;
		let x = pos.x / canvasWidth * 2 - 1;
		let y = (1 - pos.y / canvasHeight * 2) * canvasHeight / canvasWidth;

		let hfov = this.viewer.getHfov();
		let pitch = this.viewer.getPitch();
		let yaw = this.viewer.getYaw();

		let focal = 1 / Math.tan(hfov * Math.PI / 360);
		let s = Math.sin(pitch * Math.PI / 180);
		let c = Math.cos(pitch * Math.PI / 180);
		let a = focal * c - y * s;
		let root = Math.sqrt(x*x + a*a);
		let p_pitch = Math.atan((y * c + focal * s) / root) * 180 / Math.PI;
		let p_yaw = Math.atan2(x / root, a / root) * 180 / Math.PI + yaw;
		if (p_yaw < -180)
			p_yaw += 360;
		if (p_yaw > 180)
			p_yaw -= 360;
		return {pitch: p_pitch, yaw: p_yaw};
	}

	coordsToPos(p, y) {
		let pitch = this.viewer.getPitch();
		let yaw = this.viewer.getYaw();
		let hfov = this.viewer.getHfov();
		let roll = this.viewer.getHorizonRoll();
		let hsPitchSin = Math.sin(p * Math.PI / 180),
        	hsPitchCos = Math.cos(p * Math.PI / 180),
        	configPitchSin = Math.sin(pitch * Math.PI / 180),
        	configPitchCos = Math.cos(pitch * Math.PI / 180),
        	yawCos = Math.cos((-y + yaw) * Math.PI / 180);
		var z = hsPitchSin * configPitchSin + hsPitchCos * yawCos * configPitchCos;
		if ((y <= 90 && y > -90 && z <= 0) ||
		((y > 90 || y <= -90) && z <= 0)) {
			
		}
		if(1) {
			let yawSin = Math.sin((-y + yaw) * Math.PI / 180),
				hfovTan = Math.tan(hfov * Math.PI / 360);
			
			var canvas = this.viewer.getRenderer().getCanvas(),
				canvasWidth = canvas.clientWidth,
				canvasHeight = canvas.clientHeight;
			var coord = [-canvasWidth / hfovTan * yawSin * hsPitchCos / z / 2,
				-canvasWidth / hfovTan * (hsPitchSin * configPitchCos -
				hsPitchCos * yawCos * configPitchSin) / z / 2];
			// Apply roll
			var rollSin = Math.sin(roll * Math.PI / 180),
				rollCos = Math.cos(roll * Math.PI / 180);
			coord = [coord[0] * rollCos - coord[1] * rollSin,
					coord[0] * rollSin + coord[1] * rollCos];
			// Apply transform
			let ox = 0;
						let oy = 0; 
			coord[0] += (canvasWidth - ox) / 2;
			coord[1] += (canvasHeight - oy) / 2;
			return {x: coord[0], y: coord[1]};
		}
	}

};


addSignals(Panorama, 
	'loaded', 
	'zoomchange', 
	'wheelevent',
	'viewchange', 
	'highlight_on',
	'highlight_off',
	'highlight_move',
	'scenechange', //afer pano is changed
	'panoclicked' //before pano is changed, when the user click
	);

export { Panorama }