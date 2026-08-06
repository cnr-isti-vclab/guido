import  { applyMatrix}  from './math.js'
 
import { Panorama } from './panorama.js'
import { getIcon, getIcons, createElement, createSvgElement } from './utils.js'
import MiniMap from './minimap.js';

class Editor{

	constructor(container, panourl) {
	
		if(typeof(container) == 'string')
			container = document.querySelector(container);
		this.container = container;
	
		this.panorama = new Panorama(panourl, container);
		this.panorama.editor = true;

	 
		this.current_placing_id = -1;

		
		this.panorama.addEvent('loaded',      () => this.createEntries(this.panorama ));
		this.panorama.addEvent('scenechange', (id) => this.sceneChange(id));

		this.panorama.editor = true;

		document.querySelector('#tour-initial').style.display = 'none';
		this.initToolbar();

		this.minimap = new MiniMap();

		document.addEventListener('keydown', (event) => {
			 console.log('keydown');
			 
		});
		


		document.addEventListener('keyup', (event) => {
			 console.log('keyup');
		});

/*	 	document.addEventListener('click', (event) => {

			// Calculate the exact pixel coordinates inside the canvas container
			const x = event.clientX ;
			const y = event.clientY ;

			console.log(`Clicked canvas local pixels -> X: ${x}, Y: ${y}`);
			if(this.current_placing_id != -1)   {
				console.log(`set image position`);
			}
		 
			// Put your custom code here (it runs alongside Pannellum's normal behavior)
		});
*/		 
	}

	createGraph(){
		for(let pano of this.panorama.panos){
			let x = pano.translation[0];
			let y = pano.translation[1];
			let z = pano.translation[2];
			pano.links = [];
			
			for(let target of this.panorama.panos) {
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

				//this is for lucca
				let short_range = 100;
				let mid_range = 150;
				let long_range = 300;

				//this is dor pisa:
				short_range = 50;
				mid_range = 100;
				long_range = 200;

				if(target.priority == 0 && d < long_range ||
					target.priority == 1 && d < mid_range ||
					d < short_range) {
//					links.push(target);
					pano.links.push(target.id);
				}	
				
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

	
	createEntries(panorama) {

		//for(let p of panos)
		//	p.translation[1] = p.translation[2];
		this.minimap.init(this.panorama.dataset);

		this.panos = panorama.panos;
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

		let li = createElement('li', { class: 'tour-set',style: 'margin-top: 20px;' });
		li.textContent = "IMAGES";
		this.entries.append(li);
		let i = 0;
		for(let photo of panorama.dataset.photos) {
			
			photo.id = i;
			this.entries.append(this.createEntryPhoto(photo));
			++i;
		}


	}

	refreshPhotoPlacing(){
		let i = 0;
		for(let li of this.entries.querySelectorAll('[data-photo]')) {
			const placing_icon = li.querySelector('.tour-entrypriority');
				if(i == this.current_placing_id) 
					placing_icon.innerHTML = getIcon('photograph_placing'); 
				else 
					placing_icon.innerHTML = getIcon('photograph');
				++i;
		}
	}
	
	createEntry(pano) {
		let li = createElement('li', { 'data-pano': pano.id, 'data-set': pano.set })
		
		this.createEntryElement(pano, li);
		
		li.addEventListener('click', (e) => {
			e.stopPropagation();
			if(e.target.tagName == 'input' || e.target.tagName == 'svg') return;
			//this.panoClicked(e);
			console.log('clicked pano');
			this.minimap.changeMap(pano.id);
			this.panorama.setPano(pano.id, true);
		});
		return li;
	}

	createEntryPhoto(photo) {
		let li = createElement('li', { 'data-photo': photo.set, 'data-set': photo.tooltip })
		
		this.createEntryElementPhoto(photo, li);
		
/*		li.addEventListener('click', (e) => {
			e.stopPropagation();
			if(e.target.tagName == 'input' || e.target.tagName == 'svg') return;
			//this.panoClicked(e);
			this.minimap.changeMap(pano.id);
			this.panorama.setPano(pano.id, true);
		});
*/		
		return li;
	}

	createEntryElement(pano, li) {
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

	createEntryElementPhoto(photo, li) {
		let icon = '';
			
		let input = createElement('input', { type: 'checkbox' });
		input.setAttribute('checked', 'checked');
		li.append(input);
		let span = createElement('span');
		span.textContent = ` ${photo.set || photo.name}`;
		li.append(span);

		input.addEventListener('change', (e) => {
			// HERE tell if to use this photo or not
			// ...
			console.log('changed photo');
			e.stopPropagation();
			e.preventDefault();
			this.save();
		});
		input.addEventListener('click', (e)  => {
			console.log('clicked photo');
			e.stopPropagation();
		});
/*		span.addEventListener('click', (e) => {
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
		*/
		let photoinput = createElement('div', { class: 'tour-entrypriority', style: 'float:right'});
		photoinput.innerHTML = getIcon('photograph');
		li.append(photoinput);
		photoinput.addEventListener('mouseup', (e) => {
			console.log('clicked photoinput');
		 
			let coords = this.panorama.mousePositionToCoords(this.panorama.mousePosition); 
 
			this.save();
			if(this.current_placing_id == photo.id && photo.placing)  
				{ 
				this.current_placing_id = -1;
				
				const uiLayer = this.panorama.viewer.getContainer().querySelector('.pnlm-ui');
				console.log(uiLayer);
				uiLayer.classList.remove('placing-mode');
			}
			else  
				{ 
				this.current_placing_id = photo.id;
				
				const uiLayer = this.panorama.viewer.getContainer().querySelector('.pnlm-ui');
				console.log(uiLayer);
				uiLayer.classList.add('placing-mode');
				}
	 		
			this.refreshPhotoPlacing();
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
