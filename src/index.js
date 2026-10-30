import { GuideTour } from './guidetour.js'
import { TouristTour } from './touristtour.js'
import { Editor } from './editor.js'

let host = window.guido_host;

let dataset = window.guido_dataset;
let saveUrl = window.guido_saveUrl;
let role = window.guido_role;
let authToken = window.guido_auth_token;


switch(role) {
	case 'editor': 
		let editor = new Editor('#panorama', dataset); 
		editor.minimap.saveURL = saveUrl;
		break;

	case 'guide': 
		const tour = new GuideTour('#panorama', dataset, host, '/server', authToken);
		break;
	default: 
		const tour1 = new TouristTour('#panorama', dataset, host, '/server', authToken);
		break;
}
