import { create, all,matrix } from 'mathjs'
import { applyMatrix}  from './math.js'
import { Panorama } from './panorama.js'
import { addSignals } from './signals.js'
import {Iqr} from './iqr.js'
import * as transf from './coordinates_transformation.js';

const math = create(all);


class PositionEstimation{
    constructor(){
    this.im = [0,0];
    this.img = [0,0];
    this.ims =[[],[]];
    for(var i=0; i < 4;++i){
            this.ims[0].push(new Image());
            this.ims[0][i].crossOrigin = 'Anonymous';

            this.ims[1].push(new Image());
            this.ims[1][i].crossOrigin = 'Anonymous';
        }
    this.canvas = [0,0];
    this.canvas[0] = document.createElement('canvas');
    this.canvas[1] = document.createElement('canvas');
    this.canvasbig = document.createElement('canvas');
    let c = document.getElementById('canvasbig');
     if(c!=null)
            c.remove();
    this.canvasbig.id = "canvasbig";


     this.canvasplot =   document.createElement('canvas');
    c = document.getElementById('canvasplot');
         if(c!=null)
                c.remove();
     this.canvasplot.id = 'canvasplot';
    }


    loadImageFace(i,j,imageUrl){

        // When the image loads, process it
        return  new Promise((resolve, reject) => {
            // Create an Image object
            this.ims[i][j].onload = () => {
              console.log('Image loaded.');
              resolve();
             };
          this.ims[i][j].src = imageUrl;
        });

    }

    loadImage(i,imageUrl){

        // When the image loads, process it
        return  new Promise((resolve, reject) => {
            // Create an Image object
            this.img[i] = new Image();
            this.img[i].crossOrigin = 'Anonymous'; // Enable CORS if the image is hosted on another domain

            this.img[i].onload = () => {
              // Access pixel data
              const ctx = this.canvas[i].getContext('2d');
              ctx.drawImage(this.img[i], 0, 0);
              this.im[i] =  ctx.getImageData(0, 0, this.canvas[i].width, this.canvas[i].height);
              resolve();
             };
          this.img[i].src = imageUrl;
        });

    }

  async loadequirectangular(panorama,id,i){
          this.canvas[i] = document.createElement('canvas');
          const ctx = this.canvas[i].getContext('2d');

          // Set canvas dimensions to match the image
          this.canvas[i].width = 6720;
          this.canvas[i].height = 3360;


         let ur = 'https://nb-ganovelli.isti.cnr.it/datasets/miracoli_dawn/panos/'+panorama.panos[id].url;
         await this.loadImage(i,ur);

         }

