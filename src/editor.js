import { Panorama } from './panorama.js'
import { getIcon, getIcons, createElement, createSvgElement } from './utils.js'

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
		//this.panorama.addEvent('scenechange', (id) => this.sceneChange(id));
		//this.panorama.addEvent('panoclicked', (id) => this.panoClicked(id));

		this.panorama.editor = true;

		document.querySelector('#tour-initial').style.display = 'none';
		this.initToolbar();
	}

	initToolbar() {
		this.sections = 'entries';
		const toolbar = document.querySelector('.tour-toolbar');

		this.tools = {};
		for(let tool of ['entries', 'users', 'chat', 'options', 'guide', 'raise', 'laser'])
			document.querySelectorAll('.tour-toolbar .tour-' + tool).forEach( e => e.style.display = 'none');

	}

	createEntries(panos) {
		this.panos = panos;
		const entries = this.entries = document.querySelector('#tour-entries');

		for(let pano of this.panos) {
			if('priority' in pano)
				this.entries.append(this.createEntry(pano));
		}
	}

	createEntry(pano) {
		let li = createElement('li', { 'data-pano': pano.id })
		
		this.createEntryElement(pano, li);
		
		li.addEventListener('click', (e) => {
			e.stopPropagation();
			if(e.target.tagName == 'input' || e.target.tagName == 'svg') return;
			//this.panoClicked(e);
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
			//if(pano.id != this.viewer.getScene()) {
				//TODO viewer.addScene('currentSceneId', {new config}); followed by viewer.loadScene('currentSceneId');.
			//}
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