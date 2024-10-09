import {Autopos} from './autopos.js'
import  { applyMatrix}  from './math.js'
import { Panorama } from './panorama.js'
import { getIcon, getIcons, createElement, createSvgElement } from './utils.js'
import MiniMap from './minimap.js';
import * as transf from './coordinates_transformation.js';

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

		this.previousScenes = [0];
		
		document.addEventListener('keydown', (event) => {
		
			if (event.key == "p"){
			if(this.previousScenes.length>1)
				this.previousScenes = this.previousScenes.splice(0,this.previousScenes.length-1);
				this.panorama.setPano(this.previousScenes[this.previousScenes.length-1]);
				}
			if (event.key == "o"){
				let id = this.panorama.viewer.getScene();
				this.autopos.optimize_positions(this.panorama,id);
			}
 			if (event.key == "m"){
 			
 				this.drawGraph();
			}

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


	drawGraph(){
		// Get the canvas element by its ID
		let canvas = document.getElementById('graphview_canvas');

		// Get the 2D drawing context
		let ctx = canvas.getContext('2d');
		const rect = canvas.getBoundingClientRect();	
		
		let mt = ctx.getTransform();
		if(mt.a == 1 && mt.d == 1 )
		{
		
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		
		// get the bounding box of the scene
		// HERE ASSUMING ONLY ONE SET
		let bbox =[0,0,0,0];
		bbox[0] = this.panorama.panos[0].translation[0];
		bbox[2] = this.panorama.panos[0].translation[0];
		bbox[1] = this.panorama.panos[0].translation[2];
		bbox[3] = this.panorama.panos[0].translation[2];
		for(let pano of this.panorama.panos) 
			for(let i of [0,1])
				if(pano.translation[i*2] <bbox[i] )
					bbox[i] = pano.translation[i*2];
					else
					if(pano.translation[i*2] > bbox[i+2] )
						bbox[i+2] = pano.translation[i*2];
		
		// viewing window on the data (slightly enlarge the bbox)
		let view = [ 	bbox[0]-(bbox[2]-bbox[0])*0.05,bbox[1]-(bbox[3]-bbox[1])*0.05,
				bbox[2]+(bbox[2]-bbox[0])*0.05,bbox[3]+(bbox[3]-bbox[1])*0.05
				];
		
		
		// set the vieport vp to to maximize the size in the available canvas
		const vp = [0,0,rect.right-rect.left,rect.bottom-rect.top];
		let szView 	=  [(view[2]-view[0]),(view[3]-view[1])];		
		const szVp 	=  [(vp[2]-vp[0]),(vp[3]-vp[1])];		

		
		let kw=1.0;
		let kh=1.0;
   		if( szView[1]/szView[0] > szVp[1]/szVp[0] ) 
			kw = szView[0]/szView[1]*szVp[1]/szVp[0];
		else 		
		  	kh = szView[1]/szView[0]*szVp[0]/szVp[1];	
  	
		vp[2] = szVp[0]*kw;
		vp[3] = szVp[1]*kh;


		// define the viewport transformation
		const ratioX =  ( vp[2]-vp[0] ) / (view[2]-view[0]);
		const ratioY = ( vp[3]-vp[1] ) / (view[3]-view[1]);

		ctx.setTransform(ratioX,0,0,-ratioY,-ratioX*view[0]+vp[0], ratioY*view[1]-vp[1] + (rect.bottom-rect.top));
		
		ctx.fillStyle = "blue"; // Set fill color
		
		console.log("transf ",ctx.getTransform());
		}
		else{
			ctx.setTransform(1,0,0,1,0,0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.setTransform(mt);
		}
		
		let id = this.panorama.viewer.getScene();
		for(let pano of this.panorama.panos){
				ctx.beginPath();
				ctx.fillStyle = "green"; // Set fill color
	 			ctx.arc(pano.translation[0], pano.translation[2], 2, 0, 2*Math.PI, false);
				if(pano.id != id)
		 			ctx.stroke();
	 			else
		 			ctx.fill();
		 			
		 		// show the north direction
		 		ctx.beginPath();
		 		let pos = transf.yawPitchToPos(pano,-pano.initialYaw,-30);
		 		ctx.moveTo(pano.translation[0], pano.translation[2]);  // Move the drawing cursor to the starting point
        			ctx.lineTo(pos[0], pos[2]); 
        			ctx.strokeStyle = "red"; // Set fill color
		 		ctx.stroke();
		 		
		 		ctx.beginPath();
		 		// show the initialYaw
		 		pos = transf.yawPitchToPos(pano,0,-10);
		 		ctx.moveTo(pano.translation[0], pano.translation[2]);  // Move the drawing cursor to the starting point
        			ctx.lineTo(pos[0], pos[2]); 
        			ctx.strokeStyle = "blue"; // Set fill color
		 		ctx.stroke();

			}
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
					
					let [yaw ,pitch ,d ] = transf.posToYawPitch(	target.translation,pano);
					let pos = transf.yawPitchToPos(pano,yaw,pitch);
					
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
		// here the second condition means we are going back along the buffer
		if(this.previousScenes.length==0 || this.previousScenes[this.previousScenes.length-1] != id)
			this.previousScenes.push(id);
			
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
