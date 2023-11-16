
import { GuideTour } from './guidetour.js'
import { TouristTour } from './touristtour.js'
import { Editor } from './editor.js'

//let host = 'https://localhost:8080';
//let host = 'https://192.168.1.107:8080'
let host = 'https://146.48.84.182:8080';

let parameter = Object.fromEntries(new URLSearchParams(location.search));
switch(parameter.role) {
	case 'editor': 
		new Editor('#panorama', 'miracoli/panos/dataset.json'); 
		break;
	case 'guide': 
		const tour = new GuideTour('#panorama', 'miracoli/panos/dataset.json', host, '/server');
		break;
	default: 
		const tour1 = new TouristTour('#panorama', 'miracoli/panos/dataset.json', host, '/server');
		break;

}

