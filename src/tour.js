import { io } from "socket.io-client";
import { simplify, smooth, smoothToPath } from './simplify.js'

let correct = false;

class Tour {
	constructor(url, container) {
		this.container = container;

		this.guide = false;
		this.editor = false; 
		this.visitor = false;

		this.following = false;  //only when following
		this.looking = false; //looking around while following?
		this.lookingIdle = 3000; //if looking and idle for this ms, return to follow.
		this.followTimeout = false; //timeout when changing view to refollow.

		this.drawing = false;
		this.elements = [];
		this.resolution = 100; //ms between status changes

		this.mouseposition = { x: 0, y: 0};

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

		let parameter = Object.fromEntries(new URLSearchParams(location.search));
		switch(parameter.role) {
			case 'guide': this.guide = true; this.key = parameter.key; break;
			case 'editor': this.editor = true; break;
			default: this.visitor = true; this.following = true; break;
		}
		
		this.socket = io('http://pc-ponchio.isti.cnr.it:8080');
		this.socket.on('follow', (status)=> this.setStatus(status));
		
		if(url)
			this.load(url);
	}
	
	emit() {
		this.socket.emit(this.key, this.status );
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

	async init(json) {
			this.dataset = json;
			this.panos = json.panos;
			for(let p of this.panos) {
				p.skipLinks = p.skipLinks || [];
			}
			this.accessPoints = json.accessPoints;

			this.createInterface();

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
				let r = pano.rotation;				

				let R = deviationMatrix(r);

				//let euler = eulerFromMatrix(R, 'YZX');
				let euler = eulerFromMatrix(R, 'YXZ'); //y is up (yaw), x is pitch, z is roll
				
			
				pano.initialYaw      = euler[1]; 

				if(correct) {
					pano.horizontalPitch = -euler[0];
					pano.horizontalRoll  = -euler[2];
				} else {
					pano.horizontalPitch = 0;
					pano.horizontalRoll =  0;
				}


				//let [z, x, y] = applyMatrix(pano.rotation, pano.translation);
				let x = pano.translation[0];
				let y = pano.translation[1];
				let z = pano.translation[2];

				let scene = {
					yaw: 0,
					horizonRoll: pano.horizontalRoll,
					horizonPitch: -pano.horizontalPitch,
					multiRes: {
						//"shtHash": "5a~q%MWVWVtRt7WBt7WCWBWAofRjWBj[ofWBWBWBj[a}ofj]ofa|fQWBayWVWVWVj[ayaya|fk",
						basePath: 'panos/' + pano.url.substr(0, pano.url.length -4),
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
						dir = applyMatrix(pano.rotation, dir);
						let d = Math.sqrt(dir[0]*dir[0] + dir[2]*dir[2]);

						//let tx = target.translation[0];
						//let ty = target.translation[1];
						//let d = Math.sqrt(Math.pow(x - tx, 2) + Math.pow(y - ty, 2));
						if(target.priority == 0 && d < 300 ||
							target.priority == 1 && d < 150 ||
							d < 50) {
							links.push(target);
						}	
					
				}
				let hotSpots = [];

				for(let target of links) {
					let tx = target.translation[0];
					let ty = target.translation[1];
					let tz = target.translation[2];

					
					let dir = [tx - x, ty - y, tz - z, 1];

					if(correct) {
						let T = eulerToMatrix(0, scene.horizonPitch, scene.horizonRoll);
						let G = matMul(pano.rotation, T);
						dir = applyMatrix(G, dir);
					} else {
						dir = applyMatrix(pano.rotation, dir);


					}

					let yaw = 180*Math.atan2(dir[0], dir[2])/3.1415;
					let dist = Math.sqrt(dir[0]*dir[0] + dir[2]*dir[2]);
					let H = 2.2 - dir[1];
					let pitch = -180*Math.atan2(H, dist)/3.1415; 

					if(target.priority == 0)
						pitch = 1;

					hotSpots.push({
						pitch: pitch,
						//yaw: -yaw - (pano.initialYaw -90),
						yaw: -yaw + 180,
						type: "scene",
						sceneId: target.id,
						createTooltipFunc: (div, args) => { this.createHotspot(div, pano, target, dist); },
						createTooltipArgs: [1, 2],
						clickHandlerFunc: (e) => { 
							if(e.target.closest('.tour-visibility')) return;
							this.setPano(target.id); 
							if(this.following !== false)
								this.follow(false);
							e.preventDefault(); 
							e.stopPropagation(); 
						},
					})
				}
				scene.hotSpots = hotSpots;
				config.scenes[pano.id] = scene;
			}
			config.default.firstScene = "0";
			let viewer = this.viewer = window.pannellum.viewer(this.container.id,  config);
			viewer.on('zoomchange', (e) => this.zoomChange(e));
			viewer.on('mousemove',  (e) => this.mousemove(e)); 

			viewer.on('scenechange', (id) => this.sceneChange(id));

			await this.setPano(this.panos[0].id);
			//scenechange event not sent on the first load. (WHY?!);
			setTimeout(() => { this.sceneChange(this.panos[0].id); }, 100);
			

			if(this.guide) {
				//viewer.on('mousedown',  (e) => this.mousedown(e));
				//viewer.on('mouseup',  (e) => this.mouseup(e));
				document.addEventListener('keydown', (e) => {
					if(e.key == 'Control') {
						this.container.classList.add('drawing');
						if(!this.highspot)
							this.createHighSpot(e);
					}
				});
				document.addEventListener('keyup', (e) => {
					if(e.key == 'Control') {
						this.container.classList.remove('drawing');
						this.removeHighSpot();
						this.status.highlight = null;
						this.emit();
					}
				});
			}
			this.follow(this.following);
			this.camera = { //used when swithing from one view to the next
				lat: 0,
				lon: 0,
				fov: 0,
			}
			//this.createSvg();
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
			case 0: html = this.getIcon('location'); break;
			case 1: html = this.getIcon('waypoint'); break;
			default: html = this.getIcon('spot'); spot = true; break;
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

	createDrawSpot(id, pitch, yaw, path) {
		this.path = createSvgElement('path', { id, d: path });
		
		this.viewer.addHotSpot({
			pitch,
			yaw,
			scale: true,
			type: "info",
			createTooltipFunc: (hotSpotDiv) => { 
				let spot = createSvgElement('svg', { viewport: '0 0 50 50' });
				spot.classList.add('tour-drawing');

				spot.append(this.path);				
				hotSpotDiv.style.backgroundImage = 'none';
				hotSpotDiv.append(spot);
			}
		});
	}

	createHighSpot() {
		let id = 'A' + (1000000*Math.random()).toFixed(0);
		
		let [pitch, yaw] = this.mousePositionToCoords(this.mouseposition); 

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
	}

	removeHighSpot() {
		this.viewer.removeHotSpot(this.highspot.id);
		this.highspot = null;
	}

	moveHotSpot(pitch, yaw) {
		this.highspot.pitch = pitch;
		this.highspot.yaw = yaw;
		this.viewer.renderHotSpot(this.highspot);
	}


	mousedown(e) {
		if(!e.ctrlKey)
			return;

		e.preventDefault();
		this.drawing = true;

		
		this.startPos = { x: e.pageX - 25, y: e.pageY -25};
		let [pitch, yaw] = this.viewer.mouseEventToCoords(e);
		let id = 'A' + (1000000*Math.random()).toFixed(0);

		this.createHighSpot(id, pitch, yaw);

		/*this.createDrawSpot(id, pitch, yaw, 'M0 0');
		this.status.paths[id] = { pitch, yaw, path: 'M 50 50', polar: []};
		this.path.points = [{x:3, y:23}];
		this.path.polars = [this.mouseEventToCoords(e)];

		this.elements.push(this.path); */
	}
	distanceToLast(line, point) {
		let last = line[line.length - 1];
		return this.distance(last, point);
	}
	distance(a, b) {
		let dx = a.x - b.x;
		let dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy);
	}
	mouseup(e) {
		if(!this.drawing)
			return;

		e.preventDefault();
		this.drawing = false;
	}

	mousePosition(event) {
		let bounds = this.container.getBoundingClientRect();
		let pos = {};
		// pageX / pageY needed for iOS
		pos.x = (event.clientX || event.pageX) - bounds.left;
		pos.y = (event.clientY || event.pageY) - bounds.top;
		return pos;
	}

	mouseEventToCoords(event) {
		let pos = this.mousePosition(event);
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
		return [p_pitch, p_yaw];
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
			
			//hs.div.style.visibility = 'hidden';
		}
		if(1) {
			let yawSin = Math.sin((-y + yaw) * Math.PI / 180),
				hfovTan = Math.tan(hfov * Math.PI / 360);
				//hs.div.style.visibility = 'visible';
			
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
			let ox = 0; //hs.div.offsetWidth
			let oy = 0; //hs.div.offsetHeight
			coord[0] += (canvasWidth - ox) / 2;
			coord[1] += (canvasHeight - oy) / 2;
			return {x: coord[0], y: coord[1]};
		}
	}

