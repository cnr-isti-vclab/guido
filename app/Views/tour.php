<!doctype html>
<html>
<head>
	<title>Guido tour</title>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0">
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">

	<link type="text/css"rel="stylesheet" href="/css/pannellum.css"/>
	<link type="text/css" rel="stylesheet" href="/css/style.css">
	<link type="text/css" rel="stylesheet" href="/css/minimap.css">
	<link type="text/css" rel="stylesheet" href="/css/navigation.css">
	<style>
		.modal-backdrop { display:none; }
/*		.tour-small-raise {
			fill:none;
			stroke-width:2;
			stroke-linecap:round;
			stroke-linejoin:round;
			stroke:white;
		} */

		#tour-users li:hover {
			opacity:0.8;
		}
		#tour-initial .modal-footer {
			justify-content: space-between;
		}
		.disabled {
			cursor:auto !important;
			opacity:0.2;
		}
                #overlayImageContainer {
                    display: none;
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 0;
                    background-color: rgba(0, 0, 0, 0.8);
                    padding: 20px;
                    border-radius: 5px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
                }
                #overlayImage {
                    max-width: 100%;
                    max-height: 80vh;
                    display: block;
                    margin: 0 auto;
                }
                #overlayImage {
		    width: 100%;
		    height: auto;
		    cursor: zoom-in; /* Indicate that the image can be zoomed */
		    transition: transform 0.25s ease; /* Smooth zoom transitions */
		    transform-origin: center center; /* Ensure the image stays in the same initial viewport while zooming */
		}

		#overlayImageWrapper {
		    max-width: 90%;
		    max-height: 90%;
		    overflow: hidden; /* Ensures the image doesn't overflow the container */
		    position: relative;
		}
		
		#overlayImage.zoomed {
		    cursor: zoom-out; /* Indicate that the image can be zoomed out */
		    transform: scale(2); /* Double the size for zoom */
		}

                .closeButton {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    color: #fff;
                    cursor: pointer;
                }}

	</style>
	 
</head>

