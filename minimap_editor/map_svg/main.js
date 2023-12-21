/**
 * @file Questo file è il file principale dell'editor della minimappa.
 * Inizializza l'editor della minimappa.
 * 
 * @requires MiniMap
 */

import MiniMap from './js/MiniMap.js';

document.addEventListener("DOMContentLoaded", () => {
  let minimap = new MiniMap();
  minimap.init('./dataset.json');

  // EXTRA DA ELIMINARE
  let yawDX = document.getElementById("yaw_DX");
  yawDX.addEventListener("click", () => {
    minimap.updateCurrentPanoYaw(5);
  });

  let yawSX = document.getElementById("yaw_SX");
  yawSX.addEventListener("click", () => {
    minimap.updateCurrentPanoYaw(-5);
  });

  let skipPano = document.getElementById("skip_pano");
  skipPano.addEventListener("click", () => {
    let panoIndex = Math.floor(Math.random() * 1000) % minimap.currentSet.panos.length;
    let panoID = minimap.currentSet.panos[panoIndex].id;
    minimap.togglePanoSkip(panoID);
  });

  let changePano = document.getElementById("change_pano");
  changePano.addEventListener("click", () => {
    let panoIndex = Math.floor(Math.random() * 1000) % minimap.currentSet.panos.length;
    let panoID = minimap.currentSet.panos[panoIndex].id;
    minimap.changeMap(panoID, 0);
  });

  let changePanoNewSet = document.getElementById("change_pano_new_set");
  changePanoNewSet.addEventListener("click", () => {
    let setIndex = Math.floor(Math.random() * 10) % minimap.currentTour.sets.length;
    let panoIndex = Math.floor(Math.random() * 1000) % minimap.currentTour.sets[setIndex].panos.length;
    let panoID = minimap.currentTour.sets[setIndex].panos[panoIndex].id;
    minimap.changeMap(panoID, 1);
  });

  let changePanoNewTour = document.getElementById("change_pano_new_tour");
  changePanoNewTour.addEventListener("click", () => {
    let tourIndex = Math.floor(Math.random() * 10) % minimap.dataset.tours.length;
    let setIndex = Math.floor(Math.random() * 10) % minimap.dataset.tours[tourIndex].sets.length;
    let panoIndex = Math.floor(Math.random() * 1000) % minimap.dataset.tours[tourIndex].sets[setIndex].panos.length;
    let panoID = minimap.dataset.tours[tourIndex].sets[setIndex].panos[panoIndex].id;
    minimap.changeMap(panoID, 2);
  });
});