  async loadpanostripe(panorama,id,i){
      let ur = 'https://nb-ganovelli.isti.cnr.it/datasets/miracoli_dawn/panos/'+panorama.panos[id].url.slice(0,-4)+'/fallback/';
    await this.loadImageFace(i,0, ur+'l.jpg');
    await this.loadImageFace(i,1, ur+'f.jpg');
    await this.loadImageFace(i,2, ur+'r.jpg');
    await this.loadImageFace(i,3, ur+'b.jpg');

    this.canvas[i] = document.createElement('canvas');
    const ctx = this.canvas[i].getContext('2d');

    // Set canvas dimensions to match the image
    this.canvas[i].width = 4096;
    this.canvas[i].height = 1024;

    // Draw the image on the canvas
    ctx.drawImage(this.ims[i][0], 0, 0);
    ctx.drawImage(this.ims[i][1], 1024, 0);
    ctx.drawImage(this.ims[i][2], 2048, 0);
    ctx.drawImage(this.ims[i][3], 3072, 0);

    //document.body.appendChild(this.canvas[id]);

    // Access pixel data
    this.im[i] =  ctx.getImageData(0, 0, this.canvas[i].width, this.canvas[i].height);
  }
    async findCorrespondencesEqui(panorama,id0,id1){
           await this.loadequirectangular(panorama,id0,0);
           await this.loadequirectangular(panorama,id1,1);
           let matches = this.computeMatches();

           this.canvasbig.height = 6720;
           this.canvasbig.width =  3360*2;
           let ctxb = this.canvasbig.getContext('2d');
           // Draw the image on the canvas
           ctxb.drawImage(this.img[0],    0, 0);
           ctxb.drawImage(this.img[1],    0, 3360);


           let i =0;
           for(let m of matches)
                       {
               let b = (m.confidence-0.8)/0.2;
               if(b<0)b=0;
               b = b*360 ;
               ctxb.fillStyle = `hsl(${b},100%,50%)`; // Set fill color
               ctxb.beginPath();
               ctxb.arc(m.keypoint1[0], m.keypoint1[1], 5, 0, 2*Math.PI, false);
               ctxb.fill();


               ctxb.strokeStyle = `hsl(${b},100%,50%)`; // Set fill color
               ctxb.fillStyle = `hsl(${b},100%,50%)`;// Set fill color


                if(i==0)
                   ctxb.fillStyle = `yellow`;// Set fill color

               ctxb.beginPath();
               if(i==0)
                      ctxb.arc(m.keypoint2[0], m.keypoint2[1]+3360, 10, 0, 2*Math.PI, false);
   else
                      ctxb.arc(m.keypoint2[0], m.keypoint2[1]+3360, 5, 0, 2*Math.PI, false);
               ctxb.fill();

               ctxb.beginPath();
               ctxb.moveTo(m.keypoint1[0], m.keypoint1[1]);  // Move the drawing cursor to the starting point
               ctxb.lineTo(m.keypoint2[0], m.keypoint2[1]+3360);
               ctxb.stroke();

               i=i+1;
            }

           document.body.appendChild(this.canvasbig);
            return matches;
         }
    computeMatches(){
               let width = this.im[0].width;
               let height = this.im[0].height;
               let blurRadius = 3;

                 var gray1 = tracking.Image.grayscale(tracking.Image.blur(this.im[0].data, width, height, blurRadius), width, height);
                 var gray2 = tracking.Image.grayscale(tracking.Image.blur(this.im[1].data, width, height, blurRadius), width, height);

                 var corners1 = tracking.Fast.findCorners(gray1, width, height);
                 var corners2 = tracking.Fast.findCorners(gray2, width, height);

                 var descriptors1 = tracking.Brief.getDescriptors(gray1, width, corners1);
                 var descriptors2 = tracking.Brief.getDescriptors(gray2, width, corners2);

                 var matches = tracking.Brief.reciprocalMatch(corners1, descriptors1, corners2, descriptors2);

                 matches.sort(function(a, b) {
                   return b.confidence - a.confidence;
                 });

               matches = matches.filter( v => {
                       return v.confidence > 0.85;
                   });
                return matches;
            }

