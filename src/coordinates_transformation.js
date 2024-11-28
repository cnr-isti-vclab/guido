
 
	function posToYawPitch(pos, pano){
		let H = 2;
		let tx = pos[0];
		let ty = pos[1];
		let tz = pos[2];
		
		let x = pano.translation[0];
		let y = pano.translation[1];
		let z = pano.translation[2];	
		
		let dir = [tx - x, -H, tz - z];
		let dist = Math.sqrt(dir[0]*dir[0]+dir[2]*dir[2]);

			
		let angle = 180*Math.atan2(dir[0], dir[2])/Math.PI;
		
		let yaw =  (angle + 360)%360;  	// yaw and initialYaw i nthe same reference system now
		yaw =  (yaw-pano.initialYaw+360)%360;  // distance between yaw and initialiYaw in [0,360]
		yaw = ((yaw + 180)%360)-180;


		let pitch = 180*Math.atan2(-H, dist)/Math.PI; 
		
		return [yaw,pitch,dist];
	}
	
	function yawPitchToDir(pano,yaw,pitch){
        yaw = (yaw + 360)%360;                  // bring yaw from -180,180 to 0-360
		yaw = (yaw+pano.initialYaw+360)%360;	// add pano.initialYaw
		
		let dir = [0,0,0];
		dir[0] = Math.cos(pitch*Math.PI/180)*Math.sin(yaw*Math.PI/180);
		dir[2] = Math.cos(pitch*Math.PI/180)*Math.cos(yaw*Math.PI/180);
		dir[1] = Math.sin(pitch*Math.PI/180);
		return dir;	
	}

	function yawPitchToPos(pano,yaw,pitch){
		let dir = this.yawPitchToDir(pano,yaw,pitch);
		let H = 2;
		let t = Math.abs(-H / dir[1]);
		
		let pos = [0,0,0];
		pos[0] = pano.translation[0]+t*dir[0];
		pos[1] = pano.translation[1]+H+t*dir[1]; // this will be 0
		pos[2] = pano.translation[2]+t*dir[2];
		
		return pos;
	
	}
	
	// take yaw, pitch and target pos and return the pano pos (to which yaw and pitch refer)
	function yawPitchTargetToPos(pano,targetpano,yaw,pitch){
		let dir = this.yawPitchToDir(pano,yaw,pitch);
		
		let H = 2;
		let t = Math.abs(H / dir[1]);
		
		let pos = [0,0,0];
		pos[0] = targetpano.translation[0]-t*dir[0];
		pos[1] = 0;
		pos[2] = targetpano.translation[2]-t*dir[2];
		
		return pos;
	}

    function pixelToYawPitchPnlm(px,py,w,h){
        let yaw   = (px-w/2.0)/(w/2)*180;
        let pitch = ((h-py)-h/2.0)/(h/2)*90;
        return [yaw,pitch];
    }
	
    function pixelCubeToYawPitchPnlm(px,py,w,h){
        let half_fw = w/8;
        let yaw   = (px+half_fw-w/2.0)/(w/2)*180;
        yaw = ((yaw + 180)%360)-180;
        let pitch = ((h-py)-h/2.0)/(h/2)*45;
        return [yaw,pitch];
    }
    export {posToYawPitch,yawPitchToDir,yawPitchToPos,yawPitchTargetToPos,pixelToYawPitchPnlm,pixelCubeToYawPitchPnlm}
	
