//Merge some js

var ExifImage = require('exif').ExifImage;

const fs = require('fs');

const project = require('./UTMprojection.cjs')

function splitLine(line) {
	return line.split(' ').map(e => parseFloat(e));
}

async function getExif(path) {
	return new Promise((resolve, reject) => {
		 new ExifImage({ image : path }, function (error, exifData) {
			if (error)
				reject();
			else
				resolve(exifData);
		});
	});
}

function dms_to_dd(dms, dms_ref) {

	let m = dms[1]/60.0;
	let s = dms[2]/3600.0;
	let dd = dms[0] + m + s;

	if(dms_ref == 'S' || dms_ref == 'W')
		dd = -dd;
	return dd;
}


const numeric = require('numeric');

function computeAffineTransformation(points, transformedPoints) {
    const A = [];
    const B = [];

    // Construct the design matrix and vector
    for (let i = 0; i < 3; i++) {
        const x = points[i][0];
        const y = points[i][1];
        const u = transformedPoints[i][0];
        const v = transformedPoints[i][1];

        A.push([x, y, 1, 0, 0, 0]);
        A.push([0, 0, 0, x, y, 1]);

        B.push(u);
        B.push(v);
    }

    // Solve the linear system using least squares
    const x = numeric.solve(A, B);

    // Extract the transformation parameters
    const a = x.slice(0, 3);
    const b = x.slice(3);

    return { a, b };
}

function applyAffineTransformation(point, transformation) {
    const x = point[0];
    const y = point[1];

    const u = transformation.a[0] * x + transformation.a[1] * y + transformation.a[2];
    const v = transformation.b[0] * x + transformation.b[1] * y + transformation.b[2];

    return [u, v];
}

function triangleArea(p1, p2, p3) {
    return 0.5 * Math.abs(p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]));
}

// Function to compute the average of affine transformations weighted by triangle areas
function averageAffineTransforms(points, transformedPoints, numSamples) {
    const numPoints = points.length;
    let totalTransformA = [0, 0, 0];
    let totalTransformB = [0, 0, 0];

	let totalArea = 0;
    for (let i = 0; i < numSamples; i++) {
        // Randomly select three points
        const indices = [];
        while (indices.length < 3) {
            const index = Math.floor(Math.random() * numPoints);
            if (!indices.includes(index)) {
                indices.push(index);
            }
        }
        const triplePoints = indices.map(index => points[index]);
        const tripleTransformedPoints = indices.map(index => transformedPoints[index]);

        // Compute the affine transformation for the triple
        const transformation = computeAffineTransformation(triplePoints, tripleTransformedPoints);



        // Compute the area of the triangle formed by the three points
        const area = triangleArea(triplePoints[0], triplePoints[1], triplePoints[2]);

        // Accumulate the weighted transformation
        totalTransformA = totalTransformA.map((val, idx) => val + transformation.a[idx] * area);
        totalTransformB = totalTransformB.map((val, idx) => val + transformation.b[idx] * area);
		totalArea += area;
    }

    // Normalize by the total area
    
    const avgTransformA = totalTransformA.map(val => val / totalArea);
    const avgTransformB = totalTransformB.map(val => val / totalArea);

//	let test = applyAffineTransformation(points[0], { a: avgTransformA, b: avgTransformB });
//	console.log(test, points[0], transformedPoints[0]);


    return { a: avgTransformA, b: avgTransformB };
}



async function parseOut(out, list, path) {
	const imgs = fs.readFileSync(list).toString().replace(/\r\n/g,'\n').split('\n');
	if(imgs[imgs.length-1] == '')
		imgs.pop();

	let exifs = [];
	for(let img of imgs) {
		try {
			let e = await getExif(path + '/' + img);
			exifs.push(e);
		} catch(e) {
			console.log("problem with exifs " + img);
		}

	}

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
		let exif = exifs[i];
		pano.latitude = dms_to_dd(exif.gps.GPSLatitude, exif.gps.GPSLatitudeRef);
		pano.longitude = dms_to_dd(exif.gps.GPSLongitude, exif.gps.GPSLongitudeRef);
		pano.altitude = exif.gps.GPSAltitude;

		array.shift(); //skip focal, k1, k2

		let rotation = [
			...splitLine(array.shift()), 0,
			...splitLine(array.shift()), 0,
			...splitLine(array.shift()), 0,
			0, 0, 0, 1
		];
		pano.rotation = rotation;
		let t = splitLine(array.shift()); //translation

		r = transpose(rotation);
		let v = applyMatrix(r, t);

		
		let R = deviationMatrix(rotation);
		let euler = eulerFromMatrix(R, 'YXZ'); //y is up (yaw), x is pitch, z is roll			
//		let G = matMul(pano.rotation, T);
//		dir = applyMatrix(G, dir);
		
		pano.initialYaw      = euler[1]; 
		pano.horizontalPitch = -euler[0];
		pano.horizontalRoll  = -euler[2];



		if(euler[0] == 0 && euler[1] == 0)
			continue;

        //swap y and z
		pano.translation = [-v[0], -v[1], -v[2]]; //view position				

		count++;

		if(t[0] == 0)
			continue;


		panos.push(pano);

	}

	let local = [];
	let global = [];
	for(let pano of panos) {
		local.push([pano.translation[0], pano.translation[1]]);
		global.push([pano.latitude, pano.longitude]);
	}
	const transform = averageAffineTransforms(local, global, local.length);

	
	let local_first = [panos[0].translation[0], panos[0].translation[1]];
	let global_first = [panos[0].latitude, panos[0].longitude];
	for(let pano of panos) {
		let global_point = [pano.latitude, pano.longitude];
		let local_point = [pano.translation[0], pano.translation[1]];

		let new_global_point =  applyAffineTransformation(local_point, transform);
		
//		pano.latitude = new_global_point[0];
//		pano.longitude = new_global_point[1];
		pano.utm = project(pano.latitude, pano.longitude, 10)
	}

	
	return panos;
}



