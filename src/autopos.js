import { create, all,matrix } from 'mathjs'
import { applyMatrix}  from './math.js'
import { Panorama } from './panorama.js'

import * as transf from './coordinates_transformation.js';

const math = create(all);

class Autopos {

	constructor(){
	}
	
	makeGraphFromRoot(panorama, rootIndex) {
	    const visitedNodes = new Set(); // To track visited nodes
	    const visitedEdges = []; // To track visited edges

	    // Recursive DFS function
	    function dfs(nodeIndex,d) {
		if (visitedNodes.has(nodeIndex)) {
		    return; // Node already visited, skip it
		}

		// Mark this node as visited
		visitedNodes.add(nodeIndex);
		//console.log(`Visiting node ${nodeIndex}`);

		// Get the current node's outgoing links
		const currentNodeLinks = panorama.panos[nodeIndex].links;

		// Explore the 'manual' links
		for (let link of currentNodeLinks) {
		    let [index, yaw, pitch, how] = link; // Destructure the array, where 'how' is the last element
		    if (how === 'manual') {
		       // console.log(`Following link from node ${nodeIndex} to node ${index}, yaw: ${yaw}, pitch: ${pitch}`);
		        
		        let [cyaw,cpitch,len ] = transf.posToYawPitch( panorama.panos[index].translation,panorama.panos[nodeIndex]);
		        
		        // Add the edge to the list of visited edges as an object
		        visitedEdges.push({
		            tail: nodeIndex,
		            head: index,
		            target_yaw: yaw*Math.PI/180, // atan2 returns value in radians, so yaw and pitch must be in radians too
		            target_pitch: pitch*Math.PI/180,
		            computed_yaw : cyaw*Math.PI/180,
		            computed_pitch : cpitch*Math.PI/180
		        });

		        // Recursively visit the connected node
		        dfs(index,d+1);
		  	}
		  	// look for link to nodeIndex from index (this assumes that edges are bidirectional)
 		  	for(let lnk of panorama.panos[index].links){
			  	 let [idx, yaw, pitch, how] = lnk; // Destructure the array, where 'how' is the last element
			  	   if (idx === nodeIndex && how === 'manual') {
					dfs(index,d+1);
				   }
		  	}
		  	 
	            }
	   	 }

	    // Start the DFS traversal from the root node
	    dfs(rootIndex,0);
			
	    // Return the set of nodes and the list of visited edges
	    return [ visitedEdges, [...visitedNodes] ];
	}
	

	
	setupProblem(panorama,edges,nodes){
		let H = 2;
		let correct_result = [0,0,0];
			

		let N = nodes.length*2; // two variables (x,y) for each node
		let M = edges.length*2; // two contraints for each edge
		 
		 
 //		console.log('initial pos');
 //		console.log(panorama.panos[nodes[0]].translation);
 		
		let A = math.sparse(math.zeros([M, N], 'sparse'));
		let b = math.sparse(math.zeros([M, 1], 'sparse'));



	
		// initial estimation
		let cnt = Array(nodes.length).fill(0);
		let inipos = Array(nodes.length*2).fill(0);
		for(let [ie, e] of edges.entries()){
			//let p_head = panorama.panos[e.head].translation;
			//let p_tail = panorama.panos[e.tail].translation;
			let i_xy = nodes.indexOf(e.head);
			cnt[i_xy]++;
			
//			let pos = transf.yawPitchToPos(panorama.panos[e.tail],e.target_yaw*180/Math.PI,e.target_pitch*180/Math.PI);
//			console.log("correct ",transf.yawPitchToPos(panorama.panos[e.tail],e.target_yaw*180/Math.PI,e.target_pitch*180/Math.PI));
			let pos = panorama.panos[e.head].translation;
			
			inipos[i_xy*2]   += pos[0];
			inipos[i_xy*2+1] += pos[2];
//			console.log('inipos',i_xy,pos[0],pos[2]);
		}		
	//	console.log('avg inipos');
		for(let [i, n] of nodes.entries()){
			inipos[i*2] 	/= cnt[i];
			inipos[i*2+1] /= cnt[i];
//			console.log(inipos[i*2],inipos[i*2+1]);
		}
		
		
		let out_d_yaw =[0,0];
		let out_d_pitch = [0,0];
		let out_delta_yaw = 0;
		let out_delta_pitch = 0;
		
		for(let [ie, e] of edges.entries()){
		
			// find the place of edges.head in nodes
			let i_xy = nodes.indexOf(e.head)*2;			
			
			let p_head = [inipos[i_xy],0,inipos[i_xy+1]];
			let p_tail = panorama.panos[e.tail].translation;
			let dir = [p_head [0] - p_tail [0] ,p_head [1] - p_tail [1] ,p_head [2] - p_tail [2] ];
			
			
			let res = transf.posToYawPitch(p_head,panorama.panos[e.tail]);
			res[0]*=Math.PI/180;
			res[1]*=Math.PI/180;
			
			e.computed_yaw 	= res[0];
			e.computed_pitch 	= res[1];
			
			let a = dir[0]*dir[0]+dir[2]*dir[2];
			let d_yaw =[  dir[2] / a, -dir[0] / a];// derivative of atan2   on x,y
			
			let a_sr = Math.sqrt(a);
			let c = H*H+a;
			
 			let d_pitch =[- (-H) *dir[0]/ (c*a_sr), - (-H)*dir[2] / (c*a_sr)];

		//	console.log('dyaw',d_yaw,'dpitch',d_pitch);
			
			let t_yaw = e.target_yaw;
			let sign = (t_yaw> e.computed_yaw )?-1:1;
			if ( Math.abs(  t_yaw - e.computed_yaw ) > Math.PI ) 
				t_yaw = t_yaw+ sign * 2*Math.PI;
				 
			
			A.set([ie*2,i_xy  ],d_yaw[0]);
			A.set([ie*2,i_xy+1],d_yaw[1]);
			b.set([ie*2,0],t_yaw + ( d_yaw[0]*p_head[0]+d_yaw[1]*p_head[2]-e.computed_yaw));
			
			A.set([ie*2+1,i_xy  ],d_pitch[0]);
			A.set([ie*2+1,i_xy+1],d_pitch[1]);
			b.set([ie*2+1,0],e.target_pitch + ( d_pitch[0]*p_head[0]+d_pitch[1]*p_head[2]-e.computed_pitch));
			
			
			out_d_yaw =d_yaw;
			out_d_pitch = d_pitch;
			out_delta_yaw = e.target_yaw-e.computed_yaw;
			out_delta_pitch = e.target_pitch-e.computed_pitch;
		}
		return [A,b,out_d_yaw,out_d_pitch,out_delta_yaw,out_delta_pitch];	
	}
	