	draw(e) {
		let [p, y] = this.mouseEventToCoords(e);
		let res = this.coordsToPos(p, y);

		let pos = { x: e.pageX - this.startPos.x, y: e.pageY - this.startPos.y };
		let gap = this.distanceToLast(this.path.points, pos);
		if (gap < 4) return;


/*		let canvas = this.viewer.getRenderer().getCanvas();
		let hfov = this.status.fov;
		//var vfov = 2 * Math.atan(Math.tan(hfov * 0.5) * canvas.clientHeight / canvas.clientWidth);
		//console.log(Math.tan(hfov * 0.5), canvas.clientHeight / canvas.clientWidth);
		//console.log(canvas.clientHeight, canvas.clientWidth);
		let scalex = (Math.sin((hfov/2)*3.1415/180)/Math.sin((90/2)*3.1415/180));
		let scaley = scalex;// * canvas.clientHeight / canvas.clientWidth;

		pos.x *= scalex;
		pos.y *= scaley; */

		this.path.points.push(pos);
		this.path.polars.push([p, y]);

		let d = this.svgPath(this.path.points);
		this.path.setAttribute('d', d);//d + `L${pos.x} ${pos.y}`);
		this.status.paths[this.path.id].path = d;
		this.status.paths[this.path.id].polar = this.path.polars;
		this.emit();
	}