    async findCorrespondences(panorama,id0,id1){

        await this.loadpanostripe(panorama,id0,0);
        await this.loadpanostripe(panorama,id1,1);

        let matches = this.computeMatches();


        this.canvasbig.height = 2048;
        this.canvasbig.width =  4096;
        let ctxb = this.canvasbig.getContext('2d');
        // Draw the image on the canvas
        ctxb.drawImage(this.ims[0][0],    0, 0);
        ctxb.drawImage(this.ims[0][1], 1024, 0);
        ctxb.drawImage(this.ims[0][2], 2048, 0);
        ctxb.drawImage(this.ims[0][3], 3072, 0);
        ctxb.drawImage(this.ims[1][0],    0, 1024);
        ctxb.drawImage(this.ims[1][1], 1024, 1024);
        ctxb.drawImage(this.ims[1][2], 2048, 1024);
        ctxb.drawImage(this.ims[1][3], 3072, 1024);



        let i =0;
        for(let m of matches)
                    {
            let b = (m.confidence-0.8)/0.2;
            if(b<0)b=0;
            b = b*360 ;
            ctxb.fillStyle = `hsl(${b},100%,50%)`; // Set fill color
            ctxb.beginPath();
            ctxb.arc(m.keypoint1[0], m.keypoint1[1], 5, 0, 2*Math.PI, false);
            ctxb.fill();


            ctxb.strokeStyle = `hsl(${b},100%,50%)`; // Set fill color
            ctxb.fillStyle = `hsl(${b},100%,50%)`;// Set fill color


             if(i==0)
                ctxb.fillStyle = `yellow`;// Set fill color

            ctxb.beginPath();
            if(i==0)
                   ctxb.arc(m.keypoint2[0], m.keypoint2[1]+1024, 10, 0, 2*Math.PI, false);
else
                   ctxb.arc(m.keypoint2[0], m.keypoint2[1]+1024, 5, 0, 2*Math.PI, false);
            ctxb.fill();

            ctxb.beginPath();
            ctxb.moveTo(m.keypoint1[0], m.keypoint1[1]);  // Move the drawing cursor to the starting point
            ctxb.lineTo(m.keypoint2[0], m.keypoint2[1]+1024);
            ctxb.stroke();

            i=i+1;
         }

        document.body.appendChild(this.canvasbig);

        // DEGBUG: place an hotspot on the matching points
        let config = panorama.viewer.getConfig();

        //let [yaw0,pitch0] = transf.pixelToYawPitchPnlm(down_matches[10].keypoint1[0],down_matches[10].keypoint1[1],6720,3360);
        let [yaw0,pitch0] = transf.pixelCubeToYawPitchPnlm( matches[1].keypoint1[0], matches[1].keypoint1[1],4096,1024);

        let curhs = config.scenes[0].hotSpots[0];
        curhs.yaw = yaw0;
        curhs.pitch = pitch0;
        Object.assign(config.scenes[0].hotSpots[0], curhs);

        // let [yaw1,pitch1] = transf.pixelToYawPitchPnlm(down_matches[10].keypoint2[0],down_matches[10].keypoint2[1],6720,3360);
        let [yaw1,pitch1] = transf.pixelCubeToYawPitchPnlm( matches[1].keypoint2[0], matches[1].keypoint2[1],4096,1024);

        curhs = config.scenes[1].hotSpots[0];
        curhs.yaw = yaw1;
        curhs.pitch = pitch1;
        Object.assign(config.scenes[1].hotSpots[0], curhs);

        return matches;
    }

    pixelCubeToTranslationDirection(pano0,p1x,p1y,pano1,p2x,p2y,width,height){

            let [yaw0,pitch0] = transf.pixelCubeToYawPitchPnlm(p1x,p1y,4096,1024);

            let [yaw1,pitch1] = transf.pixelCubeToYawPitchPnlm(p2x,p2y,4096,1024);

            let a = transf.yawPitchToDir(pano0,yaw0,pitch0);
            let b = transf.yawPitchToDir(pano1,yaw1,pitch1);

            let n = math.cross(a,b);
            let nm =math.norm(n);
            n = math.multiply(n,1.0/nm);

            let v = [-n[2],0,n[0]];
            v = math.multiply(v,1.0/math.norm(v));

            // set the verse of v
            if(n[1]>0 && math.dot(a,v)<0 ||
               n[1]<0 && math.dot(a,v)>0)
                v = math.multiply(v,-1);
this.a = a;
this.b = b;
            return [v,n];
        }

            pixelEquiToTranslationDirection(pano0,p1x,p1y,pano1,p2x,p2y,width,height){

                    let [yaw0,pitch0] = transf.pixelToYawPitchPnlm(p1x,p1y,width,height);

                    let [yaw1,pitch1] = transf.pixelToYawPitchPnlm(p2x,p2y,width,height);

                    let a = transf.yawPitchToDir(pano0,yaw0,pitch0);
                    let b = transf.yawPitchToDir(pano1,yaw1,pitch1);

                    let n = math.cross(a,b);
                    let nm =math.norm(n);
                    n = math.multiply(n,1.0/nm);

                    let v = [-n[2],0,n[0]];
                    v = math.multiply(v,1.0/math.norm(v));

                    // set the verse of v
                    if(n[1]>0 && math.dot(a,v)<0 ||
                       n[1]<0 && math.dot(a,v)>0)
                        v = math.multiply(v,-1);
        this.a = a;
        this.b = b;
                    return [v,n];
                }

      plotDirections(dirs,more){

        this.canvasplot.height = 512;
        this.canvasplot.width =  512;
        let ctxb = this.canvasplot.getContext('2d');

        ctxb.strokeStyle = `blues`; // Set fill color
        ctxb.fillStyle = `hsl(100,10%,10%)`;// Set fill color

        for(let  d of dirs){
            ctxb.beginPath();
            ctxb.arc(256+d[0]*254,256+d[2]*254, 1, 0, 2*Math.PI, false);
            ctxb.fill();
        }
        for(let  d of more){
            ctxb.beginPath();
            ctxb.arc(256+d[0]*254,256+d[2]*254, 5, 0, 2*Math.PI, false);
            ctxb.fill();
        }

        document.body.appendChild(this.canvasplot);
    }

