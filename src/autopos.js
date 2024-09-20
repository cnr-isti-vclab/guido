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
		if(d>0) 
			visitedNodes.add(nodeIndex);
		console.log(`Visiting node ${nodeIndex}`);

		// Get the current node's outgoing links
		const currentNodeLinks = panorama.panos[nodeIndex].links;

		// Explore the 'manual' links
		for (let link of currentNodeLinks) {
		    let [index, yaw, pitch, how] = link; // Destructure the array, where 'how' is the last element
		    if (how === 'manual') {
		        console.log(`Following link from node ${nodeIndex} to node ${index}, yaw: ${yaw}, pitch: ${pitch}`);
		        
		        let [cyaw,cpitch,len ] = transf.posToYawPitch( panorama.panos[index].translation,panorama.panos[nodeIndex]);
		        
		        // Add the edge to the list of visited edges as an object
		        visitedEdges.push({
		            tail: nodeIndex,
		            head: index,
		            target_yaw: yaw*Math.PI/180, // atan2 returns value in radias, so yaw and pitch must be in radians too
		            target_pitch: pitch*Math.PI/180,
		            computed_yaw : cyaw*Math.PI/180,
		            computed_pitch : cpitch*Math.PI/180
		        });

		        // Recursively visit the connected node
		        dfs(index,d+1);
		  	}
	            }
	   	 }

	    // Start the DFS traversal from the root node
	    dfs(rootIndex,0);

	    // Return the set of nodes and the list of visited edges
	    return [ visitedEdges, [...visitedNodes] ];
	}
	

	
	// a problem is created with a set of constrained edges
	solve(panorama,edges,nodes){
		let H = 2.2;

		// nodes contains the sorted indices of the position that will be optimized
		
		let N = nodes.length*2; // two variables (x,y) for each node
		let M = edges.length*2; // two contraints for each edge
		 
		
		let A = math.sparse(math.zeros([M, N], 'sparse'));
		let b = math.sparse(math.zeros([M,1], 'sparse'));
		
		let ie = 0;
		let correct_result = [0,0];
		for(let e of edges){
			let p_head = panorama.panos[e.head].translation;
			let p_tail = panorama.panos[e.tail].translation;
			let dir = [p_head [0] - p_tail [0] ,p_head [1] - p_tail [1] ,p_head [2] - p_tail [2] ];
			let a = dir[0]*dir[0]+dir[2]*dir[2];
			let d_yaw =[- dir[2] / a,dir[0] / a];// derivative of atan2   on x,y
						
			let a_sr = Math.sqrt(a);
			let c = H*H+a;
			
			let d_pitch =[- H / c*dir[0]/ a_sr,1.0 / c*dir[2]];
			
			// find the place of edges.head in nodes
			let i_xy = nodes.indexOf(e.head)*2;
			
			A.set([ie*2,i_xy  ],d_yaw[0]);
			A.set([ie*2,i_xy+1],d_yaw[1]);
			b.set([ie*2,0],e.target_yaw + ( d_yaw[0]*p_head[0]+d_yaw[1]*p_head[2]-e.computed_yaw));
			
			A.set([ie*2+1,i_xy  ],d_pitch[0]);
			A.set([ie*2+1,i_xy+1],d_pitch[1]);
			b.set([ie*2+1,0],e.target_pitch + ( d_pitch[0]*p_head[0]+d_pitch[1]*p_head[2]-e.computed_pitch));

			ie = ie+1;
			
			correct_result = transf.yawPitchToPos(panorama.panos[e.tail],e.target_yaw,e.target_pitch);
		}
		
		let szA = A.size();
		let szb = b.size();
		let A_pInv = math.pinv(A);
		let szA_pInv = A_pInv.size();
		
		let x = math.multiply(A_pInv, b);
		let b1 = math.subtract(math.multiply(A, x),b);
		
		let denseX = x.toArray();
		let sz = x.size();
		
		for (let [i, n] of nodes.entries()) {
   		  panorama.panos[n].translation[0] = x.get([i*2,0]);	// x pos of node n	
   		  panorama.panos[n].translation[2] = x.get([i*2+1,0]);	// z pos of node n
		}
		
		
	}
	
	optimize_positions(panorama,rootId){
	 let edges_nodes = this.makeGraphFromRoot(panorama, rootId);
	 this.solve(panorama,edges_nodes[0],edges_nodes[1]);
	}

}

export {Autopos}