<body>
	
	<!-- <div id="tour-initial">
		Name: <input type="text" name="name" id="username"><br/>
		<input type="button" id="enter" value="Enter"/>
	</div> -->
	<div id="panorama">

		<div class="tour-panel show">
			<div class="tour-toolbar">

				<div class="tour-entries active">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
						<title>Show/hide the list of locations</title>
							<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line>
							<line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line>
							<line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>
					</svg>
				</div>

				<div class="tour-chat"  badge="0">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -0 24 24">
						<title>Chat</title>
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
					</svg>
				</div>

				<div class="tour-users">
					<svg xmlns="http://www.w3.org/2000/svg" style="width:52px" viewBox="0 0 32 24" style="width:48px">
						<title>Partecipants</title>
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
						<text x="19" y="12" stroke="none" fill="white" font-family="arial" font-weight="bold" font-size="12px">?</text>
					</svg>
				</div>



				<div  class="tour-guide follow">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
						<title>Follow (or unfollow) the guide</title>
						<path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"></path>
						<path class="negate" d="M 21 3 L 3 21"></path>
					</svg>
				</div>

				<div  class="tour-options hidden">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
						<circle cx="12" cy="12" r="3"></circle>
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
					</svg>
					
				</div>

				<div class="tour-raise">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
						<title>Raise</title>
						<path transform="scale(0.8, 0.8) translate(3, 0)" d="m 11.806044,0.90186173 c -1.195402,0 -2.1644682,0.96906597 -2.1644682,2.16446897 v 9.0143883 l -0.01268,1.442979 V 5.7842617 c 0,-1.195403 -0.969065,-2.164468 -2.1644683,-2.164468 -1.195403,0 -2.164468,0.969065 -2.164468,2.164468 v 6.2964573 l -0.03804,2.90366 -0.031,-5.8628923 c -0.01276,-1.195335 -0.969065,-2.164469 -2.164468,-2.164469 -1.195403,0 -2.17723,0.969134 -2.164468,2.164469 l 0.05214,4.9348743 c -0.0019,0.03852 -0.0099,0.07508 -0.0099,0.114141 l 0,5.269291 c 0,3.903496 4.7136638,6.157579 6.0732655,6.157579 h 9.482441 c 1.483588,-0.707651 2.217351,-1.792665 3.124106,-2.926823 l 4.203427,-6.179654 c 0.54263,-1.06542 0.11862,-2.368999 -0.946955,-2.911323 -1.065044,-0.542835 -2.368488,-0.1195 -2.911322,0.945545 l -1.66976,2.37689 v -3.400856 c -0.0017,-0.0035 -0.0023,0.0035 -0.0043,-0.0028 V 5.8367547 c 0,-1.195403 -0.969066,-2.164469 -2.164468,-2.164469 -0.590471,0 -2.136958,1.624657 -2.150377,2.125012 -0.01465,0.546541 0.0017,6.9907433 -0.0099,7.5784563 V 3.0663307 c 0,-1.195403 -0.969065,-2.16446897 -2.164468,-2.16446897 z M 18.299449,13.501151 c 0.05641,0.11672 0,-1.16803 0,-0.938499 z" />
					</svg>
				</div>
				<div class="tour-talk">
					<svg id="user_mute" style="cursor:pointer; height:36px; " xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>
					</svg>

					<svg id="user_talk" style="cursor:pointer; display:none;  height:36px; width:36px;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
						<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>
					</svg>
				</div>

				<div  class="tour-eyestome hidden">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
						<title>Eyes to me</title>
						<path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"></path>
					</svg>
				</div>

				<div class="tour-laser hidden">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
						<title>Use ctrl to place a marker.</title>
						<path d="m 12.141162,15.379231 v 5.396658 m 0,-9.225673 L 2.0207238,21.670653 M 8.3121464,11.550216 a 3.8290145,3.8290145 0 0 1 3.8290146,-3.8290145 3.8290145,3.8290145 0 0 1 3.829014,3.8290145 3.8290145,3.8290145 0 0 1 -3.829013,3.829015 m 7.244854,2.397422 -4.163422,-3.816016 m 6.809696,-2.329882 -5.88797,-3e-6 m 3.101732,-6.7028645 -4.163425,3.816013 M 12.297864,2.1710218 V 7.5676806 M 5.2578831,4.7247665 9.4213049,8.5407813 m -7.0043905,3.1921087 5.8879692,2e-6" />
					</svg>
				</div>
			</div>
			<ul id="tour-entries" class="tour-section">
			</ul>
			<ul id="tour-users" class="tour-section hidden">
			</ul>
			<div id="tour-chat" class="tour-section hidden">
				<ul></ul>
				<div><input type="text" name="msg"><button class="btn btn-sm btn-success">Send</button></div>
			</div>
			<div id="users_video" style="position: relative; align-self: flex-end; background:traansparent;">
				<video style="width:100%;  height:auto" controls autoplay playsinline></video>
			</div>
			<div id="guide_video" style="position: relative; align-self: flex-end; display:none; background:red;">
				<video style="width:100%;  height:auto" autoplay playsinline mute></video>

				<div style="position:absolute; width:24px; padding:10px; flex-direction:column; display:flex; justify-content:center; gap:20px; height:100%; right:0px;" >

					<svg id="guide_mute" style="cursor:pointer; height:24px; " xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>
					</svg>

					<svg id="guide_talk" style="cursor:pointer; display:none;  height:24px;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
						<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>
					</svg>

					<svg id="guide_blind" style="cursor:pointer; " xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path><line x1="1" y1="1" x2="23" y2="23"></line>
					</svg>

					<svg id="guide_see" style="cursor:pointer;display:none;  height:24px;" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
					</svg>
				</div>

			</div>
		</div>

	</div>

	<div id="tour-initial" class="modal show" tabindex="-1" style="z-index:3; display:block;">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">Guido</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
				</div>
				<div class="modal-body">
					<p>
					Your name: <input required type="text" name="name" id="username"/><br/>
					</p>
				</div>
				<div class="modal-footer">
					<p id="waiting_msg">Connecting...</p>
					<button type="button" disabled id="tour-join" class="btn btn-success">Join</button>
				</div>
			</div>
		</div>
	</div>

	<dialog id="minimap_dialog">
		<div class="minimap_dialog_landing">
		  <p>Si è verificato un errore nel salvataggio delle modifiche apportate.</p>
		  <p>Ciò potrebbe essere dovuto a un problema di connessione o a un errore del server.</p>
		  <ul>
			<li><b>Riprova</b>: tenta nuovamente il salvataggio.</li>
			<li><b>Prosegui</b>: continua a modificare.</li>
		  </ul>
		  <div>
			<button id="minimap_dialog_retry_btn" title="Retry">Riprova</button>
			<button id="minimap_dialog_continue_btn" title="Continue">Prosegui</button>
		  </div>
		</div>
		<div class="minimap_dialog_loading minimap_dialog_hidden">
		  <p>Attendere prego...</p>
		  <svg class="minimap_dialog_loader_svg" viewBox="0 -5.5 37 16.5">
			<circle cx="5.5" cy="5.5" r="5"></circle>
			<circle cx="18.5" cy="5.5" r="5"></circle>
			<circle cx="31.5" cy="5.5" r="5"></circle>
		  </svg>
		</div>
	  </dialog>	  
  
	  <div id="minimap_container">
		<div id="map_container" class="simple_container map_container hidden">
		  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" id="map_svg"></svg>
		  <div id="map_controls" class="controls"></div>
		</div>
		<div id="map_open" class="simple_container">