if(process.argv.length < 3) {
	console.log(process.argv)
	console.log("Usage: node merge.cjs <folder_path1> <folder_path2> ...etc.")
	process.exit();
}
process.argv.shift();
process.argv.shift();

generate();

async function generate() {

let current_id = 0;
let dataset = { tours: [], 	accessPoints: [0] };
let tour = { name: 'Tour name',
	sets: [],
}
dataset.tours.push(tour);

let count =0 ;
for(let folder_path of process.argv) {
	console.log("Processing: " + folder_path);
	if(folder_path.slice(-1) == '/') {
		folder_path = folder_path.slice(0, -1);
	}
	let set = {
		name: folder_path.split('/').slice(-1)[0],
		order: count++,
		panos: []
	};
	tour.sets.push(set)
	
	let dir = fs.readdirSync( folder_path );
	let files = dir.filter( ( e ) => e.match(/.*\.(out?)/ig));
	if(files.length == 0) {
		console.log("Missing .out file!");
		exit(0);
	}
	if(files.length > 1) {
		console.log("Too many .out files!");
		exit(0);
	}

	//find *.out
	set.panos = await parseOut(`${folder_path}/${files[0]}`, `${folder_path}/list.txt`, folder_path);


	let initial = set.panos[0].rotation; 
	let adjust = transpose(deviationMatrix(initial));

	let euler = eulerFromMatrix(matMul(initial, adjust), 'YXZ'); //y is up (yaw), x is pitch, z is roll

	let latlon_box = {
		"latitude_min": 1e30,
		"latitude_max": -1e30,
		"longitude_min": 1e30,
		"longitude_max": -1e30,
		"altitude_min": 1e30,
		"altitude_max": -1e30,
	};

	let boundingbox = {
		"easting_min": 1e30,
		"easting_max": -1e30,
		"northing_min": 1e30,
		"northing_max": -1e30
	};
	
	let utm_box = {
		"easting_min": 1e30,
		"easting_max": -1e30,
		"northing_min": 1e30,
		"northing_max": -1e30
	};


	for(let pano of set.panos) {
		pano.id = current_id++;
		pano.url = `${set.name}/${pano.url}`;
		pano.label = `${set.name} ${pano.id}`;
		pano.set = set.name;
		pano.priority = 2;
		boundingbox.easting_min = Math.min(boundingbox.easting_min, pano.translation[0]);
		boundingbox.easting_max = Math.max(boundingbox.easting_max, pano.translation[0]);
		boundingbox.northing_min = Math.min(boundingbox.northing_min, pano.translation[1]);
		boundingbox.northing_max = Math.max(boundingbox.northing_max, pano.translation[1]);

		utm_box.easting_min = Math.min(utm_box.easting_min, pano.utm[0]);
		utm_box.easting_max = Math.max(utm_box.easting_max, pano.utm[0]);
		utm_box.northing_min = Math.min(utm_box.northing_min, pano.utm[1]);
		utm_box.northing_max = Math.max(utm_box.northing_max, pano.utm[1]);

		latlon_box.latitude_min = Math.min(latlon_box.latitude_min, pano.latitude);
		latlon_box.latitude_max = Math.max(latlon_box.latitude_max, pano.latitude);
		latlon_box.longitude_min = Math.min(latlon_box.longitude_min, pano.longitude);
		latlon_box.longitude_max = Math.max(latlon_box.longitude_max, pano.longitude);
		latlon_box.altitude_min = Math.min(latlon_box.altitude_min, pano.altitude);
		latlon_box.altitude_max = Math.max(latlon_box.altitude_max, pano.altitude);
	}
	for(let pano of set.panos) {
		pano.translation_utm = [pano.utm[0] - utm_box.easting_min, pano.utm[1] - utm_box.northing_min];
	}
	set.boundingbox = boundingbox;
	set.boundingbox_utm = utm_box;
	set.boundingbox_latlon = latlon_box;
}

console.log("Saving tour to test.json");
fs.writeFileSync('test.json', JSON.stringify(dataset,null, 2));

}


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