    estimateCameraPositionFromCorrespondences(pano0,pano1,matches,cube_equi){

 //           let alphas = [];
            let all= [];
            let avg = [0,0,0];


           let n  = matches.length;
           for(let  i=0; i < n;++i){

            let v1 =0;

              if(cube_equi) v1 = this.pixelCubeToTranslationDirection(pano0, matches[i].keypoint1[0],matches[i].keypoint1[1],
                                                          pano1, matches[i].keypoint2[0],matches[i].keypoint2[1],
                                                          4096,1024)[0];
                    else
                            v1 = this.pixelEquiToTranslationDirection(pano0, matches[i].keypoint1[0],matches[i].keypoint1[1],
                                                                              pano1, matches[i].keypoint2[0],matches[i].keypoint2[1],
                                                                              6720,3360)[0];
              all.push(v1);
              if(v1[0]<0){
                  v1[0]=-v1[0];
                  v1[1]=-v1[1];
               }
               avg[0]+=v1[0];
               avg[2]+=v1[2];
 //           alphas.push(math.atan2(v1[0],v1[2]));
            }
              avg[0]/=all.length;
              avg[2]/=all.length;

              let nm =math.norm(avg);
              avg = math.multiply(avg,1.0/nm);
              all.push(avg);

            this.plotDirections(all,[avg]);

            all  = all.filter( v => {
                    // Euclidean distance in the unit circle
                    const distance = math.sqrt((v[0] - avg[0]) ** 2 + (v[2] - avg[2]) ** 2);
                    return distance <= 0.2; // Keep values within the threshold
                });
            // take the median of the filtered data
            n = all.length;
            avg = [0,0,0];
            for(let  i=0; i < n;++i){
                avg[0]+=all[i][0];
                avg[2]+=all[i][2];
            }
            avg[0]/=n;
            avg[2]/=n;

            //normalize it to have it in the unit circle
              nm =math.norm(avg);
            let res = math.multiply(avg,1.0/nm);

//            let iqr = new Iqr();
//            let res = iqr.estimate(alphas);
//            let d = [-v[2],0,v[0]];
//            d = math.multiply(d,1.0/math.norm(d));
            return res;
    }
}

class Autopos {

