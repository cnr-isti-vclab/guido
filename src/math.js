

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

export { transpose, eulerToMatrix, eulerFromMatrix, matMul, applyMatrix,
	rotationMatrixToEulerAngles, eulerMatrix, deviationMatrix, clamp }