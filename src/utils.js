function getIcon(name) {
	switch(name) {
	case 'umbrella': return `<svg xmlns="http://www.w3.org/2000/svg" class="tour-guide follow" viewBox="0 0 24 24">
		<title>Follow (or unfollow) the guide</title>
		<path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"></path>
		<path class="negate" d="M 21 3 L 3 21"></path>
		</svg>`;

	case 'users': return `<svg xmlns="http://www.w3.org/2000/svg"  class="tour-users" viewBox="0 0 36 24">
		<title>Number of partecipants</title>

		<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
		<text x="19" y="12" stroke="none" fill="white" font-family="arial" font-weight="bold" font-size="12px">12</text></svg>`;

	case 'list': return `<svg xmlns="http://www.w3.org/2000/svg" class="tour-list active" viewBox="0 0 24 24" >
		<title>Show/hide the list of locations</title>
		<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line>
		<line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line>
		<line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
	
	case 'load': return `<svg xmlns="http://www.w3.org/2000/svg" class="tour-upload" viewBox="0 0 24 24">
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
		<polyline points="17 8 12 3 7 8"></polyline>
		<line x1="12" y1="3" x2="12" y2="15"></line></svg>`;

	case 'save': return `<svg xmlns="http://www.w3.org/2000/svg" class="tour-save" viewBox="0 0 24 24">
		<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
		<polyline points="17 21 17 13 7 13 7 21"></polyline>
		<polyline points="7 3 7 8 15 8"></polyline></svg>`;

	case 'screenshot': return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="tour-screenshot">
		<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
		<circle cx="12" cy="13" r="4"></circle></svg>`;

	case 'location': return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="tour-location">
		<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
		<circle cx="12" cy="10" r="3"></circle></svg>`;

	case 'waypoint': return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="tour-waypoint">
		<path d="M 10,11 V 22"/>
		<path d="M 3,4 H 17.5 L 21,7 17.5,10.5 H 3 Z"/></svg>`;

	case 'spot': return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="tour-spot">
		<circle cx="12" cy="12" r="10"></circle></svg>`;


	default: throw "Icon not found.";
	}
}

function getIcons(args) {
	return Array.from(arguments).map(i => getIcon(i)).join("\n");
}

function createElement(tag, attributes) {
	let e = document.createElement(tag);
	for(let a in attributes) 
		e.setAttribute(a, attributes[a]);
	return e;
}

function createSvgElement(tag, attributes) {
	let e = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for(let a in attributes) 
		e.setAttribute(a, attributes[a]);
	return e;
}

export { getIcon, getIcons, createElement, createSvgElement }