	svgPath(points) {
		//TODO take zoom into consideration!
		let tolerance = 1;
		let tmp = simplify(points, tolerance);

		let smoothed = smooth(tmp, 90, true);
		return smoothToPath(smoothed);
		//return points.map((p, i) =>  `${(i == 0? "M" : "L")}${p.x} ${p.y}`).join(' '); 
	}

	zoomChange(e) {
		//if(!this.viewer.isUserInteracting())
		//	return;
		if(this.guide)	
			this.track(e);
	}

	mousemove(e) {
		this.mouseposition =  this.mousePosition(e);
		if(e.ctrlKey && this.guide) {
			if(!this.highspot) 
				this.createHighSpot(e);
			this.trackHighlight(e);
			return;
		}

		if(this.drawing) {
			this.draw(e);
			return;
		}
		if(!this.viewer.isUserInteracting())
			return;
		this.track();
	}
	trackHighlight(e) {
		let [pitch, yaw] = this.viewer.mouseEventToCoords(e);
		this.moveHotSpot(pitch, yaw);

		let resolution = 100; //ms
		let now = new Date().getTime();
		
		clearTimeout(this.timeout);
		let elapsed = now - this.status.stamp;


		if(elapsed < resolution) {
			this.timeout = setTimeout(() => {
				if(this.guide) {
					this.status.highlight = { pitch, yaw };
					this.status.stamp = now;
					this.emit();
				}
			}, resolution - elapsed);
			return;
		}

		if(!this.status.highlight || pitch != this.status.highlight.pitch || yaw != this.status.highlight.yaw) {			
			
			if(this.guide) {
				this.status.highlight = { pitch, yaw };
				this.status.stamp = now;
				this.emit();
			}
		}

	}

	track(e) {

		if(!this.guide) {
			this.follow(false); 
			/*if(this.following === true) {
				this.follow('looking');
			}
			if(this.following === 'looking') {
				this.follow(true, this.lookingIdle);  //stop looking in ms.
			} */
			return;
		}
		let resolution = 100; //ms
		let now = new Date().getTime();
		let lat = this.viewer.getPitch();
		let lon = this.viewer.getYaw();
		let fov = this.viewer.getHfov();
		let room = this.viewer.getScene();
		let status = { room: room, lat, lon, fov, stamp: now, paths: this.status.paths, count:this.status.count, stamp: now };


		clearTimeout(this.timeout);
		let elapsed = now - this.status.stamp;


		if(elapsed < resolution) {
			this.timeout = setTimeout(() => {
				if(this.guide) {
					this.status = status;
					this.emit();
				}
			}, resolution - elapsed);
			return;
		}

		if(lat != this.status.lat || lon != this.status.lon || fov != this.status.fov) {			
			
			if(this.guide) {
				this.status = status;
				this.emit();
			}
		}
	}
	




