import {Autopos} from './autopos.js'
import  { applyMatrix}  from './math.js'
import { Panorama } from './panorama.js'
import { getIcon, getIcons, createElement, createSvgElement } from './utils.js'
import MiniMap from './minimap.js';

class Editor {

	constructor(container, panourl) {

		if(typeof(container) == 'string')
			container = document.querySelector(container);
		this.container = container;
	
		this.panorama = new Panorama(panourl, container);
		this.panorama.addEvent('loaded',      () => this.createEntries(this.panorama.panos));
		//this.panorama.addEvent('zoomchange',  (e) => this.zoomChange(e));
		//this.panorama.addEvent('wheelevent',  (e) => this.wheelEvent(e));

		//this.panorama.addEvent('viewchange',   (e) => this.viewChange(e));
		this.panorama.addEvent('scenechange', (id) => this.sceneChange(id));
		//this.panorama.addEvent('panoclicked', (id) => this.panoClicked(id));
		this.panorama.addEvent('movetarget_on', (coords) => this.panorama.moveMovingTarget(coords));

		this.panorama.addEvent('reassign_target_position', (targettoreassign) => this.panorama.reassignTarget(targettoreassign));

		this.panorama.editor = true;

		document.querySelector('#tour-initial').style.display = 'none';
		this.initToolbar();

		this.minimap = new MiniMap();
		this.autopos = new Autopos(this.panorama);

		document.addEventListener('keydown', (event) => {
			if (event.keyCode != 32) return;
			let id = this.panorama.viewer.getScene();
			this.autopos.optimize_positions(this.panorama,id);
			
				
			
/*			let id = this.panorama.viewer.getScene();			
			let pano = this.panos.find(e => e.id == id);
			if(!pano) return;

			pano.yaw = this.panorama.viewer.getYaw();
			pano.pitch = this.panorama.viewer.getPitch();
			pano.fov = this.panorama.viewer.getHfov();
			this.save();
*/
		});
		
		 
	}

	posToYawPitch(pos, pano){
		let H = 2.2;
		let tx = pos[0];
		let ty = pos[1];
		let tz = pos[2];
		
		let x = pano.translation[0];
		let y = pano.translation[1];
		let z = pano.translation[2];	
		
		let dir = [tx - x, -H, tz - z, 1];
		let len = Math.sqrt(dir[0]*dir[0]+dir[1]*dir[1]+dir[2]*dir[2]);
		dir[0]/=len;
		dir[1]/=len;
		dir[2]/=len;
			
		let angle = 180*Math.atan2(dir[0], dir[2])/Math.PI;
		
		let yaw =  (angle + 360)%360;  	// yaw and initialYaw i nthe same reference system now
		yaw =  (yaw-pano.initialYaw+360)%360;  // distance between yaw and initialiYaw in [0,360]
		yaw = ((yaw + 180)%360)-180;


		let pitch = -180*Math.atan2(H, len)/Math.PI; 
		
		return [yaw,pitch,len];
	}
	
	yawPitchToDir(pano,yaw,pitch){
		yaw = (yaw + 360)%360; 			// bring yaw from -180,180 to 0-360
		yaw = (yaw+pano.initialYaw+360)%360;	// add pano.initialYaw
		
		let dir = [0,0,0];
		dir[0] = Math.cos(pitch*Math.PI/180)*Math.sin(yaw*Math.PI/180);
		dir[2] = Math.cos(pitch*Math.PI/180)*Math.cos(yaw*Math.PI/180);
		dir[1] = Math.sin(pitch*Math.PI/180);
		return dir;	
	}

	yawPitchToPos(pano,yaw,pitch){
		let dir = this.yawPitchToDir(pano,yaw,pitch);
		let H = 2.2;
		let t = Math.abs(H / dir[1]);
		
		let pos = [0,0,0];
		pos[0] = pano.translation[0]+t*dir[0];
		pos[1] = 0;
		pos[2] = pano.translation[2]+t*dir[2];
		
		return pos;
	
	}
	
	// take yaw, pitch and target pos and return the pano pos (to which yaw and pitch refer)
	yawPitchTargetToPos(pano,targetpano,yaw,pitch){
		let dir = this.yawPitchToDir(pano,yaw,pitch);
		
		let H = 2.2;
		let t = Math.abs(H / dir[1]);
		
		let pos = [0,0,0];
		pos[0] = targetpano.translation[0]-t*dir[0];
		pos[1] = 0;
		pos[2] = targetpano.translation[2]-t*dir[2];
		
		return pos;
	}
	
