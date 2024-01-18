
import { GuideTour } from './guidetour.js'
import { TouristTour } from './touristtour.js'
import { Editor } from './editor.js'

//let host = 'https://localhost:8080';
//let host = 'https://192.168.1.107:8080'
//let host = 'https://146.48.84.182:8080';
let host = 'https://vcg.isti.cnr.it:8080';
let saveUrl = '/save/datasets/lucca/lucca/dataset.json'
let parameter = Object.fromEntries(new URLSearchParams(location.search));

let dataset = 'miracoli/panos/dataset.json';
dataset = 'lucca/dataset.json';
switch(parameter.role) {
	case 'editor': 
		let editor = new Editor('#panorama', dataset); 
		editor.minimap.saveURL = saveUrl;
		break;

	case 'guide': 
		const tour = new GuideTour('#panorama', dataset, host, '/server');
		break;
	default: 
		const tour1 = new TouristTour('#panorama', dataset, host, '/server');
		break;
}