	constructor(){
	this.useYaw = false;
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
            if (how === 'manual' && index != rootIndex) {
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
                       if (idx === nodeIndex && nodeIndex != rootIndex && how === 'manual') {
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
			
		let n_var = 2;
		if(this.useYaw)
			n_var = 3;

		let N = nodes.length*n_var; // two variables (x,y) for each node
		let M = edges.length*2; // two contraints for each edge
		 
		 
 //		console.log('initial pos');
 //		console.log(panorama.panos[nodes[0]].translation);
 		
		let A = math.sparse(math.zeros([M, N], 'sparse'));
		let b = math.sparse(math.zeros([M, 1], 'sparse'));
        let W = math.sparse(math.zeros([M, M], 'sparse'));

		// initial estimation of node positions
		let cnt = Array(nodes.length).fill(0);
		let inival = Array(nodes.length*n_var).fill(0);
		let tails = new Set();	
		for(let [ie, e] of edges.entries()){
			//let p_head = panorama.panos[e.head].translation;
			//let p_tail = panorama.panos[e.tail].translation;
			let i_xy = nodes.indexOf(e.head);
			cnt[i_xy]++;
			
//			let pos = transf.yawPitchToPos(panorama.panos[e.tail],e.target_yaw*180/Math.PI,e.target_pitch*180/Math.PI);
//			console.log("correct ",transf.yawPitchToPos(panorama.panos[e.tail],e.target_yaw*180/Math.PI,e.target_pitch*180/Math.PI));
			let pos = panorama.panos[e.head].translation;
			
			inival[i_xy*n_var]   += pos[0];
			inival[i_xy*n_var+1] += pos[2];

			tails.add(e.tail);
		}		
		
		// also average with the current position
		for(let [i, n] of nodes.entries()){
			inival[i*n_var]   += panorama.panos[n].translation[0];
			inival[i*n_var+1] += panorama.panos[n].translation[2];
			cnt[i]++;
		}
		for(let [i, n] of nodes.entries()){
			inival[i*n_var] /= cnt[i];
			inival[i*n_var+1] /= cnt[i];
//			console.log(inival[i*2],inival[i*2+1]);
		}
		

		if(this.useYaw){
			// initial estimation of node yaw (just the initialYaw)
			for(let [i, n] of nodes.entries())
				inival[i*n_var+2] = panorama.panos[n].initialYaw;
				}
		
		let out_d_yaw =[0,0];
		let out_d_pitch = [0,0];
		let out_delta_yaw = 0;
		let out_delta_pitch = 0;
		
		for(let [ie, e] of edges.entries()){
		
			// find the place of edges.head in nodes
			let i_he = nodes.indexOf(e.head)*n_var;
			// find the place of edges.tail in nodes
			let i_ta = nodes.indexOf(e.tail)*n_var;
			
			let p_head = [inival[i_he],0,inival[i_he+1]];
			let p_tail = panorama.panos[e.tail].translation;
			let iniYaw = inival[i_ta+2];
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
				 
			
			A.set([ie*2,i_he  ],d_yaw[0]);
			A.set([ie*2,i_he+1],d_yaw[1]);
			
			A.set([ie*2+1,i_he  ],d_pitch[0]);
			A.set([ie*2+1,i_he+1],d_pitch[1]);

			if(i_ta >= 0){ // the tail node is   among the variables
				A.set([ie*2,i_ta  ],-d_yaw[0]);
				A.set([ie*2,i_ta+1],-d_yaw[1]);
				
				A.set([ie*2+1,i_ta  ],-d_pitch[0]);
				A.set([ie*2+1,i_ta+1],-d_pitch[1]);

				if(this.useYaw){
					A.set([ie*2,i_ta+2],-1); // the derivative of yaw of the tail pano
					b.set([ie*2,0],t_yaw + ( d_yaw[0]*p_head[0]+d_yaw[1]*p_head[2]+(-d_yaw[0])*p_tail[0]+(-d_yaw[1])*p_tail[2]+(-1)*iniYaw-e.computed_yaw));
				}else
					b.set([ie*2,0],t_yaw + ( d_yaw[0]*p_head[0]+d_yaw[1]*p_head[2]+(-d_yaw[0])*p_tail[0]+(-d_yaw[1])*p_tail[2]-e.computed_yaw));

				b.set([ie*2+1,0],e.target_pitch + ( d_pitch[0]*p_head[0]+d_pitch[1]*p_head[2]+(-d_pitch[0])*p_tail[0]+(-d_pitch[1])*p_tail[2]-e.computed_pitch));
				
				}else{
				
				b.set([ie*2,0],t_yaw + ( d_yaw[0]*p_head[0]+d_yaw[1]*p_head[2]-e.computed_yaw));
				b.set([ie*2+1,0],e.target_pitch + ( d_pitch[0]*p_head[0]+d_pitch[1]*p_head[2]-e.computed_pitch));
				}
			
           // the the constraints weights
            W.set([ie*2,ie*2],1.0);       // weight of the yaw constraint
            W.set([ie*2+1,ie*2+1],1.0);   // weight of the pitch constraint
			
            console.log('W', W);

			out_d_yaw =d_yaw;
			out_d_pitch = d_pitch;
			out_delta_yaw = e.target_yaw-e.computed_yaw;
			out_delta_pitch = e.target_pitch-e.computed_pitch;
		}

        let dense_W = W.toArray();
        //console.log('denseW',dense_W);

        let wA = math.sparse(math.zeros([M, N], 'sparse'));
        let A_T = math.transpose(A);
        let M0 = math.multiply(A_T,W);
        let M1 = math.multiply(M0,A);
        let M2 = math.pinv(M1);
        let M3 = math.multiply(M2,A_T);
        wA = math.multiply(M3,W);

        let dense_wA = wA.toArray();

        wA = math.pinv(wA);
        dense_wA = wA.toArray();
        let dense_A =  A.toArray();

        let  wA_A  = math.subtract(wA,A);
        let dense_wA_A = wA_A.toArray();
        console.log('wa_A',dense_wA_A);

        return [A,b,out_d_yaw,out_d_pitch,out_delta_yaw,out_delta_pitch,tails];
	}
	
	// a problem is created with a set of constrained edges
	solve(panorama,edges,nodesIn){
		let n_var = 2;
		if(this.useYaw)
			n_var = 3;
			
		let H = 2;

		let x = 0.0;
		let y = 0.0;
		
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
			console.log("Matrix A:",prob[0]);
			
			let A_pInv = math.pinv(prob[0]);
			
			let x = math.multiply(A_pInv, prob[1]);
	 		dense_x = x.toArray();
//			console.log('sol:',dense_x[0],dense_x[1]);
			let err = math.multiply(prob[0],x);
			err = math.subtract(err,prob[1]);
			
			for (let [i, n] of nodes.entries()) {
			

				let delta = [ x.get([i*n_var,0])-panorama.panos[n].translation[0] , x.get([i*n_var+1,0])-panorama.panos[n].translation[2]];
				let deltalength = Math.sqrt(delta[0]*delta[0] + delta[1]*delta[1]);				

				if(deltalength>max_delta)
					max_delta = deltalength;
				
				if( deltalength > 1.0 ){
					delta[0] /=  deltalength;
					delta[1] /=  deltalength;
				}


		   		  panorama.panos[n].translation[0] += delta[0];	// x pos of node n	
		   		  panorama.panos[n].translation[2] += delta[1];	// z pos of node n
		   		  if(this.useYaw)
			   		  if(prob[6].has(n))
				   		  panorama.panos[n].initialYaw = x.get([i*n_var+2,0]);// initialYaw of node n
			}
 		}
		
	}
	
	optimize_positions(panorama,rootId){
 	 console.clear();
	 let edges_nodes = this.makeGraphFromRoot(panorama, Number(rootId));
	 if(edges_nodes.length > 0){
	 	 this.solve(panorama,edges_nodes[0],edges_nodes[1]);
		 this.computeLinks(panorama,edges_nodes[1]);
		 }
	}

	computeLinks(panorama,panosToUpdate){
		let config  = panorama.viewer.getConfig();
		let panos = panorama.panos;
			
		for(let i of panosToUpdate){
			let targetId = panos[i].id;
    //		console.log('pano to update',targetId);
			for(let [il,ng] of panos[targetId].links.entries())// for all links of the target (bidirectional edges assumed)
				{
				 let yp = transf.posToYawPitch(panos[targetId].translation, panos[ng[0]]);
				 let index_tp =  panos[ng[0]].links.findIndex(e => e[0] == targetId);
				 if(index_tp == -1)
				 continue;
				 
//				 Object.assign( panos[ng[0]].links[index_tp], [targetId,yp[0],yp[1],'projected']);
				 panos[ng[0]].links[index_tp][1] = yp[0];
				 panos[ng[0]].links[index_tp][2] = yp[1];
				 
            //	 console.log('pano ',targetId, ' to ', ng[0],':', yp[0],yp[1]);
				 
				 let index = config.scenes[ng[0]].hotSpots.findIndex(e => e.sceneId == targetId);
				 config.scenes[ng[0]].hotSpots[index].yaw  = yp[0];
				 config.scenes[ng[0]].hotSpots[index].pitch= yp[1];
				 
  				 console.log('pano ',ng[0], ' to ', targetId );
			 
				 yp = transf.posToYawPitch( panos[ng[0]].translation, panos[targetId]);
//				 Object.assign( panos[targetId].links[il], [ng[0],yp[0],yp[1],'projected']);
				 panos[targetId].links[il][1] = yp[0];
				 panos[targetId].links[il][2] = yp[1];
				 
				 index = config.scenes[targetId].hotSpots.findIndex(e => e.sceneId == ng[0]);
				 
				 config.scenes[targetId].hotSpots[index].yaw   = yp[0];
				 config.scenes[targetId].hotSpots[index].pitch = yp[1];
				 
				}
		}
		this.emit('updategraph');
	}			
}
addSignals(Autopos, 
	'updategraph');

export { Panorama }
export {Autopos}
export {PositionEstimation}
export {math}