	createGraph(){
		for(let pano of this.panorama.panos){
			
			if(pano.links == null){ // first creation of the graph
				pano.priority = 2;					
				pano.links = [];
				
				let x = pano.translation[0];
				let y = pano.translation[1];
				let z = pano.translation[2];
				
				for(let target of this.panorama.panos) {
				if(target == pano || target.skip || target.set != pano.set ||
					(pano.skipLinks.includes(target.id) && !this.editor))
					continue;
					
					let [yaw ,pitch ,d ] = this.posToYawPitch(	target.translation,pano);
					let pos = this.yawPitchToPos(pano,yaw,pitch);
					
					//this is for lucca
					let short_range = 100;
					let mid_range = 150;
					let long_range = 300;

					//this is dor pisa:
					short_range = 60;
					mid_range = 100;
					long_range = 200;

					if( /* target.priority == 0 && d < long_range ||
						target.priority == 1 && d < mid_range || */
						d < short_range) {
 						pano.links.push([target.id , yaw , pitch,'projected']);
					}	
					
					}
			}
 			else 
			{ // graph edited
				//for(let target of pano.links){
				
				//} 
			}
 
		}
	}
	
	save() {
		this.createGraph();
		this.minimap.saveDataset();
	}

	initToolbar() {
		this.sections = 'entries';
		document.querySelector('.tour-toolbar').style.display = 'none';
		document.querySelector('#users_video').style.display = 'none';
	}

	sceneChange(id) {
		this.entries.querySelectorAll('[data-pano]').forEach(p => p.classList.remove('current'));
		let entry = this.entries.querySelector(`[data-pano="${id}"]`);
		if(entry)
			entry.classList.add('current');
	}

	createEntries(panos) {

		//for(let p of panos)
		//	p.translation[1] = p.translation[2];
		this.minimap.init(this.panorama.dataset);

		this.panos = panos;
		const entries = this.entries = document.querySelector('#tour-entries');

		let set = null;
		for(let pano of this.panos) {
			if(set != pano.set) {
				let li = createElement('li', { class: 'tour-set' });
				li.textContent = pano.set.toUpperCase();
				set = pano.set;
				this.entries.append(li);
				li.addEventListener('click', (e) => { 
					document.querySelectorAll(`[data-set="${pano.set}"]`).forEach(e => e.classList.toggle('hidden')); 
					li.classList.toggle('closed');
				});
			}
			if('priority' in pano)
				this.entries.append(this.createEntry(pano));
		}
	}

	createEntry(pano) {
		let li = createElement('li', { 'data-pano': pano.id, 'data-set': pano.set })
		
		this.createEntryElement(pano, li);
		
		li.addEventListener('click', (e) => {
			e.stopPropagation();
			if(e.target.tagName == 'input' || e.target.tagName == 'svg') return;
			//this.panoClicked(e);
			this.minimap.changeMap(pano.id);
			this.panorama.setPano(pano.id, true);
		});
		return li;
	}

	createEntryElement(pano, li) {
		let icon = '';
		if(pano.priority == 0)
			icon = getIcon('location');
		else if(pano.priority == 1)
			icon = getIcon('waypoint');
			
		let input = createElement('input', { type: 'checkbox' });
		if(pano.skip != true)
			input.setAttribute('checked', 'checked');
		li.append(input);
		let span = createElement('span');
		span.textContent = ` ${pano.label || pano.id}`;
		li.append(span);

		input.addEventListener('change', (e) => {
			pano.skip = !input.checked;
			let spot = document.querySelector(`[data-target="${pano.id}"]`);
			if(spot)
				spot.style.display = pano.skip ? 'none' : 'block';
			e.stopPropagation();
			e.preventDefault();
			this.save();
		});
		input.addEventListener('click', (e)  => {
			e.stopPropagation();
		});
		span.addEventListener('click', (e) => {
			if(pano.id == this.panorama.viewer.getScene()) {
				let input = createElement('input', {type: 'text', value: pano.label});
				span.innerHTML = '';
				span.append(input);
				input.focus();
				input.addEventListener('blur', () => {
					pano.label = input.value;
					span.innerHTML = `${pano.label || pano.id}`;
				});
				e.stopPropagation();
			this.save();
			}
		});
		if(!('priority' in pano))
			pano.priority = 2;
		
		let priorities = ['location', 'waypoint', 'spot'];
		
		let priority = createElement('div', { class: 'tour-entrypriority', style: 'float:right'});
		priority.innerHTML = getIcon(priorities[pano.priority]);
		li.append(priority);
		priority.addEventListener('click', (e) => {
			pano.priority = (pano.priority+2)%3;
			priority.innerHTML = getIcon(priorities[pano.priority]);
			this.save();
		});
	}

	createToolbarElements(toolbar) {
		toolbar.innerHTML = getIcons('list', 'load', 'save', 'screenshot');
		toolbar.querySelector('.tour-upload').addEventListener('click', (e) => {
			this.upload();
		});
		toolbar.querySelector('.tour-save').addEventListener('click', (e) => {
			this.save();
		});
		toolbar.querySelector('.tour-screenshot').addEventListener('click', (e) => {
			this.setView();
		});
	}
}

export { Editor }