	createInterface() {
		let p = this.container.parentElement.querySelector('.tour-panel');
		if(p) p.remove();
		const panel = this.panel = document.createElement('div');
		panel.classList.add('tour-panel');
		this.container.parentElement.appendChild(panel);

		this.createToolbar(panel);
		this.createEntries(panel);
	}

	createEntries(panel) {
		const entries = this.entries = createElement('ul', { class: 'tour-entries' });
		panel.append(entries);

		for(let pano of this.panos) {
			if('priority' in pano && pano.priority == 0 || this.editor)
				this.entries.append(this.createEntry(pano));
		}
	}

	createEntry(pano) {
		let li = createElement('li', { 'data-pano': pano.id })
		
		if(this.editor) {
			let icon = '';
			if(pano.priority == 0)
				icon = this.getIcon('location');
			else if(pano.priority == 1)
				icon = this.getIcon('waypoint');
				
			let input = createElement('input', { type: 'checkbox' });
			if(pano.skip != true)
				input.setAttribute('checked', 'checked');
			li.append(input);
			let span = createElement('span');
			span.textContent = `${pano.label || pano.id}`;
			li.append(span);

			input.addEventListener('change', (e) => {
				pano.skip = !input.checked;
				let spot = document.querySelector(`[data-target="${pano.id}"]`);
				if(spot)
					spot.style.display = pano.skip ? 'none' : 'block';
				e.stopPropagation();
				e.preventDefault();
			});
			input.addEventListener('click', (e)  => {
				e.stopPropagation();
			});
			span.addEventListener('click', (e) => {
				if(pano.id == this.viewer.getScene()) {
					let input = createElement('input', {type: 'text', value: pano.label});
					span.innerHTML = '';
					span.append(input);
					input.focus();
					input.addEventListener('blur', () => {
						pano.label = input.value;
						span.innerHTML = `${pano.label || pano.id}`;
					});
					e.stopPropagation();
				}
			});
			if(!('priority' in pano))
			pano.priority = 2;
			
			let priorities = ['location', 'waypoint', 'spot'];
			
			let priority = createElement('div', { class: 'tour-entrypriority', style: 'float:right'});
			priority.innerHTML = this.getIcon(priorities[pano.priority]);
			li.append(priority);
			priority.addEventListener('click', (e) => {
				pano.priority = (pano.priority+2)%3;
				priority.innerHTML = this.getIcon(priorities[pano.priority]);
				if(pano.id != this.viewer.getScene()) {
					//TODO viewer.addScene('currentSceneId', {new config}); followed by viewer.loadScene('currentSceneId');.
				}
			});

		} else
			li.innerHTML = `${pano.label || pano.id}`;

		li.addEventListener('click', (e) => {
			e.stopPropagation();
			if(e.target.tagName == 'input' || e.target.tagName == 'svg') return;
			this.setPano(pano.id, true);
			this.follow(false);
			
		});
		return li;
	}

	createToolbar(panel) {
		const toolbar = this.toolbar = createElement('div', { class: 'tour-toolbar' });
		panel.appendChild(toolbar);
		
		if(this.guide)
			toolbar.innerHTML = this.getIcons('list', 'users');
		else if(this.editor) {
			toolbar.innerHTML = this.getIcons('list', 'load', 'save', 'screenshot');
			toolbar.querySelector('.tour-upload').addEventListener('click', (e) => {
				this.upload();
			});
			toolbar.querySelector('.tour-save').addEventListener('click', (e) => {
				this.save();
			});
			toolbar.querySelector('.tour-screenshot').addEventListener('click', (e) => {
				this.setView();
			});
		} else {
			toolbar.innerHTML = this.getIcons('list', 'umbrella', 'users');
			toolbar.querySelector('.tour-guide').addEventListener('click', (e) => {
				if(this.follow === true || this.follw == 'following')
					this.follow(false);
				else
					this.follow(true);
			});
		}
		
		toolbar.querySelector('.tour-list').addEventListener('click', (e) => {
			this.panel.classList.toggle('collapse');
		});
		this.userCount = toolbar.querySelector('.tour-users text');
		if(this.userCount)
			this.userCount.textContent = '?';
	}