<!--	MINIMAP NOT READY YET	  <button id="btn_map_open" class="map_control_btn map_open_btn" title="Open map editor"></button> -->
		</div>
	  </div>

          <div id="overlayImageContainer">
          <div id="overlayImageWrapper">
          <img id="overlayImage" src="" alt="Overlay Image">
          </div>
          <span class="closeButton">Close</span>
          </div>

	  <div id="question-alert" hidden>
	<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" >
	<path transform="scale(1.5, 1.5)" d="m 11.806044,0.90186173 c -1.195402,0 -2.1644682,0.96906597 -2.1644682,2.16446897 v 9.0143883 l -0.01268,1.442979 V 5.7842617 c 0,-1.195403 -0.969065,-2.164468 -2.1644683,-2.164468 -1.195403,0 -2.164468,0.969065 -2.164468,2.164468 v 6.2964573 l -0.03804,2.90366 -0.031,-5.8628923 c -0.01276,-1.195335 -0.969065,-2.164469 -2.164468,-2.164469 -1.195403,0 -2.17723,0.969134 -2.164468,2.164469 l 0.05214,4.9348743 c -0.0019,0.03852 -0.0099,0.07508 -0.0099,0.114141 l 0,5.269291 c 0,3.903496 4.7136638,6.157579 6.0732655,6.157579 h 9.482441 c 1.483588,-0.707651 2.217351,-1.792665 3.124106,-2.926823 l 4.203427,-6.179654 c 0.54263,-1.06542 0.11862,-2.368999 -0.946955,-2.911323 -1.065044,-0.542835 -2.368488,-0.1195 -2.911322,0.945545 l -1.66976,2.37689 v -3.400856 c -0.0017,-0.0035 -0.0023,0.0035 -0.0043,-0.0028 V 5.8367547 c 0,-1.195403 -0.969066,-2.164469 -2.164468,-2.164469 -0.590471,0 -2.136958,1.624657 -2.150377,2.125012 -0.01465,0.546541 0.0017,6.9907433 -0.0099,7.5784563 V 3.0663307 c 0,-1.195403 -0.969065,-2.16446897 -2.164468,-2.16446897 z M 18.299449,13.501151 c 0.05641,0.11672 0,-1.16803 0,-0.938499 z" stroke="red" fill="white" />
	</svg>
	</div>
	

	  <div id="button-container">
	    <button id="button1" class="navbtn" ></button>
	    <button id="button2" class="navbtn" ></button>
	    <button id="button3" class="navbtn" ></button>
	  </div>
  
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>
	<script type="text/javascript" src="/js/libpannellum.js"></script>
	<script type="text/javascript" src="/js/pannellum.js"></script>
	<script type="text/javascript">

window.guido_host = 'https://vcg-legacy.isti.cnr.it:8080';
window.guido_role = '<?=$role?>';
window.guido_key = '<?=$key?>';
window.guido_dataset = '<?=$dataset?>';
window.guido_saveUrl = '<?=$saveurl?>';
	</script>
	
	<script type="module" src="/js/main.js"></script> 


	</script>

 	<canvas id="graphview_canvas" width="1000" height="500" style="border: 2px solid black;"></canvas>  
</body>
</html>

