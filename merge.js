//Merge some js

const fs = require('fs');


function splitLine(line) {
	return line.split(' ').map(e => parseFloat(e));
}
function parseOut(out, list, skip) {
	const imgs = fs.readFileSync(list).toString().replace(/\r\n/g,'\n').split('\n');

	let text = fs.readFileSync(out);
	const array = text.toString().replace(/\r\n/g,'\n').split('\n');
	array.shift(); //remove initial comment, TODO might be more than one.
	let n = parseInt(array.shift().split(' ')[0]);
	let panos = [];
	let count = 0;
	for(let i = 0; i < n; i++) {

		let pano = {};

		pano.id = count;
		pano.url = imgs[i];

		array.shift(); //focal, and k1 k2
		pano.rotation = [
			...splitLine(array.shift()), 0,
			...splitLine(array.shift()), 0,
			...splitLine(array.shift()), 0,
			0, 0, 0, 1
		];
		let t = splitLine(array.shift()); //translation

		r = transpose(pano.rotation);
		let v = applyMatrix(r, t);
		pano.translation = [-v[0], -v[1], -v[2]]; //view position

		if(skip && i >= skip[0] && i < skip[1])
			continue;
		panos.push(pano);
		count++;
	}
	
	return panos;
}



let datasets = [
	{
		filename: "piazza",
		yaw: 0
	}, 
	{
		filename: "mura",
		yaw: 0
	},  

	{
		filename: "abside",
		yaw: 0
	}, 
	{
		filename: "cavalieri",
		yaw: 0
	},

	{
		filename: "chiesa",
		yaw: 0
	}, 
	{
		filename: "haring",
		yaw: 0
	} 
];


let dataset = { panos: [], accessPoints: [] };

let current_id = 0;
for(let data of datasets) {
	let skip = null;
	if(data.filename == 'piazza')
		skip = [40, 97];
	let panos = parseOut(`${data.filename}/${data.filename}.out`, `${data.filename}/list.txt`, skip);

	let initial = panos[0].rotation; 
	let adjust = transpose(deviationMatrix(initial));

	let euler = eulerFromMatrix(matMul(initial, adjust), 'YXZ'); //y is up (yaw), x is pitch, z is roll
		console.log('yaw', euler[1], 'pitch', euler[0], 'roll', euler[2]);

	for(let pano of panos) {
		pano.id = `${current_id++}`;
		pano.url = `${data.filename}/${pano.url}`;
		pano.label = `${data.filename} ${pano.id}`;
		pano.set = data.filename;
		//pano.rotation = matMul(pano.rotation, adjust);
		//pano.translation = applyMatrix(adjust, pano.translation);

		

		let R = deviationMatrix(pano.rotation);

		console.log(pano.label);
		for(let order of ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'])
			console.log(order, eulerFromMatrix(R, order)); 
	

	}

	dataset.panos = [...dataset.panos, ...panos];
}

dataset.accessPoints = dataset.panos[0].id;

fs.writeFileSync('test.json', JSON.stringify(dataset,null, 2));



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


function rotationMatrixToEulerAngles(m) {
	let col = [0, 2, 1];
	let sy = Math.sqrt(m[0] * m[0] +  m[1] * m[1]);
	let singular = sy < 1e-6;
	if(singular)
		throw "Singular matrix";
	//console.log("singualar? ", singular);
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
	let r = [
	a[0]*b[0] + a[4]*b[1] + a[8]*b[2] + a[12]*b[3],
	a[1]*b[0] + a[5]*b[1] + a[9]*b[2] + a[13]*b[3],
	a[2]*b[0] + a[6]*b[1] + a[10]*b[2] + a[14]*b[3],
	a[3]*b[0] + a[7]*b[1] + a[11]*b[2] + a[15]*b[3],

	a[0]*b[4] + a[4]*b[5] + a[8]*b[6] + a[12]*b[7],
	a[1]*b[4] + a[5]*b[5] + a[9]*b[6] + a[13]*b[7],
	a[2]*b[4] + a[6]*b[5] + a[10]*b[6] + a[14]*b[7],
	a[3]*b[4] + a[7]*b[5] + a[11]*b[6] + a[15]*b[7],

	a[0]*b[8] + a[4]*b[9] + a[8]*b[10] + a[12]*b[11],
	a[1]*b[8] + a[5]*b[9] + a[9]*b[10] + a[13]*b[11],
	a[2]*b[8] + a[6]*b[9] + a[10]*b[10] + a[14]*b[11],
	a[3]*b[8] + a[7]*b[9] + a[11]*b[10] + a[15]*b[11],

	a[0]*b[12] + a[4]*b[13] + a[8]*b[14] + a[12]*b[15],
	a[1]*b[12] + a[5]*b[13] + a[9]*b[14] + a[13]*b[15],
	a[2]*b[12] + a[6]*b[13] + a[10]*b[14] + a[14]*b[15],
	a[3]*b[12] + a[7]*b[13] + a[11]*b[14] + a[15]*b[15]
	];
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

function transpose(r) {
	let t = []
	for(let i = 0; i < 4; i++)
		for(let k =0; k < 4; k++) 
			t[i*4 + k] = r[i + k*4];
	return t;
}

/*
createSvg(panos) {
	let svg = "<svg =
	let svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svgElement.setAttribute('viewBox', '0 0 256 256');

	let style =  document.createElementNS('http://www.w3.org/2000/svg', 'style');
	style.textContent = "";
	svgElement.appendChild(style);

	let serializer = new XMLSerializer();

	for(let pano of panos) {
		let t = pano.translation;
		let euler = this.rotationMatrixToEulerAngles(pano.rotation);
		let [roll, pitch, yaw] = euler;

		//(pano.id, 'yaw: ', yaw, 'roll: ', roll, 'pitch: ', pitch);

		let circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		circle.setAttribute('cx', t[0]);
		circle.setAttribute('cy', -t[1]);
		circle.setAttribute('r', 0.1);
		svgElement.appendChild(circle);

		
		let tag = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		tag.setAttribute('x', t[0]);
		tag.setAttribute('y', -t[1]-0.2);
		tag.setAttribute('font-size', 2);

		tag.textContent = pano.id;
		svgElement.appendChild(tag);


		svgElement.appendChild(circle);
		
		let dx = Math.sin(yaw*3.1415/180)*5 + t[0];
		let dy = Math.cos(yaw*3.1415/180)*5 + t[1];
		let dir = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		dir.setAttribute('d', `M ${t[0]} ${-t[1]} L ${dx} ${-dy}`);
		dir.setAttribute('stroke-width', '0.01');
		dir.setAttribute('stroke', '#000')
		svgElement.appendChild(dir);


		for(let l of pano.links) {
			break;
			let target = this.panos.find((e) => e.id == l);
			if(!target) {
				console.log("Missing pano: ", l);
				continue;
			}
			let e = target.translation;
			let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', `M ${t[0]} ${-t[1]} L ${e[0]} ${-e[1]}`);
			path.setAttribute('stroke-width', '0.01');
			path.setAttribute('stroke', '#000')
			svgElement.appendChild(path);
		}
	}

	let svg = serializer.serializeToString(svgElement);
	
	var e = document.createElement('a');
	e.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(svg));
	e.setAttribute('download', 'annotations.svg');
	e.style.display = 'none';
	document.body.appendChild(e);
	e.click();
	document.body.removeChild(e);
} */