	follow(value, timeout) {
		if(!value) value = false;
		if(this.guide || this.editor)
			return;

		clearTimeout(this.followTimeout);
		if(timeout)	{
			this.followTimeout = setTimeout(() => { this.follow(true); }, timeout);
			return;
		}
			
		this.following = value;
		document.querySelector('.tour-guide').classList.toggle('active', value === true);
		if(this.following === true)
			this.setStatus(this.status, 1000);
	}

	setStatus(status, timeout) {
		if(status.room == -1)
			return;

		this.setVisitorCount(status);

		if(!this.visitor)
			return;

		this.status = status;
		//put guide in room.

		if(!this.following)
			return;

		const {lat, lon, fov, room, paths, stamp} = status; 
		if(!this.panos) return;
		let pano = this.panos.find(p => p.id == room);

		if(status.highlight) {
			if(!this.highspot) 
				this.createHighSpot();
			this.moveHotSpot(status.highlight.pitch, status.highlight.yaw);
		} else {
			if(this.highspot)
				this.removeHighSpot();
		}
/*
		for(let id in status.paths) {
			let path = status.paths[id];
			let element = this.container.querySelector('#' + id);
			let polar = path.polar;
			let points = polar.map(p => this.coordsToPos(p[0], p[1]))
			points = points.map(p => { return { x: p.x - points[0].x + 3, y: p.y - points[0].y + 23 } })	;
			let d = "M 0 0";
			if(points.length)
				d = this.svgPath(points);
			path.path = d;
			if(element)
				element.setAttribute('d', path.path);
			else
				this.createDrawSpot(id, path.pitch, path.yaw, path.path);
		} */

		if(room != this.viewer.getScene())
			this.setPano(room);

		if(!timeout) timeout = 100;
		this.viewer.setYaw(lon, timeout);
		this.viewer.setPitch(lat, timeout);
		this.viewer.setHfov(fov, timeout);
	}

	setVisitorCount(status) {
		if(this.userCount)
			this.userCount.textContent = status.count;
	}

	setPano(id, useScreenshot) {
		let currentId = this.viewer.getScene()
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

		this.entries.querySelectorAll('[data-pano]').forEach(p => p.classList.remove('current'));
		let entry = this.entries.querySelector(`[data-pano="${id}"]`);
		if(entry)
			entry.classList.add('current');
	}

	sceneChange(id) {
		let pano = this.panos.find((e) => e.id == id);
		let lon, lat, fov;
		//the code resets yaw pitch and hfov, restore them.
		if(this.following === true) {
			lon = this.status.lon;
			lat = this.status.lat;
			fov = this.status.fov;
		} else {
			
			lon = this.camera.lon + this.camera.north;
			console.log("start lon:" , this.camera.lon, "north: ", this.camera.north, "final lon", lon);
			lat = this.camera.lat;
			fov = this.camera.fov;
		}
		if(fov == 0) //first time we call without status
			return;
		
		this.viewer.setYaw(lon, 100);
		this.viewer.setPitch(lat, 100);
		this.viewer.setHfov(fov, 100);

		if(this.guide) {
			this.status.lon = lon;
			this.status.lat = lat;
			this.status.fov = fov;
			this.status.room = id;
			this.status.stamp = new Date().getTime();
			this.status.paths = {};
			this.emit();
		}
	}


