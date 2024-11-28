import {Autopos} from './autopos.js'
import {PositionEstimation,math} from './autopos.js'
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
		this.panorama.addEvent('scenechange', (id) => {this.sceneChange(id);this.drawGraph();});
		//this.panorama.addEvent('panoclicked', (id) => this.panoClicked(id));
		this.panorama.addEvent('movetarget_on', (coords) => this.panorama.moveMovingTarget(coords));

		this.panorama.addEvent('reassign_target_position', (targettoreassign) => {this.panorama.reassignTarget(targettoreassign);this.drawGraph();});

		this.panorama.editor = true;

		document.querySelector('#tour-initial').style.display = 'none';
		this.initToolbar();

	 	this.minimap = new MiniMap();
		this.autopos = new Autopos(this.panorama);
		this.autopos.addEvent('updategraph',() => this.drawGraph());
		

 
		this.previousScenes = [0];

        this.showArcs = true;
		this.showYaw  = false;
        this.ce_D = {id0:0,id1:0,v:[0,0,0]};
        this.id0 = -1;
        this.id1 = -1;
        this.pe = null;
        this.inputTwoNumbers();
		document.addEventListener('keydown', (event) => {
				
			switch(event.key){	
			case 'p':
				if(this.previousScenes.length>1)
					this.previousScenes = this.previousScenes.splice(0,this.previousScenes.length-1);
				this.panorama.setPano(this.previousScenes[this.previousScenes.length-1]);
				break;	
			case 'y': 
				this.autopos.useYaw = true;
				break;
			case 'i': 
				this.autopos.useYaw = false;
				break;
			case 'o': 
				let id = this.panorama.viewer.getScene();
				this.autopos.optimize_positions(this.panorama,id);
				break;
 			case 'g':
 				this.drawGraph();
 				break;
 			case 'a':
 				this.showArcs = !this.showArcs;
 				this.drawGraph();
 				break;
 			case 'd':
 				this.showYaw = !this.showYaw;
 				this.drawGraph();
 				break;
 			case 'r':
 				let allpanos = Array.from({ length: 126 }, (v, i) => i);
 				this.autopos.computeLinks(this.panorama,allpanos);
 				this.drawGraph();
 				break;
            case 'e':
                this.estimateCameraPosition();
                break;
            case 'w':
                this.estimateCameraPositionEqui();
                break;
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


    inputTwoNumbers(){
        // Create the container for the widget
        const container = document.createElement('div');
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.margin = '20px';

        // Add a title
        const title = document.createElement('h3');
        title.innerText = 'Enter Two Integers:';
        container.appendChild(title);

        // Create input fields for integers
        const input1 = document.createElement('input');
        input1.type = 'number';
        input1.step = '1'; // Restrict to integers
        input1.placeholder = 'Enter first integer';
        input1.style.marginRight = '10px';

        const input2 = document.createElement('input');
        input2.type = 'number';
        input2.step = '1'; // Restrict to integers
        input2.placeholder = 'Enter second integer';

        // Create a button to confirm inputs
        const button = document.createElement('button');
        button.innerText = 'Submit';
        button.style.marginLeft = '10px';

        // Append inputs and button to the container
        container.appendChild(input1);
        container.appendChild(input2);
        container.appendChild(button);

        // Add the container to the body
        document.body.appendChild(container);

        // Add functionality to capture inputs and remove the widget
        button.addEventListener('click', () => {
          const num1 = parseInt(input1.value, 10) || 0;
          const num2 = parseInt(input2.value, 10) || 0;

          // Return the numbers (for this example, log them in the console)
          this.id0 = num1;
          this.id1 = num2;

          // Remove the widget
         // container.remove();
        });
    }




    async estimateCameraPosition(){

        this.pe = new PositionEstimation();
        let matches = await this.pe.findCorrespondences(this.panorama,this.id0,this.id1);
        this.ce_D.v = this.pe.estimateCameraPositionFromCorrespondences(this.panorama.panos[this.id0],this.panorama.panos[this.id1],matches,true);
        this.ce_D.id0 = this.id0;
        this.ce_D.id1 = this.id1;
    }
    async estimateCameraPositionEqui(){

        this.pe = new PositionEstimation();
        let matches = await this.pe.findCorrespondencesEqui(this.panorama,this.id0,this.id1);
        this.ce_D.v = this.pe.estimateCameraPositionFromCorrespondences(this.panorama.panos[this.id0],this.panorama.panos[this.id1],matches,false);
        this.ce_D.id0 = this.id0;
        this.ce_D.id1 = this.id1;
    }
	drawArrow(ctx,x1, y1, x2, y2) {
	    const headLength = 3; // Length of the arrowhead

	    const angle = Math.atan2(y2 - y1, x2 - x1); // Calculate the angle of the line

	    // Draw the line (shaft of the arrow)
	    ctx.beginPath();
	    ctx.moveTo(x1, y1);
	    ctx.lineTo(x2, y2);
	    ctx.stroke();

	    // Draw the arrowhead (two lines forming a V shape)
	    ctx.beginPath();
	    ctx.moveTo(x2, y2);
	    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
	    ctx.moveTo(x2, y2);
	    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
	    ctx.stroke();
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
		let ratioX =  ( vp[2]-vp[0] ) / (view[2]-view[0]);
		let ratioY = ( vp[3]-vp[1] ) / (view[3]-view[1]);

		ctx.setTransform(ratioX,0,0,-ratioY,-ratioX*view[0]+vp[0], ratioY*view[1]-vp[1] + (rect.bottom-rect.top));
		
		ctx.fillStyle = "blue"; // Set fill color
		ctx.strokeStyle = "blue"; // Set fill color
		
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
/*		 		ctx.beginPath();
		 		let pos = transf.yawPitchToPos(pano,-pano.initialYaw,-30);
		 		ctx.moveTo(pano.translation[0], pano.translation[2]);  // Move the drawing cursor to the starting point
        			ctx.lineTo(pos[0], pos[2]); 
        			ctx.strokeStyle = "red"; // Set fill color
		 		ctx.stroke();
*/
				if(this.showYaw){		 		
			 		ctx.beginPath();
			 		// show the initialYaw
			 		let pos = transf.yawPitchToPos(pano,0,-10);
			 		ctx.moveTo(pano.translation[0], pano.translation[2]);  // Move the drawing cursor to the starting point
					ctx.lineTo(pos[0], pos[2]); 
					ctx.strokeStyle = "blue"; // Set fill color
			 		ctx.stroke();
				}
/*				if(pano.id == id)
				for(let [i,ng] of pano.links.entries())
				{
			 		ctx.beginPath();
			 		let pos = this.panorama.panos[ng[0]].translation;
			 		ctx.moveTo(pano.translation[0], pano.translation[2]);  // Move the drawing cursor to the starting point
					ctx.lineTo(pos[0], pos[2]); 
					ctx.strokeStyle = "blue"; // Set fill color
			 		ctx.stroke();
		 		}
		 		
*/
                let tail = [...pano.translation];
                if( pano.links !=  undefined &&this.showArcs)
                    for(let [i,ng] of pano.links.entries())
                     if(ng[3]=='manual')
                    {
                        ctx.beginPath();
                        let head = [...this.panorama.panos[ng[0]].translation];

                        let d = [tail[0]-head[0],tail[2]-head[2]];
                        let l = Math.sqrt(d[0]*d[0]+d[1]*d[1]);
                        d[0] = d[0] / l;
                        d[1] = d[1] / l;
                        tail[0] = tail[0]-d[0]*2;
                        tail[2] = tail[2]-d[1]*2;

                        head[0] = head[0]+d[0]*2;
                        head[2] = head[2]+d[1]*2;

                        this.drawArrow(ctx,tail[0], tail[2],head[0], head[2]);
                    }
 
			}

        if(this.ce_D.id0!=this.ce_D.id1){
                let t = this.panorama.panos[this.ce_D.id0].translation;
                let h = this.panorama.panos[this.ce_D.id1].translation;
                let h_t  =math.subtract(h,t);
                let d = math.norm(h_t);
                let v =  math.multiply(this.ce_D.v,d);
                let dh = math.add(t,v);
                this.drawArrow(ctx,t[0], t[2],dh[0], dh[2]);

                //
                let a = this.pe.a;
                let b = this.pe.b;

                this.drawArrow(ctx,t[0], t[2],t[0]+a[0]*15, t[2]+a[2]*15);
                this.drawArrow(ctx,h[0], h[2],h[0]+b[0]*15, h[2]+b[2]*15);

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