	// a problem is created with a set of constrained edges
	solve(panorama,edges,nodesIn){
		let H = 2;

		let x = 0.0;
		let y = 0.0;

		let correct = transf.yawPitchToPos(panorama.panos[edges[0].tail],edges[0].target_yaw*180/Math.PI,edges[0].target_pitch*180/Math.PI);
//		console.log('current yaw and pitch',edges[0].computed_yaw,edges[0].computed_pitch);
//		console.log('target yaw and pitch',edges[0].target_yaw,edges[0].target_pitch);
//		console.log("current position ",panorama.panos[edges[0].head].translation);
//		console.log("correct position would be",correct);
		
		// DEVEL (consider fixed the root node of the tree)
		let nodes = [...nodesIn];
		nodes.splice(0,1);
		//
		let ie = 0;
		let dense_x = [0,0];
		let max_ite = 50; 
		
		let max_delta = 100;
//		for(let i=0; i < n_ite; ++i)

		console.log('---------------');
		let i=0;
		 while( (i< max_ite) && (max_delta>1.0))
		{
			max_delta = 0;
			i++;
			let prob = this.setupProblem(panorama,edges,nodes);
			let A_pInv = math.pinv(prob[0]);
			
			let x = math.multiply(A_pInv, prob[1]);
	 		dense_x = x.toArray();
//			console.log('sol:',dense_x[0],dense_x[1]);
			let err = math.multiply(prob[0],x);
			err = math.subtract(err,prob[1]);
			
			for (let [i, n] of nodes.entries()) {
			

				let delta = [ x.get([i*2,0])-panorama.panos[n].translation[0] , x.get([i*2+1,0])-panorama.panos[n].translation[2]];
				let deltalength = Math.sqrt(delta[0]*delta[0] + delta[1]*delta[1]);
				
				// error
				console.log("pano ",n,"y ",err.get([i*2,0])*err.get([i*2,0]),"p ",err.get([i*2+1,0])*err.get([i*2+1,0]));


				if(deltalength>max_delta)
					max_delta = deltalength;
				
				if( deltalength > 1.0 ){
					delta[0] /=  deltalength;
					delta[1] /=  deltalength;
				}


		   		  panorama.panos[n].translation[0] += delta[0];	// x pos of node n	
		   		  panorama.panos[n].translation[2] += delta[1];	// z pos of node n
			}
 		}
		
	}
	
	optimize_positions(panorama,rootId){
//	 console.clear();
	 let edges_nodes = this.makeGraphFromRoot(panorama, Number(rootId));
	 this.solve(panorama,edges_nodes[0],edges_nodes[1]);
	 this.computeLinks(panorama,edges_nodes[1]);
	}

	computeLinks(panorama,panosToUpdate){
		let config  = panorama.viewer.getConfig();
		let panos = panorama.panos;
		
		for(let i of panosToUpdate){
			let targetId = panos[i].id;
			console.log('pano to update',targetId);
			for(let [il,ng] of panos[targetId].links.entries())// for all links of the target (bidirectional edges assumed)
				{
				 let yp = transf.posToYawPitch(panos[targetId].translation, panos[ng[0]]);
				 let index_tp =  panos[ng[0]].links.findIndex(e => e[0] == targetId);
				 if(index_tp == -1)
				 continue;
				 
				 Object.assign( panos[ng[0]].links[index_tp], [targetId,yp[0],yp[1],'computed']);
				 console.log('pano ',targetId, ' to ', ng[0],':', yp[0],yp[1]);


				 
				 let index = config.scenes[ng[0]].hotSpots.findIndex(e => e.sceneId == targetId);
				 config.scenes[ng[0]].hotSpots[index].yaw  = yp[0];
				 config.scenes[ng[0]].hotSpots[index].pitch= yp[1];
				 
//				 Object.assign(config.scenes[ng[0]].hotSpots[index].yaw,yp[0]);
//				 Object.assign(config.scenes[ng[0]].hotSpots[index].pitch,yp[1]);
				 

/*				 console.log('pano ',ng[0], ' to ', targetId );
			 
				 yp = transf.posToYawPitch( panos[ng[0]].translation, panos[targetId]);
				 Object.assign( panos[targetId].links[il], [ng[0],yp[0],yp[1],'computed']);
				 
				 index = config.scenes[targetId].hotSpots.findIndex(e => e.sceneId == ng[0]);
				 
				 let hs = config.scenes[targetId].hotSpots[index];
				 hs.yaw = yp[0];
				 hs.pitch = yp[1];
				 Object.assign(config.scenes[targetId].hotSpots[index],hs);
*/
				}
		}
	}			
}

export {Autopos}