	createSvg() {
		let svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svgElement.setAttribute('viewBox', '0 0 256 256');

		let style =  document.createElementNS('http://www.w3.org/2000/svg', 'style');
		style.textContent = "";
		svgElement.appendChild(style);

		let serializer = new XMLSerializer();

		for(let pano of this.panos) {
			let t = pano.translation;
			let euler = this.rotationMatrixToEulerAngles(pano.rotation);
			let [roll, pitch, yaw] = euler;

			//(pano.id, 'yaw: ', yaw, 'roll: ', roll, 'pitch: ', pitch);

			let circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', t[0]);
			circle.setAttribute('cy', -t[1]);
			circle.setAttribute('r', 0.1);
			svgElement.appendChild(circle);

			
			let tag = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			tag.setAttribute('x', t[0]);
			tag.setAttribute('y', -t[1]-0.2);
			tag.setAttribute('font-size', 2);

			tag.textContent = pano.id;
			svgElement.appendChild(tag);


			svgElement.appendChild(circle);
			
			let dx = Math.sin(yaw*3.1415/180)*5 + t[0];
			let dy = Math.cos(yaw*3.1415/180)*5 + t[1];
			let dir = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			dir.setAttribute('d', `M ${t[0]} ${-t[1]} L ${dx} ${-dy}`);
			dir.setAttribute('stroke-width', '0.01');
			dir.setAttribute('stroke', '#000')
			svgElement.appendChild(dir);


			for(let l of pano.links) {
				break;
				let target = this.panos.find((e) => e.id == l);
				if(!target) {
					console.log("Missing pano: ", l);
					continue;
				}
				let e = target.translation;
				let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				path.setAttribute('d', `M ${t[0]} ${-t[1]} L ${e[0]} ${-e[1]}`);
				path.setAttribute('stroke-width', '0.01');
				path.setAttribute('stroke', '#000')
				svgElement.appendChild(path);
			}
		}

		let svg = serializer.serializeToString(svgElement);
		
		var e = document.createElement('a');
		e.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(svg));
		e.setAttribute('download', 'annotations.svg');
		e.style.display = 'none';
		document.body.appendChild(e);
		e.click();
		document.body.removeChild(e);
	}

	setView() {
		let id = this.viewer.getScene();
		let pitch = this.viewer.getPitch();
		let yaw = this.viewer.getYaw();
		let hfov = this.viewer.getHfov();
		let pano = this.panos.find(p => p.id == id);
		pano.yaw = yaw;
		pano.pitch = pitch;
		pano.hfov = hfov;
	}

	upload() {
		let input = createElement('input', { type: 'file', accept: 'application/JSON', style: 'display:none' });
		input.addEventListener('change', (e) => {
			if(input.files.length != 1) 
				return;
			let file = input.files[0];
			let reader = new FileReader();

			reader.onloadend = () => {
				let json = JSON.parse(reader.result);
				(async () => {
					this.viewer.destroy();
					this.init(json);
				})();
			}
			reader.readAsText(file); 
			document.body.removeChild(input);
			e.preventDefault();
		});
		document.body.append(input);
		input.click();
	}
	save() {
		const txt = JSON.stringify(this.dataset, null, 2);
		let lines = txt.split("\n").map(l => l.includes(':') || l.includes('}') ? "\n" + l: l.trim());
		

		var e = createElement('a',  {
			href: 'data:text/plain;charset=utf-8,' + encodeURIComponent(lines.join('')),
			download: 'dataset.json',
			style: 'display:none'
		});
		
		document.body.appendChild(e);
		e.click();
		document.body.removeChild(e); 
	} 
	
	getIcon(name) {
		switch(name) {
		case 'umbrella': return `<svg xmlns="http://www.w3.org/2000/svg" class="tour-guide follow" viewBox="0 0 24 24">
			<title>Follow (or unfollow) the guide</title>
			<path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"></path>
			<path class="negate" d="M 21 3 L 3 21"></path>
			</svg>`;

		case 'users': return `<svg xmlns="http://www.w3.org/2000/svg"  class="tour-users" viewBox="0 0 36 24">
			<title>Number of partecipants</title>

			<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
			<text x="19" y="12" stroke="none" fill="white" font-family="arial" font-weight="bold" font-size="12px">12</text></svg>`;

		case 'list': return `<svg xmlns="http://www.w3.org/2000/svg" class="tour-list active" viewBox="0 0 24 24" >
			<title>Show/hide the list of locations</title>
			<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line>
			<line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line>
			<line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
		
		case 'load': return `<svg xmlns="http://www.w3.org/2000/svg" class="tour-upload" viewBox="0 0 24 24">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
			<polyline points="17 8 12 3 7 8"></polyline>
			<line x1="12" y1="3" x2="12" y2="15"></line></svg>`;

		case 'save': return `<svg xmlns="http://www.w3.org/2000/svg" class="tour-save" viewBox="0 0 24 24">
			<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
			<polyline points="17 21 17 13 7 13 7 21"></polyline>
			<polyline points="7 3 7 8 15 8"></polyline></svg>`;

		case 'screenshot': return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="tour-screenshot">
			<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
			<circle cx="12" cy="13" r="4"></circle></svg>`;

		case 'location': return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="tour-location">
			<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
			<circle cx="12" cy="10" r="3"></circle></svg>`;

		case 'waypoint': return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="tour-waypoint">
			<path d="M 10,11 V 22"/>
			<path d="M 3,4 H 17.5 L 21,7 17.5,10.5 H 3 Z"/></svg>`;

		case 'spot': return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="tour-spot">
			<circle cx="12" cy="12" r="10"></circle></svg>`;


		default: throw "Icon not found.";
		}
	}

	getIcons(args) {
		return Array.from(arguments).map(i => this.getIcon(i)).join("\n");
	}
}

function createElement(tag, attributes) {
	let e = document.createElement(tag);
	for(let a in attributes) 
		e.setAttribute(a, attributes[a]);
	return e;
}

function createSvgElement(tag, attributes) {
	let e = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for(let a in attributes) 
		e.setAttribute(a, attributes[a]);
	return e;
}

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v));
}

function deviationMatrix(r) {
	let m = [ 
		0,  0, -1,  0,
		-1, 0,  0,  0,
		0,  1,  0,  0,
		0,  0,  0,  1];
	
	return matMul(m, r);
}

function eulerMatrix(r) {
	let m = [ 
		0,  0, -1,  0,
		-1, 0,  0,  0,
		0,  1,  0,  0,
		0,  0,  0,  1];
	
	r = matMul(m, r);
	
	let g = 180/3.1415;
	let yaw   = g*Math.atan2(r[4], r[0]);
	let pitch = g*Math.atan2(-r[8], Math.sqrt(Math.pow(r[9], 2) + Math.pow(r[10], 2)));
	let roll  = g*Math.atan2(r[9], r[10]);
	return [yaw, pitch, roll];
}

function rotationMatrixToEulerAngles(m) {
	let col = [0, 2, 1];
	let sy = Math.sqrt(m[0] * m[0] +  m[1] * m[1]);
	let singular = sy < 1e-6;
	if(singular)
		throw "Singular matrix";
	let x = Math.atan2(m[2 + col[1]*4] , m[2 + col[2]*4])
	let y = Math.asin(-m[2 + col[0]*4]);
	let z = Math.atan2(-m[1 + col[0]*4], m[0 + col[0]*4])
	//roll pitch yaw
	return [x*180/3.1415, y*180/3.1415, z*180/3.1415];
}

function applyMatrix(m, v) {
	v[3] = 1;
	let r = [0, 0, 0, 0];
	for(let row = 0; row < 4; row++)
		for(let col = 0; col < 4; col++)
			r[row] += m[row*4 + col]*v[col];
	return r;
}

function matMul(a, b) {
	let r = new Array(16);
	r[ 0] = a[0]*b[0] + a[4]*b[1] + a[8]*b[2] + a[12]*b[3];
	r[ 1] = a[1]*b[0] + a[5]*b[1] + a[9]*b[2] + a[13]*b[3];
	r[ 2] = a[2]*b[0] + a[6]*b[1] + a[10]*b[2] + a[14]*b[3];
	r[ 3] = a[3]*b[0] + a[7]*b[1] + a[11]*b[2] + a[15]*b[3];

	r[ 4] = a[0]*b[4] + a[4]*b[5] + a[8]*b[6] + a[12]*b[7];
	r[ 5] = a[1]*b[4] + a[5]*b[5] + a[9]*b[6] + a[13]*b[7];
	r[ 6] = a[2]*b[4] + a[6]*b[5] + a[10]*b[6] + a[14]*b[7];
	r[ 7] = a[3]*b[4] + a[7]*b[5] + a[11]*b[6] + a[15]*b[7];

	r[ 8] = a[0]*b[8] + a[4]*b[9] + a[8]*b[10] + a[12]*b[11];
	r[ 9] = a[1]*b[8] + a[5]*b[9] + a[9]*b[10] + a[13]*b[11];
	r[10] = a[2]*b[8] + a[6]*b[9] + a[10]*b[10] + a[14]*b[11];
	r[11] = a[3]*b[8] + a[7]*b[9] + a[11]*b[10] + a[15]*b[11];

	r[12] = a[0]*b[12] + a[4]*b[13] + a[8]*b[14] + a[12]*b[15];
	r[13] = a[1]*b[12] + a[5]*b[13] + a[9]*b[14] + a[13]*b[15];
	r[14] = a[2]*b[12] + a[6]*b[13] + a[10]*b[14] + a[14]*b[15];
	r[15] = a[3]*b[12] + a[7]*b[13] + a[11]*b[14] + a[15]*b[15];
	return r;
}




function eulerFromMatrix(m, order = 'XYZ') {
 
	const te = m;
	//normal
	const m00 = te[0], m01 = te[4], m02 = te[8];
	const m10 = te[1], m11 = te[5], m12 = te[9];
	const m20 = te[2], m21 = te[6], m22 = te[10];

	//transpose
	//const m00 = te[0], m01 = te[1], m02 = te[2];
	//const m10 = te[4], m11 = te[5], m12 = te[6];
	//const m20 = te[8], m21 = te[9], m22 = te[10];


	const THRESHOLD = 1.0 - 1e-7;

	let x, y, z;
	switch(order) {
		case 'XYZ': {
			y = Math.asin(clamp(m02, -1, 1));
			if(Math.abs(m02) < THRESHOLD) {
				x = Math.atan2(-m12, m22);
				z = Math.atan2(-m01, m00);
			} else {
				x = Math.atan2(m21, m11);
				z = 0;
			}
			break;
		}

		case 'YXZ': {
			x = Math.asin(-clamp(m12, -1, 1));
			if(Math.abs(m12) < THRESHOLD) {
				y = Math.atan2(m02, m22);
				z = Math.atan2(m10, m11);
			} else {
				y = Math.atan2(-m20, m00);
				z = 0;
			}
			break;
		}

		case 'ZXY': {
			x = Math.asin(clamp(m21, -1, 1));
			if(Math.abs(m21) < THRESHOLD) {
				y = Math.atan2(-m20, m22);
				z = Math.atan2(-m01, m11);
			} else {
				y = 0;
				z = Math.atan2(m10, m00); 
			}
			break;
		}

		case 'ZYX': {
			y = Math.asin(-clamp(m20, -1, 1));
			if(Math.abs(m20) < THRESHOLD) {
				x = Math.atan2(m21, m22);
				z = Math.atan2(m10, m00);
			} else {
				x = 0;
				z = Math.atan2(-m01, m11);
			}
			break;
		}

		case 'YZX': {
			z = Math.asin(clamp(m10, -1, 1));
			if(Math.abs(m10) < THRESHOLD) {
				x = Math.atan2(-m12, m11);
				y = Math.atan2(-m20, m00);
			} else {
				x = 0;
				y = Math.atan2(m02, m22);
			}
			break;
		}

		case 'XZY': {
			z = Math.asin(-clamp(m01, -1, 1));
			if(Math.abs(m01) < THRESHOLD) {
				x = Math.atan2(m21, m11);
				y = Math.atan2(m02, m00);
			} else {
				x = Math.atan2(-m12, m22);
				y = 0;
			}
			break;
		}

	}
	//roll pitch yaw
	return [x*180/3.1415, y*180/3.1415, z*180/3.1415];

}

function eulerToMatrix(yaw, pitch, roll) {
	let a = 3.1415*yaw/180;
	let b = 3.1415*pitch/180;
	let c = 3.1415*roll/180;

	let cosa = Math.cos(a);
	let sina = Math.sin(a);
	let cosb = Math.cos(b);
	let sinb = Math.sin(b);
	let cosc = Math.cos(c);
	let sinc = Math.sin(c);
	return [
		cosa*cosb, cosa*sinb*sinc - sina*cosc, cosa*sinb*cosc + sina*sinc, 0,
		sina*cosb, sina*sinb*sinc + cosa*cosc, sina*sinb*cosc - cosa*sinc, 0,
		-sinb,     cosb*sinc,                  cosb*cosc,                  0,
		0,         0,                          0,                          1
	];
}


function transpose(r) {
	let t = []
	for(let i = 0; i < 4; i++)
		for(let k =0; k < 4; k++) 
			t[i*4 + k] = r[i + k*4];
	return t;
}

export { Tour }
